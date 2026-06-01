from sqlalchemy.orm import Session
from app.models.models import ActiveTrack
import uuid
from datetime import datetime

class TrackService:
    @staticmethod
    def register_track(db: Session, camera_id: int, local_track_id: int, global_id: str = None) -> ActiveTrack:
        # Create a new track or update the existing one
        track_id = f"cam_{camera_id}_track_{local_track_id}"
        db_track = db.query(ActiveTrack).filter(ActiveTrack.id == track_id).first()
        
        if not db_track:
            db_track = ActiveTrack(
                id=track_id,
                camera_id=camera_id,
                global_id=global_id or str(uuid.uuid4()),
                is_active=True
            )
            db.add(db_track)
        else:
            db_track.last_seen = datetime.utcnow()
            db_track.is_active = True
            
        db.commit()
        db.refresh(db_track)
        return db_track
