"""Zones API — Polygon zone management for dwell, restricted, tripwire areas."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.models.models import Zone
from app.schemas.schemas import ZoneCreate, ZoneUpdate, ZoneResponse

router = APIRouter()


@router.get("/", response_model=List[ZoneResponse])
def list_zones(
    floor: Optional[int] = Query(None, description="Filter by floor"),
    zone_type: Optional[str] = Query(None, description="Filter by type: DWELL|TRIPWIRE|RESTRICTED|LOUNGE"),
    active_only: bool = Query(False, description="Return only active zones (default: False = return all)"),
    building_id: Optional[int] = Query(None, description="Filter by building"),
    db: Session = Depends(get_db),
):
    """List all configured zones with optional filters."""
    query = db.query(Zone)
    if floor is not None:
        query = query.filter(Zone.floor == floor)
    if zone_type:
        query = query.filter(Zone.zone_type == zone_type)
    if active_only:
        query = query.filter(Zone.is_active == True)
    if building_id is not None:
        query = query.filter(Zone.building_id == building_id)
    return query.order_by(Zone.floor, Zone.id).all()


@router.get("/{zone_id}", response_model=ZoneResponse)
def get_zone(zone_id: int, db: Session = Depends(get_db)):
    """Get a single zone by ID."""
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail=f"Zone {zone_id} not found")
    return zone


@router.post("/", response_model=ZoneResponse, status_code=201)
def create_zone(zone_in: ZoneCreate, db: Session = Depends(get_db)):
    """Create a new zone polygon."""
    db_zone = Zone(
        name=zone_in.name,
        floor=zone_in.floor,
        coordinates=[c.model_dump() for c in zone_in.coordinates],
        zone_type=zone_in.zone_type,
        dwell_alert_seconds=zone_in.dwell_alert_seconds,
        color=zone_in.color,
        is_active=zone_in.is_active,
    )
    db.add(db_zone)
    db.commit()
    db.refresh(db_zone)
    return db_zone


@router.patch("/{zone_id}", response_model=ZoneResponse)
def update_zone(
    zone_id: int,
    zone_in: ZoneUpdate,
    db: Session = Depends(get_db),
):
    """Partially update zone properties (e.g., redraw polygon, update alert threshold)."""
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail=f"Zone {zone_id} not found")

    update_data = zone_in.model_dump(exclude_unset=True)
    if "coordinates" in update_data and update_data["coordinates"]:
        update_data["coordinates"] = [c.model_dump() for c in update_data["coordinates"]]

    for field, value in update_data.items():
        setattr(zone, field, value)

    db.commit()
    db.refresh(zone)
    return zone


@router.delete("/{zone_id}", status_code=204)
def delete_zone(zone_id: int, db: Session = Depends(get_db)):
    """Delete a zone."""
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail=f"Zone {zone_id} not found")
    db.delete(zone)
    db.commit()


@router.patch("/{zone_id}/toggle", response_model=ZoneResponse)
def toggle_zone_active(zone_id: int, db: Session = Depends(get_db)):
    """Toggle zone active/inactive state."""
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail=f"Zone {zone_id} not found")
    zone.is_active = not zone.is_active
    db.commit()
    db.refresh(zone)
    return zone
