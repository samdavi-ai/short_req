"""Employees API — Employee management and break compliance."""

import csv
from io import StringIO
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import List, Optional
from datetime import datetime, timezone, timedelta

from app.core.database import get_db
from app.models.models import Employee, EmployeeBreak, ActiveTrack, User
from app.api.routes.auth import require_role, log_audit
from app.schemas.schemas import (
    EmployeeCreate, EmployeeUpdate, EmployeeResponse,
    BreakStartRequest, BreakEndRequest, BreakResponse,
    BreakComplianceStatus,
)

router = APIRouter()


# ─── Employee CRUD ────────────────────────────────────────────────────────────

@router.get("/", response_model=List[EmployeeResponse])
def list_employees(
    department: Optional[str] = Query(None),
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
):
    query = db.query(Employee)
    if department:
        query = query.filter(Employee.department.ilike(f"%{department}%"))
    if active_only:
        query = query.filter(Employee.is_active == True)
    return query.order_by(Employee.employee_code).all()

@router.get("/compliance/all", response_model=List[BreakComplianceStatus])
@router.get("/break-compliance", response_model=List[BreakComplianceStatus])
def get_all_compliance(db: Session = Depends(get_db)):
    """
    Real-time break compliance check for ALL active employees.
    Returns which employees are overdue for their break.
    """
    employees = db.query(Employee).filter(Employee.is_active == True).all()
    statuses = []

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

        # Check if currently on break
        open_break = (
            db.query(EmployeeBreak)
            .filter(
                EmployeeBreak.employee_id == emp.id,
                EmployeeBreak.end_time == None,
            )
            .first()
        )

        is_on_break = open_break is not None
        minutes_since_last_break = None
        overdue = False
        overdue_by_minutes = None

        if not is_on_break:
            if last_break:
                minutes_since_last_break = (
                    datetime.now(timezone.utc) - last_break.end_time.replace(tzinfo=timezone.utc)
                ).total_seconds() / 60
            else:
                # No break on record yet — treat as just started shift
                minutes_since_last_break = 0

            if minutes_since_last_break is not None and minutes_since_last_break > emp.break_interval_minutes:
                overdue = True
                overdue_by_minutes = minutes_since_last_break - emp.break_interval_minutes

        statuses.append(
            BreakComplianceStatus(
                employee_id=emp.id,
                employee_code=emp.employee_code,
                fullname=emp.fullname,
                is_on_break=is_on_break,
                minutes_since_last_break=minutes_since_last_break,
                overdue=overdue,
                overdue_by_minutes=overdue_by_minutes,
            )
        )

    return statuses


@router.get("/export")
def export_employee_attendance(
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


@router.get("/{employee_id}", response_model=EmployeeResponse)
def get_employee(employee_id: int, db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    return emp


@router.post("/", response_model=EmployeeResponse, status_code=201)
def create_employee(emp_in: EmployeeCreate, db: Session = Depends(get_db)):
    existing = db.query(Employee).filter(Employee.employee_code == emp_in.employee_code).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Employee with code '{emp_in.employee_code}' already exists",
        )
    db_emp = Employee(**emp_in.model_dump())
    db.add(db_emp)
    db.commit()
    db.refresh(db_emp)
    return db_emp


@router.patch("/{employee_id}", response_model=EmployeeResponse)
def update_employee(
    employee_id: int,
    emp_in: EmployeeUpdate,
    db: Session = Depends(get_db),
):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    for field, value in emp_in.model_dump(exclude_unset=True).items():
        setattr(emp, field, value)

    db.commit()
    db.refresh(emp)
    return emp


@router.delete("/{employee_id}", status_code=204)
def delete_employee(employee_id: int, db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    db.delete(emp)
    db.commit()


# ─── Break Management ─────────────────────────────────────────────────────────

@router.post("/breaks/start", response_model=BreakResponse, status_code=201)
def start_break(req: BreakStartRequest, db: Session = Depends(get_db)):
    """Record start of an employee break."""
    emp = db.query(Employee).filter(Employee.id == req.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Check if already on break
    existing = (
        db.query(EmployeeBreak)
        .filter(
            EmployeeBreak.employee_id == req.employee_id,
            EmployeeBreak.end_time == None,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail="Employee already has an open break record",
        )

    db_break = EmployeeBreak(
        employee_id=req.employee_id,
        start_time=datetime.now(timezone.utc),
        lounge_zone_id=req.lounge_zone_id,
    )
    db.add(db_break)
    db.commit()
    db.refresh(db_break)
    return db_break


@router.post("/breaks/end", response_model=BreakResponse)
def end_break(req: BreakEndRequest, db: Session = Depends(get_db)):
    """Mark end of an employee break and calculate compliance."""
    db_break = db.query(EmployeeBreak).filter(EmployeeBreak.id == req.break_id).first()
    if not db_break:
        raise HTTPException(status_code=404, detail="Break record not found")
    if db_break.end_time:
        raise HTTPException(status_code=409, detail="Break already ended")

    emp = db.query(Employee).filter(Employee.id == db_break.employee_id).first()
    end_time = datetime.now(timezone.utc)
    duration_sec = int((end_time - db_break.start_time).total_seconds())

    db_break.end_time = end_time
    db_break.duration_seconds = duration_sec
    # Compliant if break lasted at least the required minimum
    db_break.compliant = duration_sec >= (emp.break_duration_minutes * 60)

    db.commit()
    db.refresh(db_break)
    return db_break


@router.get("/{employee_id}/breaks", response_model=List[BreakResponse])
def get_employee_breaks(
    employee_id: int,
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Get break history for an employee (most recent first)."""
    return (
        db.query(EmployeeBreak)
        .filter(EmployeeBreak.employee_id == employee_id)
        .order_by(EmployeeBreak.start_time.desc())
        .limit(limit)
        .all()
    )



