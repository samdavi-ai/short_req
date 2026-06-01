"""Visitors API — Watchlist, whitelist, and blacklist management."""

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
import os, shutil, uuid

from app.core.database import get_db
from app.core.config import settings
from app.models.models import Visitor
from app.schemas.schemas import VisitorCreate, VisitorUpdate, VisitorResponse

router = APIRouter()


@router.get("/", response_model=List[VisitorResponse])
def list_visitors(
    status: Optional[str] = Query(None, description="WHITELISTED|BLACKLISTED|WATCHLIST|PENDING"),
    search: Optional[str] = Query(None, description="Search by name or passport"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """List visitors with optional status filter and name/passport search."""
    query = db.query(Visitor)
    if status:
        query = query.filter(Visitor.status == status)
    if search:
        query = query.filter(
            (Visitor.fullname.ilike(f"%{search}%")) |
            (Visitor.passport_number.ilike(f"%{search}%"))
        )
    return query.order_by(Visitor.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/watchlist", response_model=List[VisitorResponse])
def get_watchlist(db: Session = Depends(get_db)):
    """Return all BLACKLISTED and WATCHLIST visitors (used by processing pipeline)."""
    return (
        db.query(Visitor)
        .filter(Visitor.status.in_(["BLACKLISTED", "WATCHLIST"]))
        .all()
    )


@router.get("/{visitor_id}", response_model=VisitorResponse)
def get_visitor(visitor_id: int, db: Session = Depends(get_db)):
    visitor = db.query(Visitor).filter(Visitor.id == visitor_id).first()
    if not visitor:
        raise HTTPException(status_code=404, detail="Visitor not found")
    return visitor


@router.post("/", response_model=VisitorResponse, status_code=201)
def create_visitor(
    visitor_in: VisitorCreate,
    db: Session = Depends(get_db),
):
    """Enroll a new visitor into the system."""
    db_visitor = Visitor(**visitor_in.model_dump())
    db.add(db_visitor)
    db.commit()
    db.refresh(db_visitor)
    return db_visitor


@router.patch("/{visitor_id}", response_model=VisitorResponse)
def update_visitor(
    visitor_id: int,
    visitor_in: VisitorUpdate,
    db: Session = Depends(get_db),
):
    """Update visitor record (e.g., change status from PENDING to BLACKLISTED)."""
    visitor = db.query(Visitor).filter(Visitor.id == visitor_id).first()
    if not visitor:
        raise HTTPException(status_code=404, detail="Visitor not found")

    update_data = visitor_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(visitor, field, value)

    db.commit()
    db.refresh(visitor)
    return visitor


@router.patch("/{visitor_id}/status", response_model=VisitorResponse)
def set_visitor_status(
    visitor_id: int,
    status: str = Query(..., description="New status: WHITELISTED|BLACKLISTED|WATCHLIST|PENDING"),
    db: Session = Depends(get_db),
):
    """Quick status change (e.g., move from PENDING to BLACKLISTED after review)."""
    allowed = {"WHITELISTED", "BLACKLISTED", "WATCHLIST", "PENDING"}
    if status not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed: {allowed}")

    visitor = db.query(Visitor).filter(Visitor.id == visitor_id).first()
    if not visitor:
        raise HTTPException(status_code=404, detail="Visitor not found")

    visitor.status = status
    db.commit()
    db.refresh(visitor)
    return visitor


@router.post("/{visitor_id}/photo", response_model=VisitorResponse)
async def upload_visitor_photo(
    visitor_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload a face photo for a visitor (used by face enrollment pipeline)."""
    visitor = db.query(Visitor).filter(Visitor.id == visitor_id).first()
    if not visitor:
        raise HTTPException(status_code=404, detail="Visitor not found")

    allowed_types = {"image/png", "image/jpeg", "image/jpg"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only PNG/JPG images are accepted")

    os.makedirs("assets/visitors", exist_ok=True)
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "jpg"
    filename = f"visitor_{visitor_id}_{uuid.uuid4().hex[:8]}.{ext}"
    file_path = os.path.join("assets/visitors", filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    visitor.photo_path = f"/assets/visitors/{filename}"
    db.commit()
    db.refresh(visitor)
    return visitor


@router.delete("/{visitor_id}", status_code=204)
def delete_visitor(visitor_id: int, db: Session = Depends(get_db)):
    visitor = db.query(Visitor).filter(Visitor.id == visitor_id).first()
    if not visitor:
        raise HTTPException(status_code=404, detail="Visitor not found")
    db.delete(visitor)
    db.commit()
