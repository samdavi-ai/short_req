"""Sites API — Multi-site management for distributed camera systems."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List

from app.core.database import get_db
from app.models.models import Site, Building
from app.schemas.schemas import (
    SiteCreate, SiteUpdate, SiteResponse, SiteWithBuildingsResponse,
)

router = APIRouter()


@router.get("/", response_model=List[SiteResponse])
def list_sites(db: Session = Depends(get_db)):
    """List all sites."""
    return db.query(Site).order_by(Site.name).all()


@router.get("/{site_id}", response_model=SiteWithBuildingsResponse)
def get_site(site_id: int, db: Session = Depends(get_db)):
    """Get a site with all its buildings and floors."""
    site = (
        db.query(Site)
        .options(joinedload(Site.buildings).joinedload(Building.floors))
        .filter(Site.id == site_id)
        .first()
    )
    if not site:
        raise HTTPException(status_code=404, detail=f"Site {site_id} not found")
    return site


@router.post("/", response_model=SiteResponse, status_code=201)
def create_site(site_in: SiteCreate, db: Session = Depends(get_db)):
    """Create a new site."""
    existing = db.query(Site).filter(Site.name == site_in.name).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Site '{site_in.name}' already exists")
    db_site = Site(**site_in.model_dump())
    db.add(db_site)
    db.commit()
    db.refresh(db_site)
    return db_site


@router.patch("/{site_id}", response_model=SiteResponse)
def update_site(site_id: int, site_in: SiteUpdate, db: Session = Depends(get_db)):
    """Update site properties."""
    site = db.query(Site).filter(Site.id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail=f"Site {site_id} not found")
    for field, value in site_in.model_dump(exclude_unset=True).items():
        setattr(site, field, value)
    db.commit()
    db.refresh(site)
    return site


@router.delete("/{site_id}", status_code=204)
def delete_site(site_id: int, db: Session = Depends(get_db)):
    """Delete a site and all its buildings (cascade)."""
    site = db.query(Site).filter(Site.id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail=f"Site {site_id} not found")
    db.delete(site)
    db.commit()
