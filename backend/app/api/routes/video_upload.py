"""
Video Upload Route — Register an uploaded MP4 as a temporary camera
so the existing PipelineManager auto-discovers it and streams TRACK_UPDATE
events over WebSocket exactly like a live RTSP feed.
"""

import os
import uuid
import logging
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Camera, CameraStatus

logger = logging.getLogger(__name__)
router = APIRouter()

# Directory where uploaded test videos are saved
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "..", "assets", "uploads")


def _ensure_upload_dir():
    os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/", status_code=201)
async def upload_test_video(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Upload an MP4 file and register it as an ACTIVE temporary camera.

    The PipelineManager polls for new ACTIVE cameras every 10 s, so within
    10 seconds a full inference pipeline will be spawned for this video and
    TRACK_UPDATE events will arrive over WebSocket.

    Returns:
        {camera_id, camera_name, file_path, message}
    """
    if not file.filename or not file.filename.lower().endswith(".mp4"):
        raise HTTPException(status_code=400, detail="Only .mp4 files are supported.")

    _ensure_upload_dir()

    # Save with a unique prefix to avoid collisions
    safe_name = f"{uuid.uuid4().hex[:8]}_{file.filename}"
    save_path = os.path.join(UPLOAD_DIR, safe_name)

    try:
        contents = await file.read()
        with open(save_path, "wb") as f:
            f.write(contents)
        logger.info("Uploaded test video saved: %s (%d bytes)", save_path, len(contents))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")

    # Check for duplicate rtsp_url (same path already registered)
    existing = db.query(Camera).filter(Camera.rtsp_url == save_path).first()
    if existing:
        return {
            "camera_id": existing.id,
            "camera_name": existing.name,
            "file_path": save_path,
            "message": "Video already registered. Pipeline should already be running.",
        }

    # Register as a temporary camera (PipelineManager will auto-pick this up)
    cam_name = f"[TEST] {file.filename}"
    db_camera = Camera(
        name=cam_name,
        rtsp_url=save_path,
        location="Test Upload",
        description=f"Uploaded test video: {file.filename}",
        floor=1,
        status=CameraStatus.ACTIVE,
        is_overhead=False,
    )
    db.add(db_camera)
    db.commit()
    db.refresh(db_camera)

    logger.info("Registered test camera %d → %s", db_camera.id, save_path)

    return {
        "camera_id": db_camera.id,
        "camera_name": cam_name,
        "file_path": save_path,
        "message": (
            "Camera registered. The AI pipeline will start within ~10 seconds. "
            "Switch to Live Feeds and click the new camera tile to see detections."
        ),
    }


@router.delete("/{camera_id}", status_code=200)
def delete_test_video(camera_id: int, db: Session = Depends(get_db)):
    """
    Mark an uploaded test camera as OFFLINE and delete its video file.
    """
    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=404, detail=f"Camera {camera_id} not found.")

    file_path = camera.rtsp_url

    # Mark offline so pipeline stops processing
    camera.status = CameraStatus.OFFLINE
    db.commit()

    # Delete file if it's inside our upload dir
    if file_path and UPLOAD_DIR in file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
            logger.info("Deleted uploaded video file: %s", file_path)
        except Exception as e:
            logger.warning("Could not delete file %s: %s", file_path, e)

    return {"message": f"Camera {camera_id} marked offline. File removed."}
