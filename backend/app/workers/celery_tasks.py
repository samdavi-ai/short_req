"""
Celery async task definitions for Airport Surveillance backend.
Workers run independently, consuming from Redis broker.

Start worker with:
  celery -A app.workers.celery_tasks.celery_app worker --loglevel=info
"""

from celery import Celery
from celery.schedules import crontab
from app.core.config import settings
import logging
import os

logger = logging.getLogger(__name__)

# ─── Celery App ───────────────────────────────────────────────────────────────

celery_app = Celery(
    "airport_surveillance",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.workers.celery_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    result_expires=3600,  # Results expire after 1 hour
    worker_prefetch_multiplier=1,
    task_acks_late=True,  # Acknowledge only after task completes (safe retry)
)

# ─── Periodic Beat Schedule ───────────────────────────────────────────────────

celery_app.conf.beat_schedule = {
    "purge-stale-tracks-nightly": {
        "task": "app.workers.celery_tasks.purge_stale_tracks",
        "schedule": crontab(hour=2, minute=0),  # 2:00 AM every night
    },
    "check-employee-break-compliance-every-5min": {
        "task": "app.workers.celery_tasks.check_break_compliance",
        "schedule": 300.0,  # Every 5 minutes
    },
    "camera-health-check-every-minute": {
        "task": "app.workers.celery_tasks.camera_health_check",
        "schedule": 60.0,  # Every 1 minute
    },
}


# ─── Tasks ────────────────────────────────────────────────────────────────────

@celery_app.task(bind=True, name="app.workers.celery_tasks.purge_stale_tracks", max_retries=3)
def purge_stale_tracks(self, older_than_hours: int = 24):
    """
    Deactivate tracks that haven't been seen in N hours.
    Keeps the active_tracks table lean and prevents memory bloat in Milvus lookups.
    """
    try:
        from app.core.database import SessionLocal
        from app.models.models import ActiveTrack
        from datetime import datetime, timezone, timedelta

        db = SessionLocal()
        try:
            cutoff = datetime.now(timezone.utc) - timedelta(hours=older_than_hours)
            stale = (
                db.query(ActiveTrack)
                .filter(ActiveTrack.is_active == True, ActiveTrack.last_seen < cutoff)
                .all()
            )
            count = len(stale)
            for track in stale:
                track.is_active = False
            db.commit()
            logger.info("Purged %d stale tracks (older than %dh)", count, older_than_hours)
            return {"status": "SUCCESS", "purged_count": count}
        finally:
            db.close()

    except Exception as exc:
        logger.error("purge_stale_tracks failed: %s", exc)
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(bind=True, name="app.workers.celery_tasks.check_break_compliance", max_retries=2)
def check_break_compliance(self):
    """
    Check all active employees for break overdue status.
    Creates BREAK_VIOLATION alerts for any employee exceeding their break interval.
    """
    try:
        from app.core.database import SessionLocal
        from app.models.models import Employee, EmployeeBreak, Alert, AlertType, AlertSeverity
        from datetime import datetime, timezone, timedelta

        db = SessionLocal()
        try:
            employees = db.query(Employee).filter(Employee.is_active == True).all()
            violations = 0

            for emp in employees:
                # Find most recent completed break
                last_break = (
                    db.query(EmployeeBreak)
                    .filter(
                        EmployeeBreak.employee_id == emp.id,
                        EmployeeBreak.end_time != None,
                    )
                    .order_by(EmployeeBreak.end_time.desc())
                    .first()
                )

                # Check if currently on break (skip if so)
                on_break = (
                    db.query(EmployeeBreak)
                    .filter(
                        EmployeeBreak.employee_id == emp.id,
                        EmployeeBreak.end_time == None,
                    )
                    .first()
                )
                if on_break:
                    continue

                if last_break:
                    elapsed_min = (
                        datetime.now(timezone.utc) - last_break.end_time.replace(tzinfo=timezone.utc)
                    ).total_seconds() / 60
                else:
                    elapsed_min = 0

                overdue = elapsed_min > emp.break_interval_minutes

                if overdue:
                    overdue_by = elapsed_min - emp.break_interval_minutes
                    # Only create alert if no open BREAK_VIOLATION for this employee in last 30 min
                    recent_alert = (
                        db.query(Alert)
                        .filter(
                            Alert.alert_type == AlertType.BREAK_VIOLATION,
                            Alert.description.ilike(f"%{emp.employee_code}%"),
                            Alert.timestamp >= datetime.now(timezone.utc) - timedelta(minutes=30),
                        )
                        .first()
                    )
                    if not recent_alert:
                        alert = Alert(
                            alert_type=AlertType.BREAK_VIOLATION,
                            severity=AlertSeverity.MEDIUM,
                            description=(
                                f"Employee {emp.employee_code} ({emp.fullname}) "
                                f"is overdue for a break by {overdue_by:.0f} minutes. "
                                f"Required break every {emp.break_interval_minutes} minutes."
                            ),
                        )
                        db.add(alert)
                        violations += 1

            db.commit()
            logger.info("Break compliance check: %d new violations", violations)
            return {"status": "SUCCESS", "violations_created": violations}
        finally:
            db.close()

    except Exception as exc:
        logger.error("check_break_compliance failed: %s", exc)
        raise self.retry(exc=exc, countdown=30)


@celery_app.task(bind=True, name="app.workers.celery_tasks.camera_health_check", max_retries=2)
def camera_health_check(self):
    """
    Verify all configured cameras are still reachable (placeholder —
    real implementation pings RTSP URLs or checks Redis heartbeat keys).
    Creates CAMERA_OFFLINE alerts for any camera that goes dark.
    """
    try:
        from app.core.database import SessionLocal
        from app.models.models import Camera, CameraStatus, Alert, AlertType, AlertSeverity

        db = SessionLocal()
        try:
            cameras = db.query(Camera).filter(Camera.status == CameraStatus.ACTIVE).all()
            offline_count = 0

            for cam in cameras:
                # In production: check Redis key "camera_heartbeat_{cam.id}"
                # If key is missing/expired, the processing worker has stalled
                import redis as sync_redis
                try:
                    r = sync_redis.from_url(settings.REDIS_URL, socket_timeout=2)
                    heartbeat = r.get(f"camera_heartbeat_{cam.id}")
                    if heartbeat is None:
                        # Mark camera offline
                        cam.status = CameraStatus.OFFLINE
                        offline_count += 1
                        # Create alert
                        db.add(Alert(
                            camera_id=cam.id,
                            alert_type=AlertType.CAMERA_OFFLINE,
                            severity=AlertSeverity.HIGH,
                            description=f"Camera '{cam.name}' (ID={cam.id}) heartbeat lost.",
                        ))
                except Exception:
                    pass  # Redis unavailable — skip check

            if offline_count > 0:
                db.commit()
                logger.warning("Camera health check: %d cameras went offline", offline_count)

            return {"status": "SUCCESS", "offline_detected": offline_count}
        finally:
            db.close()

    except Exception as exc:
        logger.error("camera_health_check failed: %s", exc)
        raise self.retry(exc=exc, countdown=30)


@celery_app.task(name="app.workers.celery_tasks.generate_analytics_report")
def generate_analytics_report(report_type: str = "daily"):
    """
    Generate PDF/CSV analytics report and save to assets/reports/.
    Triggered on-demand from the Analytics dashboard Export button.
    """
    os.makedirs("assets/reports", exist_ok=True)
    filename = f"assets/reports/{report_type}_report.csv"

    # Placeholder: real implementation queries DB and writes CSV/PDF
    with open(filename, "w") as f:
        f.write("camera_id,tracks_count,alerts_count,date\n")
        f.write("1,142,3,2026-06-01\n")

    logger.info("Analytics report generated: %s", filename)
    return {"status": "SUCCESS", "report_path": filename}
