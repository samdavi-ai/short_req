"""Tracks API — Active person track queries and cross-camera journey retrieval."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, timezone, timedelta

from app.core.database import get_db
from app.models.models import ActiveTrack
from app.schemas.schemas import TrackResponse, TrackJourney

router = APIRouter()


@router.get("/", response_model=List[TrackResponse])
def list_active_tracks(
    camera_id: Optional[int] = Query(None),
    is_active: bool = Query(True),
    db: Session = Depends(get_db),
):
    """List currently active tracks, optionally filtered by camera."""
    query = db.query(ActiveTrack).filter(ActiveTrack.is_active == is_active)
    if camera_id is not None:
        query = query.filter(ActiveTrack.camera_id == camera_id)
    return query.order_by(ActiveTrack.last_seen.desc()).all()


@router.get("/count")
def count_active_tracks(db: Session = Depends(get_db)):
    """Return the current count of active tracks (real-time person count)."""
    count = db.query(ActiveTrack).filter(ActiveTrack.is_active == True).count()
    return {"active_count": count}


@router.get("/global/{global_id}", response_model=TrackJourney)
def get_track_journey(global_id: str, db: Session = Depends(get_db)):
    """
    Get the full cross-camera journey for a given global_id.
    Returns all track segments across cameras, ordered by first_seen.
    """
    segments = (
        db.query(ActiveTrack)
        .filter(ActiveTrack.global_id == global_id)
        .order_by(ActiveTrack.first_seen.asc())
        .all()
    )
    if not segments:
        raise HTTPException(
            status_code=404,
            detail=f"No tracks found for global ID: {global_id}",
        )

    return TrackJourney(
        global_id=global_id,
        total_cameras_seen=len(set(s.camera_id for s in segments if s.camera_id)),
        first_seen=segments[0].first_seen,
        last_seen=segments[-1].last_seen,
        track_segments=segments,
    )


@router.get("/{track_id}", response_model=TrackResponse)
def get_track(track_id: str, db: Session = Depends(get_db)):
    """Get a single track by its local ID."""
    track = db.query(ActiveTrack).filter(ActiveTrack.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    return track


@router.delete("/stale", status_code=200)
def purge_stale_tracks(
    older_than_hours: int = Query(24, ge=1),
    db: Session = Depends(get_db),
):
    """
    Mark tracks as inactive if last_seen is older than N hours.
    Called periodically by Celery or manually by operator.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=older_than_hours)
    updated = (
        db.query(ActiveTrack)
        .filter(ActiveTrack.is_active == True, ActiveTrack.last_seen < cutoff)
        .all()
    )
    for track in updated:
        track.is_active = False
    db.commit()
    return {"deactivated_count": len(updated)}
