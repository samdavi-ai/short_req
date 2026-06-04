"""
Enrollment API — Face enrollment for visitors and employees.

Provides endpoints to:
  1. Upload a face photo and extract a real face embedding
  2. Store the embedding vector in the person's record
  3. Preview the detected face crop before enrollment
"""

import os
import json
import uuid
import shutil
import logging
import numpy as np
import cv2

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Visitor, Employee

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Lazy-loaded face embedder (avoid loading model at import time) ─────────────
_face_embedder = None
_face_detector = None


def _get_face_embedder():
    """Lazy-initialize the face embedder to avoid heavy imports at startup."""
    global _face_embedder, _face_detector
    if _face_embedder is None:
        try:
            import sys
            # Add processing dir to path so workers can be imported
            proc_dir = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "processing")
            proc_dir = os.path.abspath(proc_dir)
            if proc_dir not in sys.path:
                sys.path.insert(0, proc_dir)

            from workers.face_embedder import FaceEmbedder
            from workers.face_detector import FaceDetector
            _face_embedder = FaceEmbedder()
            _face_detector = FaceDetector()
        except Exception as e:
            logger.error("Failed to initialize face embedder: %s", e)
            raise HTTPException(status_code=503, detail="Face embedding service unavailable")
    return _face_embedder, _face_detector


@router.post("/face/visitor/{visitor_id}")
async def enroll_visitor_face(
    visitor_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Upload a face photo for a visitor, extract real face embedding,
    and store it in the visitor record.

    Returns the detected face crop preview and embedding metadata.
    """
    visitor = db.query(Visitor).filter(Visitor.id == visitor_id).first()
    if not visitor:
        raise HTTPException(status_code=404, detail="Visitor not found")

    allowed_types = {"image/png", "image/jpeg", "image/jpg"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only PNG/JPG images are accepted")

    # Read and decode image
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Could not decode image")

    # Detect face
    embedder, detector = _get_face_embedder()
    face_bbox = detector.detect_faces(img)
    if face_bbox is None:
        raise HTTPException(
            status_code=422,
            detail="No face detected in the uploaded image. Please upload a clear frontal face photo."
        )

    # Extract face crop and embedding
    fx1, fy1, fx2, fy2 = face_bbox
    face_crop = img[fy1:fy2, fx1:fx2]
    embedding = embedder.extract_embedding(face_crop)

    if np.allclose(embedding, 0):
        raise HTTPException(status_code=422, detail="Face embedding extraction failed")

    # Save the photo
    os.makedirs("assets/visitors", exist_ok=True)
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "jpg"
    filename = f"visitor_{visitor_id}_{uuid.uuid4().hex[:8]}.{ext}"
    file_path = os.path.join("assets/visitors", filename)

    with open(file_path, "wb") as buffer:
        buffer.write(contents)

    # Save face crop preview
    crop_filename = f"visitor_{visitor_id}_face_{uuid.uuid4().hex[:8]}.jpg"
    crop_path = os.path.join("assets/visitors", crop_filename)
    cv2.imwrite(crop_path, face_crop)

    # Store embedding as JSON in the face_embedding_id field
    visitor.photo_path = f"/assets/visitors/{filename}"
    visitor.face_embedding_id = json.dumps(embedding)
    db.commit()
    db.refresh(visitor)

    return {
        "visitor_id": visitor.id,
        "fullname": visitor.fullname,
        "photo_path": visitor.photo_path,
        "face_crop_path": f"/assets/visitors/{crop_filename}",
        "embedding_dim": len(embedding),
        "face_bbox": face_bbox,
        "status": "enrolled",
    }


@router.post("/face/employee/{employee_id}")
async def enroll_employee_face(
    employee_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Upload a face photo for an employee, extract real face embedding,
    and store it in the employee record.
    """
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    allowed_types = {"image/png", "image/jpeg", "image/jpg"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only PNG/JPG images are accepted")

    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Could not decode image")

    embedder, detector = _get_face_embedder()
    face_bbox = detector.detect_faces(img)
    if face_bbox is None:
        raise HTTPException(
            status_code=422,
            detail="No face detected in the uploaded image. Please upload a clear frontal face photo."
        )

    fx1, fy1, fx2, fy2 = face_bbox
    face_crop = img[fy1:fy2, fx1:fx2]
    embedding = embedder.extract_embedding(face_crop)

    if np.allclose(embedding, 0):
        raise HTTPException(status_code=422, detail="Face embedding extraction failed")

    os.makedirs("assets/employees", exist_ok=True)
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "jpg"
    filename = f"employee_{employee_id}_{uuid.uuid4().hex[:8]}.{ext}"
    file_path = os.path.join("assets/employees", filename)

    with open(file_path, "wb") as buffer:
        buffer.write(contents)

    crop_filename = f"employee_{employee_id}_face_{uuid.uuid4().hex[:8]}.jpg"
    crop_path = os.path.join("assets/employees", crop_filename)
    cv2.imwrite(crop_path, face_crop)

    employee.photo_path = f"/assets/employees/{filename}"
    employee.face_embedding_id = json.dumps(embedding)
    db.commit()
    db.refresh(employee)

    return {
        "employee_id": employee.id,
        "fullname": employee.fullname,
        "employee_code": employee.employee_code,
        "photo_path": employee.photo_path,
        "face_crop_path": f"/assets/employees/{crop_filename}",
        "embedding_dim": len(embedding),
        "face_bbox": face_bbox,
        "status": "enrolled",
    }


@router.get("/status")
def enrollment_status(db: Session = Depends(get_db)):
    """
    Return how many visitors and employees have face embeddings enrolled.
    """
    visitors_total = db.query(Visitor).count()
    visitors_enrolled = db.query(Visitor).filter(
        Visitor.face_embedding_id.isnot(None),
        Visitor.face_embedding_id != "",
    ).count()

    employees_total = db.query(Employee).count()
    employees_enrolled = db.query(Employee).filter(
        Employee.face_embedding_id.isnot(None),
        Employee.face_embedding_id != "",
    ).count()

    return {
        "visitors": {"total": visitors_total, "enrolled": visitors_enrolled},
        "employees": {"total": employees_total, "enrolled": employees_enrolled},
        "total_enrolled": visitors_enrolled + employees_enrolled,
    }
