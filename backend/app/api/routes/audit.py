import csv
from io import StringIO
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import extract
from datetime import datetime
from typing import List, Optional

from app.core.database import get_db
from app.models.models import AuditLog, Employee, EmployeeBreak, ActiveTrack
from app.api.routes.auth import get_current_user, require_role, User, log_audit
from pydantic import BaseModel

router = APIRouter()

class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int]
    action: str
    resource_type: Optional[str]
    resource_id: Optional[str]
    details: Optional[dict]
    timestamp: datetime

    class Config:
        from_attributes = True

@router.get("/logs", response_model=List[AuditLogResponse])
def get_audit_logs(
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "operator"))
):
    """Fetch recent audit logs."""
    logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit).all()
    return logs


@router.get("/export/audit")
@router.get("/export")
def export_audit_logs(
    month: str = Query(..., description="YYYY-MM"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Export audit logs for a specific month as CSV."""
    try:
        year, month_num = map(int, month.split('-'))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid month format. Use YYYY-MM")

    logs = db.query(AuditLog).filter(
        extract('year', AuditLog.timestamp) == year,
        extract('month', AuditLog.timestamp) == month_num
    ).order_by(AuditLog.timestamp.asc()).all()

    # Generate CSV
    f = StringIO()
    writer = csv.writer(f)
    writer.writerow(["timestamp", "user", "event_type", "detail", "ip_address"])
    for log in logs:
        ip_addr = log.details.get("ip_address", "unknown") if isinstance(log.details, dict) else "unknown"
        writer.writerow([
            log.timestamp.isoformat(), 
            log.user_id, 
            log.action, 
            str(log.details),
            ip_addr
        ])
    
    # Log to audit logs
    log_audit(
        db, 
        current_user.id, 
        "AUDIT_EXPORT", 
        "AuditLog", 
        None, 
        {"month": month, "type": "audit_csv"}
    )

    f.seek(0)
    return StreamingResponse(
        iter([f.getvalue()]), 
        media_type="text/csv", 
        headers={"Content-Disposition": f"attachment; filename=audit_logs_{month}.csv"}
    )


@router.get("/export/employees")
def export_employee_data(
    month: str = Query(..., description="YYYY-MM"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Export employee attendance for a specific month as CSV, aggregated from tracks."""
    try:
        year, month_num = map(int, month.split('-'))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid month format. Use YYYY-MM")

    # Fetch all employees
    employees = db.query(Employee).all()

    # Generate CSV
    f = StringIO()
    writer = csv.writer(f)
    writer.writerow(["employee_id", "name", "first_seen", "last_seen", "total_hours"])

    for emp in employees:
        # Query all tracks for this employee in the given month/year
        tracks = db.query(ActiveTrack).filter(
            ActiveTrack.matched_employee_id == emp.id,
            extract('year', ActiveTrack.first_seen) == year,
            extract('month', ActiveTrack.first_seen) == month_num
        ).all()

        if not tracks:
            writer.writerow([emp.employee_code, emp.fullname, "N/A", "N/A", "0.0"])
            continue

        first_seen = min(t.first_seen for t in tracks)
        last_seen = max(t.last_seen for t in tracks)

        total_seconds = 0
        for t in tracks:
            dt = (t.last_seen - t.first_seen).total_seconds()
            total_seconds += max(0, dt)

        total_hours = round(total_seconds / 3600.0, 2)

        writer.writerow([
            emp.employee_code,
            emp.fullname,
            first_seen.isoformat(),
            last_seen.isoformat(),
            str(total_hours)
        ])

    # Log to audit logs
    log_audit(
        db, 
        current_user.id, 
        "AUDIT_EXPORT", 
        "Employee", 
        None, 
        {"month": month, "type": "attendance_csv"}
    )

    f.seek(0)
    return StreamingResponse(
        iter([f.getvalue()]), 
        media_type="text/csv", 
        headers={"Content-Disposition": f"attachment; filename=employee_attendance_{month}.csv"}
    )
