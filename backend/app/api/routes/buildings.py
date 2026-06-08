"""Buildings API — Building and floor management within sites."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional

from app.core.database import get_db
from app.models.models import Building, FloorLevel, Site
from app.schemas.schemas import (
    BuildingCreate, BuildingUpdate, BuildingResponse,
    FloorCreate, FloorUpdate, FloorResponse,
)

router = APIRouter()


# ─── Buildings ────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[BuildingResponse])
def list_buildings(
    site_id: Optional[int] = Query(None, description="Filter by site"),
    db: Session = Depends(get_db),
):
    """List buildings, optionally filtered by site."""
    query = db.query(Building).options(joinedload(Building.floors))
    if site_id is not None:
        query = query.filter(Building.site_id == site_id)
    return query.order_by(Building.site_id, Building.name).all()


@router.get("/{building_id}", response_model=BuildingResponse)
def get_building(building_id: int, db: Session = Depends(get_db)):
    """Get a single building with its floors."""
    building = (
        db.query(Building)
        .options(joinedload(Building.floors))
        .filter(Building.id == building_id)
        .first()
    )
    if not building:
        raise HTTPException(status_code=404, detail=f"Building {building_id} not found")
    return building


@router.post("/", response_model=BuildingResponse, status_code=201)
def create_building(bldg_in: BuildingCreate, db: Session = Depends(get_db)):
    """Create a new building within a site."""
    site = db.query(Site).filter(Site.id == bldg_in.site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail=f"Site {bldg_in.site_id} not found")

    db_bldg = Building(**bldg_in.model_dump())
    db.add(db_bldg)
    db.flush()  # get the id

    # Auto-create a default ground floor for new buildings
    default_floor = FloorLevel(
        building_id=db_bldg.id,
        level=0,
        label="Ground",
        sort_order=0,
    )
    db.add(default_floor)
    db.commit()
    db.refresh(db_bldg)
    return db_bldg


@router.patch("/{building_id}", response_model=BuildingResponse)
def update_building(
    building_id: int,
    bldg_in: BuildingUpdate,
    db: Session = Depends(get_db),
):
    """Update building properties."""
    building = db.query(Building).filter(Building.id == building_id).first()
    if not building:
        raise HTTPException(status_code=404, detail=f"Building {building_id} not found")
    for field, value in bldg_in.model_dump(exclude_unset=True).items():
        setattr(building, field, value)
    db.commit()
    db.refresh(building)
    return building


@router.delete("/{building_id}", status_code=204)
def delete_building(building_id: int, db: Session = Depends(get_db)):
    """Delete a building and all its floors (cascade)."""
    building = db.query(Building).filter(Building.id == building_id).first()
    if not building:
        raise HTTPException(status_code=404, detail=f"Building {building_id} not found")
    db.delete(building)
    db.commit()


# ─── Floors ───────────────────────────────────────────────────────────────────

@router.get("/{building_id}/floors", response_model=List[FloorResponse])
def list_floors(building_id: int, db: Session = Depends(get_db)):
    """List all floors for a building."""
    building = db.query(Building).filter(Building.id == building_id).first()
    if not building:
        raise HTTPException(status_code=404, detail=f"Building {building_id} not found")
    return (
        db.query(FloorLevel)
        .filter(FloorLevel.building_id == building_id)
        .order_by(FloorLevel.sort_order)
        .all()
    )


@router.post("/{building_id}/floors", response_model=FloorResponse, status_code=201)
def create_floor(
    building_id: int,
    floor_in: FloorCreate,
    db: Session = Depends(get_db),
):
    """Add a floor to a building."""
    building = db.query(Building).filter(Building.id == building_id).first()
    if not building:
        raise HTTPException(status_code=404, detail=f"Building {building_id} not found")

    # Check for duplicate level in same building
    existing = (
        db.query(FloorLevel)
        .filter(FloorLevel.building_id == building_id, FloorLevel.level == floor_in.level)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Floor level {floor_in.level} already exists in this building",
        )

    db_floor = FloorLevel(building_id=building_id, **floor_in.model_dump())
    db.add(db_floor)
    db.commit()
    db.refresh(db_floor)
    return db_floor


@router.patch("/{building_id}/floors/{floor_id}", response_model=FloorResponse)
def update_floor(
    building_id: int,
    floor_id: int,
    floor_in: FloorUpdate,
    db: Session = Depends(get_db),
):
    """Update floor properties (label, sort order)."""
    floor = (
        db.query(FloorLevel)
        .filter(FloorLevel.id == floor_id, FloorLevel.building_id == building_id)
        .first()
    )
    if not floor:
        raise HTTPException(status_code=404, detail=f"Floor {floor_id} not found in building {building_id}")
    for field, value in floor_in.model_dump(exclude_unset=True).items():
        setattr(floor, field, value)
    db.commit()
    db.refresh(floor)
    return floor


@router.delete("/{building_id}/floors/{floor_id}", status_code=204)
def delete_floor(building_id: int, floor_id: int, db: Session = Depends(get_db)):
    """Delete a floor from a building."""
    floor = (
        db.query(FloorLevel)
        .filter(FloorLevel.id == floor_id, FloorLevel.building_id == building_id)
        .first()
    )
    if not floor:
        raise HTTPException(status_code=404, detail=f"Floor {floor_id} not found in building {building_id}")
    db.delete(floor)
    db.commit()
