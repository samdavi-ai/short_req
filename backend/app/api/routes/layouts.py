"""Layouts API — Floor plan management with camera positions."""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from typing import List
import os
import shutil
import uuid

from app.core.database import get_db
from app.core.config import settings
from app.models.models import Layout, Camera
from app.schemas.schemas import LayoutCreate, LayoutUpdate, LayoutResponse, CameraResponse

router = APIRouter()


@router.get("/", response_model=List[LayoutResponse])
def list_layouts(db: Session = Depends(get_db)):
    """List all floor layouts ordered by floor number."""
    return db.query(Layout).order_by(Layout.floor_num).all()


@router.get("/{floor_num}", response_model=LayoutResponse)
def get_layout(floor_num: int, db: Session = Depends(get_db)):
    """Get layout for a specific floor."""
    layout = db.query(Layout).filter(Layout.floor_num == floor_num).first()
    if not layout:
        raise HTTPException(status_code=404, detail=f"No layout found for floor {floor_num}")
    return layout


@router.post("/", response_model=LayoutResponse, status_code=201)
def create_layout(layout_in: LayoutCreate, db: Session = Depends(get_db)):
    """Create a new floor layout entry."""
    existing = db.query(Layout).filter(Layout.floor_num == layout_in.floor_num).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Layout for floor {layout_in.floor_num} already exists. Use PUT to update.",
        )
    db_layout = Layout(**layout_in.model_dump())
    db.add(db_layout)
    db.commit()
    db.refresh(db_layout)
    return db_layout


@router.patch("/{floor_num}", response_model=LayoutResponse)
def update_layout(
    floor_num: int,
    layout_in: LayoutUpdate,
    db: Session = Depends(get_db),
):
    """Update layout properties for a floor."""
    layout = db.query(Layout).filter(Layout.floor_num == floor_num).first()
    if not layout:
        raise HTTPException(status_code=404, detail=f"No layout found for floor {floor_num}")

    update_data = layout_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(layout, field, value)

    db.commit()
    db.refresh(layout)
    return layout


@router.post("/{floor_num}/upload", response_model=LayoutResponse)
async def upload_layout_image(
    floor_num: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Upload a floor plan image (PNG/JPG) for a given floor.
    Saves the file to the assets/layouts directory and updates the DB record.
    """
    # Validate file type
    allowed_types = {"image/png", "image/jpeg", "image/jpg", "image/webp"}
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type '{file.content_type}'. Allowed: PNG, JPG, WEBP.",
        )

    # Ensure storage dir exists
    os.makedirs(settings.LAYOUTS_DIR, exist_ok=True)

    # Save with unique filename to avoid overwrites
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "png"
    filename = f"floor_{floor_num}_{uuid.uuid4().hex[:8]}.{ext}"
    file_path = os.path.join(settings.LAYOUTS_DIR, filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Upsert the layout record
    layout = db.query(Layout).filter(Layout.floor_num == floor_num).first()
    if layout:
        layout.image_path = f"/assets/layouts/{filename}"
    else:
        layout = Layout(
            floor_num=floor_num,
            image_path=f"/assets/layouts/{filename}",
        )
        db.add(layout)

    db.commit()
    db.refresh(layout)
    return layout


@router.get("/{floor_num}/cameras", response_model=List[CameraResponse])
def get_cameras_on_floor(floor_num: int, db: Session = Depends(get_db)):
    """Get all cameras positioned on a specific floor (for Layout Editor rendering)."""
    cameras = db.query(Camera).filter(Camera.floor == floor_num).order_by(Camera.id).all()
    return cameras


@router.delete("/{floor_num}", status_code=204)
def delete_layout(floor_num: int, db: Session = Depends(get_db)):
    """Delete a floor layout."""
    layout = db.query(Layout).filter(Layout.floor_num == floor_num).first()
    if not layout:
        raise HTTPException(status_code=404, detail=f"No layout for floor {floor_num}")
    db.delete(layout)
    db.commit()
