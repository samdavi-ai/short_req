from sqlalchemy.orm import Session
from app.models.models import EmployeeBreak
from datetime import datetime

class BreakMonitorService:
    @staticmethod
    def record_break_start(db: Session, employee_id: int) -> EmployeeBreak:
        db_break = EmployeeBreak(
            employee_id=employee_id,
            start_time=datetime.utcnow()
        )
        db.add(db_break)
        db.commit()
        db.refresh(db_break)
        return db_break

    @staticmethod
    def record_break_end(db: Session, break_id: int) -> EmployeeBreak:
        db_break = db.query(EmployeeBreak).filter(EmployeeBreak.id == break_id).first()
        if db_break:
            db_break.end_time = datetime.utcnow()
            duration = (db_break.end_time - db_break.start_time).total_seconds()
            db_break.duration_seconds = int(duration)
            db_break.compliant = duration >= 15 * 60 # 15 minutes minimum break requirement
            db.commit()
            db.refresh(db_break)
        return db_break
