import csv
from io import StringIO
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import extract
from datetime import datetime
from typing import List, Optional

from app.core.database import get_db
from app.models.models import AuditLog, Employee, EmployeeBreak, ActiveTrack, Visitor, Camera
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


@router.get("/export/visitors")
def export_visitor_data(
    month: str = Query(..., description="YYYY-MM"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Export visitor attendance for a specific month as CSV, aggregated from tracks."""
    try:
        year, month_num = map(int, month.split('-'))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid month format. Use YYYY-MM")

    # Fetch all visitors
    visitors = db.query(Visitor).all()

    # Generate CSV
    f = StringIO()
    writer = csv.writer(f)
    writer.writerow(["visitor_id", "name", "passport_number", "nationality", "first_seen", "last_seen", "total_hours"])

    for vis in visitors:
        # Query all tracks for this visitor in the given month/year
        tracks = db.query(ActiveTrack).filter(
            ActiveTrack.matched_visitor_id == vis.id,
            extract('year', ActiveTrack.first_seen) == year,
            extract('month', ActiveTrack.first_seen) == month_num
        ).all()

        if not tracks:
            writer.writerow([vis.id, vis.fullname, vis.passport_number or "N/A", vis.nationality or "N/A", "N/A", "N/A", "0.0"])
            continue

        first_seen = min(t.first_seen for t in tracks)
        last_seen = max(t.last_seen for t in tracks)

        total_seconds = 0
        for t in tracks:
            dt = (t.last_seen - t.first_seen).total_seconds()
            total_seconds += max(0, dt)

        total_hours = round(total_seconds / 3600.0, 2)

        writer.writerow([
            vis.id,
            vis.fullname,
            vis.passport_number or "N/A",
            vis.nationality or "N/A",
            first_seen.isoformat(),
            last_seen.isoformat(),
            str(total_hours)
        ])

    # Log to audit logs
    log_audit(
        db, 
        current_user.id, 
        "AUDIT_EXPORT", 
        "Visitor", 
        None, 
        {"month": month, "type": "visitor_csv"}
    )

    f.seek(0)
    return StreamingResponse(
        iter([f.getvalue()]), 
        media_type="text/csv", 
        headers={"Content-Disposition": f"attachment; filename=visitor_attendance_{month}.csv"}
    )


@router.get("/export/entry_exit")
def export_entry_exit_logs(
    month: str = Query(..., description="YYYY-MM"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "operator"))
):
    """Export detailed chronological entry/exit logs for both employees and visitors for a specific month as CSV."""
    try:
        year, month_num = map(int, month.split('-'))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid month format. Use YYYY-MM")

    # Fetch all tracks in the month where matched_employee_id or matched_visitor_id is set
    from sqlalchemy.orm import joinedload
    tracks = db.query(ActiveTrack).options(
        joinedload(ActiveTrack.camera)
    ).filter(
        extract('year', ActiveTrack.first_seen) == year,
        extract('month', ActiveTrack.first_seen) == month_num,
        (ActiveTrack.matched_employee_id.isnot(None) | ActiveTrack.matched_visitor_id.isnot(None))
    ).order_by(ActiveTrack.first_seen.asc()).all()

    # Prefetch employees and visitors for fast lookup
    employees_lookup = {e.id: e for e in db.query(Employee).all()}
    visitors_lookup = {v.id: v for v in db.query(Visitor).all()}

    # Generate CSV
    f = StringIO()
    writer = csv.writer(f)
    writer.writerow([
        "timestamp", "global_id", "type", "id_code", "name", 
        "department_nationality", "location", "entry_time", "exit_time", "duration_minutes"
    ])

    for t in tracks:
        camera_name = t.camera.name if t.camera else f"Camera {t.camera_id}"
        duration = round((t.last_seen - t.first_seen).total_seconds() / 60.0, 2) if t.last_seen and t.first_seen else 0.0

        if t.matched_employee_id:
            emp = employees_lookup.get(t.matched_employee_id)
            id_code = emp.employee_code if emp else f"EMP-{t.matched_employee_id}"
            name = emp.fullname if emp else "Unknown Employee"
            dept = emp.department if emp else ""
            writer.writerow([
                t.first_seen.isoformat(),
                t.global_id,
                "EMPLOYEE",
                id_code,
                name,
                dept,
                camera_name,
                t.first_seen.isoformat(),
                t.last_seen.isoformat(),
                str(duration)
            ])

        elif t.matched_visitor_id:
            vis = visitors_lookup.get(t.matched_visitor_id)
            id_code = vis.passport_number if vis else f"VIS-{t.matched_visitor_id}"
            name = vis.fullname if vis else "Unknown Visitor"
            nat = vis.nationality if vis else ""
            writer.writerow([
                t.first_seen.isoformat(),
                t.global_id,
                "VISITOR",
                id_code,
                name,
                nat,
                camera_name,
                t.first_seen.isoformat(),
                t.last_seen.isoformat(),
                str(duration)
            ])

    # Log to audit logs
    log_audit(
        db, 
        current_user.id, 
        "AUDIT_EXPORT", 
        "ActiveTrack", 
        None, 
        {"month": month, "type": "entry_exit_csv"}
    )

    f.seek(0)
    return StreamingResponse(
        iter([f.getvalue()]), 
        media_type="text/csv", 
        headers={"Content-Disposition": f"attachment; filename=entry_exit_logs_{month}.csv"}
    )
