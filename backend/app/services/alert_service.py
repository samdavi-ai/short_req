from sqlalchemy.orm import Session
from app.models.models import Alert
from datetime import datetime

class AlertService:
    @staticmethod
    def trigger_alert(db: Session, camera_id: int, track_id: str, alert_type: str, description: str, severity: str = 'HIGH', snapshot_path: str = None) -> Alert:
        db_alert = Alert(
            camera_id=camera_id,
            track_id=track_id,
            alert_type=alert_type,
            description=description,
            severity=severity,
            snapshot_path=snapshot_path,
            acknowledged=False
        )
        db.add(db_alert)
        db.commit()
        db.refresh(db_alert)
        return db_alert
