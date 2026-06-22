import os
import sys
import json
import numpy as np
import cv2
import sqlite3

# Add project root, backend, and processing dirs to path
base_dir = os.path.dirname(os.path.abspath(__file__))
project_dir = os.path.dirname(base_dir)
sys.path.insert(0, os.path.join(project_dir, "backend"))
sys.path.insert(0, os.path.join(project_dir, "processing"))

from app.core.database import SessionLocal
from app.models.models import Visitor, Employee
from workers.person_detector import PersonDetector
from workers.face_detector import FaceDetector
from workers.face_embedder import FaceEmbedder
from utils.database_logger import DB_PATH, enroll_identity

def extract_first_face(video_path, target_frame, person_detector, face_detector, face_embedder):
    if not os.path.exists(video_path):
        print(f"Warning: Test video not found at {video_path}")
        return None, None

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"Error: Could not open {video_path}")
        return None, None
        
    frame_idx = 0
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
            
        frame_idx += 1
        if frame_idx < target_frame:
            continue
        if frame_idx > target_frame:
            break
            
        # Detect person crops first, matching the camera pipeline
        tracked_objects = person_detector.detect_and_track(frame)
        best_area = -1
        best_emb = None
        best_crop = None
        
        for obj in tracked_objects:
            x1, y1, x2, y2 = obj["bbox"]
            h, w = frame.shape[:2]
            x1, y1 = max(0, int(x1)), max(0, int(y1))
            x2, y2 = min(w, int(x2)), min(h, int(y2))
            person_crop = frame[y1:y2, x1:x2]
            if person_crop.size == 0:
                continue

            # Detect face inside person crop
            face_bbox = face_detector.detect_faces(person_crop)
            if face_bbox is not None:
                fx1, fy1, fx2, fy2 = face_bbox
                ch, cw = person_crop.shape[:2]
                fx1, fy1 = max(0, fx1), max(0, fy1)
                fx2, fy2 = min(cw, fx2), min(ch, fy2)
                face_crop = person_crop[fy1:fy2, fx1:fx2]
                
                if face_crop.size > 0:
                    emb = face_embedder.extract_embedding(face_crop)
                    area = (x2 - x1) * (y2 - y1)
                    if area > best_area:
                        best_area = area
                        best_emb = emb
                        best_crop = face_crop
                        
        cap.release()
        if best_emb is not None:
            print(f"Successfully extracted face from {os.path.basename(video_path)} at frame {frame_idx} ✓")
            return best_emb, best_crop
        break
                
    cap.release()
    print(f"No face detected in {os.path.basename(video_path)} at frame {target_frame}.")
    return None, None

def seed_registry():
    print("Initializing Face AI Workers...")
    person_detector = PersonDetector()
    detector = FaceDetector()
    embedder = FaceEmbedder()
    
    db = SessionLocal()
    
    # Define real people to enroll
    # (video_filename, target_frame, fullname, code)
    test_enrollments = [
        ("SS2.mp4", 90, "john", "EMP-004"),
        ("SS3.mp4", 555, "ponniyah", "EMP-005"),
        ("MS2.mp4", 675, "dinesh", "EMP-006")
    ]
    
    tests_dir = os.path.join(project_dir, "tests")
    assets_dir = os.path.join(project_dir, "backend", "assets")
    
    # Ensure asset dirs exist
    os.makedirs(os.path.join(assets_dir, "visitors"), exist_ok=True)
    os.makedirs(os.path.join(assets_dir, "employees"), exist_ok=True)
    
    try:
        # Clear existing visitors and employees to clean up fake data
        print("Clearing existing visitors and employees from backend DB...")
        db.query(Visitor).delete()
        db.query(Employee).delete()
        db.commit()
        
        # Clear database.db enrolled_identities
        print("Clearing database.db enrolled_identities table...")
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute("DELETE FROM enrolled_identities")
            conn.commit()

        for filename, frame, name, identifier in test_enrollments:
            video_path = os.path.join(tests_dir, filename)
            print(f"\nProcessing {name} from {filename} frame {frame}...")
            
            embedding, face_crop = extract_first_face(video_path, frame, person_detector, detector, embedder)
            
            # If face extraction failed, fall back to a random stable unit vector
            if embedding is None:
                print(f"Using synthetic fallback vector for {name}...")
                embedding = np.random.normal(0, 0.1, 512)
                embedding /= np.linalg.norm(embedding)
                embedding = embedding.tolist()
                face_crop = np.zeros((112, 112, 3), dtype=np.uint8)
                cv2.putText(face_crop, "Fallback", (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

            # Save face crop image
            photo_name = f"employee_seeded_{identifier}.jpg"
            photo_path = os.path.join(assets_dir, "employees", photo_name)
            cv2.imwrite(photo_path, face_crop)
            
            emp = Employee(
                fullname=name,
                employee_code=identifier,
                department="Security Operations",
                shift="MORNING",
                photo_path=f"/assets/employees/{photo_name}",
                face_embedding_id=json.dumps(embedding.tolist() if isinstance(embedding, np.ndarray) else embedding),
                is_active=True
            )
            db.add(emp)
            print(f"Registered Employee: {name} ({identifier})")
            
            # Enroll in database.db enrolled_identities
            enroll_identity(
                name=name,
                face_vector=embedding.tolist() if isinstance(embedding, np.ndarray) else embedding,
                body_vector=None,
                photo_path=f"assets/employees/{photo_name}",
                person_type="EMPLOYEE"
            )
            print(f"Enrolled {name} in database.db")
            
            db.commit()
            
        print("\nDatabase seeding completed successfully ✓")
        
    except Exception as e:
        print(f"Seeding failed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_registry()
