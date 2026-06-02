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
    def __init__(self, redis_client):
        self.redis_client = redis_client
        # Track active alarms to prevent multiple notifications per track
        self.active_restricted_alerts = set() # (global_id, zone_id)
        self.active_dwell_timers = {} # (global_id, zone_id) -> entry_time
        self.active_dwell_alerts = set() # (global_id, zone_id)

    def evaluate_person(self, global_id: str, track_id: int, camera_id: int, floor: int, x: float, y: float):
        """
        Evaluate person position relative to all defined zones on their floor.
        Trigger and persist DB alerts + WebSocket pub/sub events.
        """
        db: Session = SessionLocal()
        try:
            # Get all active zones on this floor
            zones = db.query(Zone).filter(Zone.floor == floor, Zone.is_active == True).all()
            
            for zone in zones:
                # Layout coordinate bounds are normalized 0-100% or absolute pixels.
                # Since x, y are scaled to 0-1000 or relative percentages on the layout,
                # we match them based on pointPolygonTest.
                # Canvas layout maps coordinates normalized relative to the background (0 to 1000 usually)
                is_inside = is_point_in_polygon(x, y, zone.coordinates)
                alert_key = (global_id, zone.id)
                
                if is_inside:
                    # 1. Handle Restricted Area Intrusion
                    if zone.zone_type == ZoneType.RESTRICTED:
                        if alert_key not in self.active_restricted_alerts:
                            self.active_restricted_alerts.add(alert_key)
                            self._trigger_alert(
                                db=db,
                                camera_id=camera_id,
                                track_id=str(track_id),
                                global_id=global_id,
                                alert_type=AlertType.RESTRICTED_ZONE,
                                severity=AlertSeverity.CRITICAL,
                                description=f"Security Intrusion: Track #{global_id} entered Restricted Zone '{zone.name}'",
                                zone_id=zone.id
                            )
                            
                    # 2. Handle Loitering / Dwell Alert
                    elif zone.zone_type == ZoneType.DWELL:
                        if alert_key not in self.active_dwell_timers:
                            self.active_dwell_timers[alert_key] = time.time()
                        else:
                            elapsed = time.time() - self.active_dwell_timers[alert_key]
                            if elapsed > zone.dwell_alert_seconds and alert_key not in self.active_dwell_alerts:
                                self.active_dwell_alerts.add(alert_key)
                                self._trigger_alert(
                                    db=db,
                                    camera_id=camera_id,
                                    track_id=str(track_id),
                                    global_id=global_id,
                                    alert_type=AlertType.DWELL_EXCEEDED,
                                    severity=AlertSeverity.HIGH,
                                    description=f"Dwell Exceeded: Track #{global_id} loitering in '{zone.name}' for {int(elapsed)}s",
                                    zone_id=zone.id
                                )
                                
                else:
                    # Reset states when they leave the polygon
                    if zone.zone_type == ZoneType.RESTRICTED:
                        self.active_restricted_alerts.discard(alert_key)
                    elif zone.zone_type == ZoneType.DWELL:
                        self.active_dwell_timers.pop(alert_key, None)
                        self.active_dwell_alerts.discard(alert_key)
                        
        except Exception as e:
            logger.error("Error evaluating intrusion: %s", e)
        finally:
            db.close()

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
