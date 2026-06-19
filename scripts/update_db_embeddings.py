import os
import sys
import cv2
import numpy as np
import json
import sqlite3

# Set the environment variable BEFORE importing app.core.database
os.environ["DATABASE_URL"] = "sqlite:///backend/db.sqlite3"

project_dir = "/Users/samdavi/projects/short_req"
sys.path.insert(0, os.path.join(project_dir, "backend"))
sys.path.insert(0, os.path.join(project_dir, "processing"))

from app.core.database import SessionLocal
from app.models.models import Visitor
from workers.person_detector import PersonDetector
from workers.face_detector import FaceDetector
from workers.face_embedder import FaceEmbedder
from utils.database_logger import DB_PATH, enroll_identity

def extract_from_frame(video_name, target_frame):
    video_path = os.path.join(project_dir, "tests", video_name)
    cap = cv2.VideoCapture(video_path)
    
    person_detector = PersonDetector()
    face_detector = FaceDetector()
    embedder = FaceEmbedder(face_detector=face_detector)
    
    frame_idx = 0
    embedding = None
    
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        frame_idx += 1
        
        person_boxes = person_detector.detect_and_track(frame)
        
        if frame_idx == target_frame:
            best_area = -1
            best_emb = None
            
            for p in person_boxes:
                bbox = p.get("bbox")
                x1, y1, x2, y2 = bbox
                h, w = frame.shape[:2]
                x1, y1 = max(0, int(x1)), max(0, int(y1))
                x2, y2 = min(w, int(x2)), min(h, int(y2))
                person_crop = frame[y1:y2, x1:x2]
                
                face_bbox = face_detector.detect_faces(person_crop)
                if face_bbox is not None:
                    fx1, fy1, fx2, fy2 = face_bbox
                    ph, pw = person_crop.shape[:2]
                    fx1, fy1 = max(0, fx1), max(0, fy1)
                    fx2, fy2 = min(pw, fx2), min(ph, fy2)
                    face_crop = person_crop[fy1:fy2, fx1:fx2]
                    
                    emb = embedder.extract_embedding(face_crop)
                    area = (x2 - x1) * (y2 - y1)
                    if area > best_area:
                        best_area = area
                        best_emb = emb
            
            embedding = best_emb
            break
            
    cap.release()
    return embedding

def main():
    targets = [
        ("john", "SS2.mp4", 90),
        ("ponniyah", "SS3.mp4", 555),
        ("dinesh", "MS2.mp4", 675)
    ]
    
    extracted_data = {}
    for name, video, frame in targets:
        print(f"Extracting for {name} from {video} frame {frame}...")
        emb = extract_from_frame(video, frame)
        if emb is not None:
            extracted_data[name] = emb
            print(f"  Success: sum={np.array(emb).sum():.6f}")
        else:
            print(f"  [ERROR] Failed to extract for {name}")
            return

    # 1. Update backend/db.sqlite3 via SQLAlchemy
    print("\nUpdating backend/db.sqlite3 visitors table...")
    db = SessionLocal()
    try:
        for name, emb in extracted_data.items():
            visitor = db.query(Visitor).filter(Visitor.fullname == name).first()
            if visitor:
                visitor.face_embedding_id = json.dumps(emb)
                db.commit()
                print(f"  Updated visitor {name} embedding in db.sqlite3")
            else:
                print(f"  [ERROR] Visitor {name} not found in db.sqlite3")
    except Exception as e:
        print(f"  Error updating db.sqlite3: {e}")
        db.rollback()
    finally:
        db.close()

    # 2. Sync to database.db enrolled_identities
    print("\nUpdating database.db enrolled_identities table...")
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("DELETE FROM enrolled_identities")
        conn.commit()
        
    for name, emb in extracted_data.items():
        # Get photo_path from backend/db.sqlite3 to keep it in sync
        db = SessionLocal()
        v = db.query(Visitor).filter(Visitor.fullname == name).first()
        photo_path = v.photo_path if v else f"assets/visitors/face_{name}.jpg"
        db.close()
        
        enroll_identity(
            name=name,
            face_vector=emb,
            body_vector=None,
            photo_path=photo_path
        )
        print(f"  Enrolled {name} in database.db")

    print("\nDatabase update and synchronization completed successfully ✓")

if __name__ == "__main__":
    main()
