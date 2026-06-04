"""
TrackService — Active track persistence and cross-camera journey queries.

Handles batch upserts from the processing pipeline and provides
journey history for the frontend PersonJourney component.
"""

from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.models import ActiveTrack
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict
import uuid
import logging

logger = logging.getLogger(__name__)


class TrackService:
    @staticmethod
    def register_track(db: Session, camera_id: int, local_track_id: int,
                       global_id: str = None, x: float = None, y: float = None,
                       matched_visitor_id: int = None,
                       matched_employee_id: int = None) -> ActiveTrack:
        """Create or update a single track record."""
        track_id = f"cam_{camera_id}_track_{local_track_id}"
        db_track = db.query(ActiveTrack).filter(ActiveTrack.id == track_id).first()

        if db_track:
            db_track.last_seen = datetime.now(timezone.utc)
            db_track.last_x = x
            db_track.last_y = y
            db_track.is_active = True
            if global_id:
                db_track.global_id = global_id
            if matched_visitor_id:
                db_track.matched_visitor_id = matched_visitor_id
            if matched_employee_id:
                db_track.matched_employee_id = matched_employee_id
        else:
            db_track = ActiveTrack(
                id=track_id,
                camera_id=camera_id,
                global_id=global_id or str(uuid.uuid4()),
                local_track_id=local_track_id,
                last_x=x,
                last_y=y,
                is_active=True,
                matched_visitor_id=matched_visitor_id,
                matched_employee_id=matched_employee_id,
            )
            db.add(db_track)

        db.commit()
        db.refresh(db_track)
        return db_track

    @staticmethod
    def upsert_track_batch(db: Session, tracks: List[Dict]) -> int:
        """
        Batch upsert track records from the processing pipeline.

        Args:
            tracks: list of dicts with keys:
                camera_id, track_id, global_id, x, y,
                matched_visitor_id, matched_employee_id

        Returns:
            Number of tracks processed.
        """
        count = 0
        for t in tracks:
            try:
                track_id = f"cam_{t['camera_id']}_track_{t['track_id']}"
                existing = db.query(ActiveTrack).filter(ActiveTrack.id == track_id).first()

                if existing:
                    existing.last_seen = datetime.now(timezone.utc)
                    existing.last_x = t.get("x")
                    existing.last_y = t.get("y")
                    existing.is_active = True
                    existing.global_id = t.get("global_id", existing.global_id)
                    if t.get("matched_visitor_id"):
                        existing.matched_visitor_id = t["matched_visitor_id"]
                    if t.get("matched_employee_id"):
                        existing.matched_employee_id = t["matched_employee_id"]
                else:
                    new_track = ActiveTrack(
                        id=track_id,
                        camera_id=t["camera_id"],
                        global_id=t.get("global_id", str(uuid.uuid4())),
                        local_track_id=t.get("track_id"),
                        last_x=t.get("x"),
                        last_y=t.get("y"),
                        is_active=True,
                        matched_visitor_id=t.get("matched_visitor_id"),
                        matched_employee_id=t.get("matched_employee_id"),
                    )
                    db.add(new_track)
                count += 1

            except Exception as e:
                logger.error("Failed to upsert track: %s", e)

        db.commit()
        return count

    @staticmethod
    def get_person_journey(db: Session, global_id: str) -> Optional[Dict]:
        """
        Get the full cross-camera journey for a global_id.

        Returns:
            dict: {
                global_id, total_cameras_seen, first_seen, last_seen,
                total_duration_seconds, segments: [...]
            }
        """
        segments = (
            db.query(ActiveTrack)
            .filter(ActiveTrack.global_id == global_id)
            .order_by(ActiveTrack.first_seen.asc())
            .all()
        )

        if not segments:
            return None

        cameras_seen = set()
        journey_segments = []

        for seg in segments:
            if seg.camera_id:
                cameras_seen.add(seg.camera_id)
            journey_segments.append({
                "id": seg.id,
                "camera_id": seg.camera_id,
                "local_track_id": seg.local_track_id,
                "first_seen": seg.first_seen.isoformat() if seg.first_seen else None,
                "last_seen": seg.last_seen.isoformat() if seg.last_seen else None,
                "last_x": seg.last_x,
                "last_y": seg.last_y,
                "is_active": seg.is_active,
                "matched_visitor_id": seg.matched_visitor_id,
                "matched_employee_id": seg.matched_employee_id,
            })

        first = segments[0].first_seen
        last = segments[-1].last_seen
        duration = (last - first).total_seconds() if first and last else 0

        return {
            "global_id": global_id,
            "total_cameras_seen": len(cameras_seen),
            "first_seen": first.isoformat() if first else None,
            "last_seen": last.isoformat() if last else None,
            "total_duration_seconds": round(duration, 1),
            "segments": journey_segments,
        }

    @staticmethod
    def deactivate_stale_tracks(db: Session, older_than_hours: int = 24) -> int:
        """Mark tracks as inactive if not seen recently."""
        cutoff = datetime.now(timezone.utc) - timedelta(hours=older_than_hours)
        stale = (
            db.query(ActiveTrack)
            .filter(ActiveTrack.is_active == True, ActiveTrack.last_seen < cutoff)
            .all()
        )
        for track in stale:
            track.is_active = False
        db.commit()
        return len(stale)
