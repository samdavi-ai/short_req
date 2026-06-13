"""Cameras API — Full CRUD + bulk position update for Layout Editor."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.models.models import Camera, CameraStatus as CameraStatusEnum
from app.schemas.schemas import (
    CameraCreate, CameraUpdate, CameraResponse,
    BulkCameraPositionUpdate,
)

router = APIRouter()


@router.get("/", response_model=List[CameraResponse])
def list_cameras(
    floor: Optional[int] = Query(None, description="Filter by floor number"),
    status: Optional[str] = Query(None, description="Filter by status"),
    building_id: Optional[int] = Query(None, description="Filter by building"),
    db: Session = Depends(get_db),
):
    """List all cameras with optional filters."""
    query = db.query(Camera)
    if floor is not None:
        query = query.filter(Camera.floor == floor)
    if status:
        query = query.filter(Camera.status == status)
    if building_id is not None:
        query = query.filter(Camera.building_id == building_id)
    return query.order_by(Camera.floor, Camera.id).all()


@router.get("/{camera_id}", response_model=CameraResponse)
def get_camera(camera_id: int, db: Session = Depends(get_db)):
    """Get a single camera by ID."""
    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=404, detail=f"Camera {camera_id} not found")
    return camera


@router.post("/", response_model=CameraResponse, status_code=201)
def create_camera(camera_in: CameraCreate, db: Session = Depends(get_db)):
    """Register a new camera."""
    # Check for duplicate RTSP URL
    existing = db.query(Camera).filter(Camera.rtsp_url == camera_in.rtsp_url).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"A camera with RTSP URL '{camera_in.rtsp_url}' already exists (id={existing.id})",
        )

    db_camera = Camera(**camera_in.model_dump())
    db.add(db_camera)
    db.commit()
    db.refresh(db_camera)
    return db_camera


@router.patch("/{camera_id}", response_model=CameraResponse)
def update_camera(
    camera_id: int,
    camera_in: CameraUpdate,
    db: Session = Depends(get_db),
):
    """Partially update camera properties (PATCH semantics)."""
    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=404, detail=f"Camera {camera_id} not found")

    update_data = camera_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(camera, field, value)

    db.commit()
    db.refresh(camera)
    return camera


@router.delete("/{camera_id}", status_code=204)
def delete_camera(camera_id: int, db: Session = Depends(get_db)):
    """Delete a camera and its associated tracks."""
    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=404, detail=f"Camera {camera_id} not found")
    db.delete(camera)
    db.commit()


@router.post("/positions/bulk", response_model=List[CameraResponse])
def update_camera_positions(
    payload: BulkCameraPositionUpdate,
    db: Session = Depends(get_db),
):
    """
    Bulk-update camera (x, y, angle, floor) positions from the Layout Editor drag-drop.
    Processes all positions in a single transaction.
    """
    updated = []
    for pos in payload.positions:
        camera = db.query(Camera).filter(Camera.id == pos.camera_id).first()
        if not camera:
            raise HTTPException(status_code=404, detail=f"Camera {pos.camera_id} not found")
        camera.x_coord = pos.x_coord
        camera.y_coord = pos.y_coord
        camera.angle = pos.angle
        camera.floor = pos.floor
        updated.append(camera)

    db.commit()
    for cam in updated:
        db.refresh(cam)

    return updated


@router.patch("/{camera_id}/status", response_model=CameraResponse)
def set_camera_status(
    camera_id: int,
    status: str = Query(..., description="New status: ACTIVE | OFFLINE | MAINTENANCE | PAUSED"),
    db: Session = Depends(get_db),
):
    """Quick status update for a camera (e.g., mark as offline)."""
    if status not in [s.value for s in CameraStatusEnum]:
        raise HTTPException(status_code=400, detail=f"Invalid status '{status}'")

    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=404, detail=f"Camera {camera_id} not found")

    camera.status = status
    db.commit()
    db.refresh(camera)
    return camera
