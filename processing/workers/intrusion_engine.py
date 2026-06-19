import time
import json
import logging
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.models import Zone, Alert, ZoneType, AlertType, AlertSeverity
from app.api.routes.auth import get_db

logger = logging.getLogger(__name__)

def is_point_in_polygon(x: float, y: float, poly: list) -> bool:
    """
    Ray casting algorithm to determine if a point (x, y) is inside a polygon.
    poly: list of dicts/coordinates e.g. [{"x": 10, "y": 10}, ...]
    """
    if not poly or len(poly) < 3:
        return False
        
    n = len(poly)
    inside = False
    p1x = poly[0].get('x', 0)
    p1y = poly[0].get('y', 0)
    
    for i in range(n + 1):
        p2x = poly[i % n].get('x', 0)
        p2y = poly[i % n].get('y', 0)
        if y > min(p1y, p2y):
            if y <= max(p1y, p2y):
                if x <= max(p1x, p2x):
                    if p1y != p2y:
                        xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or x <= xinters:
                        inside = not inside
        p1x, p1y = p2x, p2y
        
    return inside


class IntrusionEngine:
    # Cooldown: suppress repeated alerts for the same track+zone for this many seconds
    ALERT_COOLDOWN_SECONDS = 120
    # Zone-level rate limit: max 1 alert per zone per this many seconds
    ZONE_RATE_LIMIT_SECONDS = 30
    # Dwell update publishing interval (seconds) — prevents flooding Redis
    DWELL_UPDATE_INTERVAL = 10

    def __init__(self, redis_client):
        self.redis_client = redis_client
        # Dedup by stable key: (camera_id, track_id, zone_id) -> timestamp of last alert
        self._restricted_alert_times = {}   # key -> last_alert_epoch
        self._dwell_entry_times = {}        # (camera_id, track_id, zone_id) -> entry_time
        self._dwell_alert_times = {}        # key -> last_alert_epoch
        # Zone-level rate limiter: zone_id -> last_alert_epoch
        self._zone_last_alert = {}
        # Dwell update publishing rate limiter: dedup_key -> last_publish_epoch
        self._dwell_update_times = {}

    def evaluate_person(self, global_id: str, track_id: int, camera_id: int, floor: int, x: float, y: float):
        """
        Evaluate person position relative to all defined zones on their floor.
        Trigger and persist DB alerts + WebSocket pub/sub events.
        """
        db: Session = SessionLocal()
        now = time.time()
        try:
            # Get all active zones on this floor
            zones = db.query(Zone).filter(Zone.floor == floor, Zone.is_active == True).all()
            
            for zone in zones:
                is_inside = is_point_in_polygon(x, y, zone.coordinates)
                # Use stable dedup key: camera_id + ByteTrack track_id + zone_id
                dedup_key = (camera_id, track_id, zone.id)
                
                if is_inside:
                    # 1. Handle Restricted Area Intrusion
                    if zone.zone_type == ZoneType.RESTRICTED:
                        last_alert = self._restricted_alert_times.get(dedup_key, 0)
                        zone_last = self._zone_last_alert.get(zone.id, 0)
                        if (now - last_alert > self.ALERT_COOLDOWN_SECONDS and
                                now - zone_last > self.ZONE_RATE_LIMIT_SECONDS):
                            self._restricted_alert_times[dedup_key] = now
                            self._zone_last_alert[zone.id] = now
                            self._trigger_alert(
                                db=db,
                                camera_id=camera_id,
                                track_id=str(track_id),
                                global_id=global_id,
                                alert_type=AlertType.RESTRICTED_ZONE,
                                severity=AlertSeverity.CRITICAL,
                                description=f"Security Intrusion: Track #{track_id} entered Restricted Zone '{zone.name}'",
                                zone_id=zone.id
                            )
                            
                    # 2. Handle Loitering / Dwell Alert
                    elif zone.zone_type == ZoneType.DWELL:
                        if dedup_key not in self._dwell_entry_times:
                            self._dwell_entry_times[dedup_key] = now
                        else:
                            elapsed = now - self._dwell_entry_times[dedup_key]

                            # Publish DWELL_UPDATE for frontend heatmap (rate-limited)
                            last_dwell_pub = self._dwell_update_times.get(dedup_key, 0)
                            if now - last_dwell_pub > self.DWELL_UPDATE_INTERVAL:
                                self._dwell_update_times[dedup_key] = now
                                self._publish_dwell_update(
                                    global_id=global_id,
                                    zone_id=zone.id,
                                    zone_name=zone.name,
                                    dwell_seconds=elapsed,
                                    camera_id=camera_id,
                                )

                            # Trigger alert if dwell exceeds threshold
                            last_dwell_alert = self._dwell_alert_times.get(dedup_key, 0)
                            zone_last = self._zone_last_alert.get(zone.id, 0)
                            if (elapsed > zone.dwell_alert_seconds and
                                    now - last_dwell_alert > self.ALERT_COOLDOWN_SECONDS and
                                    now - zone_last > self.ZONE_RATE_LIMIT_SECONDS):
                                self._dwell_alert_times[dedup_key] = now
                                self._zone_last_alert[zone.id] = now
                                self._trigger_alert(
                                    db=db,
                                    camera_id=camera_id,
                                    track_id=str(track_id),
                                    global_id=global_id,
                                    alert_type=AlertType.DWELL_EXCEEDED,
                                    severity=AlertSeverity.HIGH,
                                    description=f"Dwell Exceeded: Track #{track_id} loitering in '{zone.name}' for {int(elapsed)}s",
                                    zone_id=zone.id
                                )
                                
                else:
                    # Reset states when they leave the polygon
                    if zone.zone_type == ZoneType.RESTRICTED:
                        self._restricted_alert_times.pop(dedup_key, None)
                    elif zone.zone_type == ZoneType.DWELL:
                        self._dwell_entry_times.pop(dedup_key, None)
                        self._dwell_alert_times.pop(dedup_key, None)

        except Exception as e:
            logger.error("Error evaluating intrusion: %s", e)
        finally:
            db.close()

        # Periodically clean up old entries to prevent memory growth
        if int(now) % 60 == 0:
            self._cleanup_stale(now)

    def _publish_dwell_update(self, global_id: str, zone_id: int,
                              zone_name: str, dwell_seconds: float,
                              camera_id: int):
        """Publish a DWELL_UPDATE event to Redis for frontend heatmap."""
        event = {
            "type": "DWELL_UPDATE",
            "camera_id": camera_id,
            "data": {
                "global_id": global_id,
                "zone_id": zone_id,
                "zone_name": zone_name,
                "dwell_seconds": round(dwell_seconds, 1),
                "timestamp": str(time.time()),
            }
        }
        try:
            self.redis_client.publish("ws_events", json.dumps(event, default=str))
        except Exception as e:
            logger.error("Failed to publish DWELL_UPDATE: %s", e)

    def _cleanup_stale(self, now):
        """Remove dedup entries older than 10 minutes to prevent unbounded memory growth."""
        cutoff = now - 600
        self._restricted_alert_times = {
            k: v for k, v in self._restricted_alert_times.items() if v > cutoff
        }
        self._dwell_entry_times = {
            k: v for k, v in self._dwell_entry_times.items() if v > cutoff
        }
        self._dwell_alert_times = {
            k: v for k, v in self._dwell_alert_times.items() if v > cutoff
        }
        self._dwell_update_times = {
            k: v for k, v in self._dwell_update_times.items() if v > cutoff
        }

    def _trigger_alert(self, db: Session, camera_id: int, track_id: str, global_id: str,
                       alert_type: AlertType, severity: AlertSeverity, description: str, zone_id: int):
        """Persist alert in DB and push instant WebSocket notification."""
        try:
            alert = Alert(
                camera_id=camera_id,
                track_id=track_id,
                global_id=global_id,
                alert_type=alert_type,
                severity=severity,
                description=description,
                zone_id=zone_id
            )
            db.add(alert)
            db.commit()
            db.refresh(alert)
            
            logger.info("Intrusion Alert Triggered: %s (ID: %d)", alert_type, alert.id)
            
            # Publish WebSocket event
            event = {
                "type": "ALERT_NEW",
                "camera_id": camera_id,
                "data": {
                    "id": alert.id,
                    "alert_type": alert.alert_type,
                    "severity": alert.severity,
                    "description": alert.description,
                    "timestamp": str(alert.timestamp),
                    "acknowledged": False
                }
            }
            # Publish to Redis channel so WebSocket subscribers broadcast it
            self.redis_client.publish("ws_events", json.dumps(event, default=str))
            
        except Exception as e:
            logger.error("Failed to commit alert: %s", e)

