import os
import sys
import json
import numpy as np
import cv2

# Add project root, backend, and processing dirs to path
base_dir = os.path.dirname(os.path.abspath(__file__))
project_dir = os.path.dirname(base_dir)
sys.path.insert(0, os.path.join(project_dir, "backend"))
sys.path.insert(0, os.path.join(project_dir, "processing"))

from app.core.database import SessionLocal, Base, engine
from app.models.models import Visitor, Employee, VisitorStatus
from workers.face_detector import FaceDetector
from workers.face_embedder import FaceEmbedder

def extract_first_face(video_path, detector, embedder):
    if not os.path.exists(video_path):
        print(f"Warning: Test video not found at {video_path}")
        return None, None

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"Error: Could not open {video_path}")
        return None, None
        
    frame_idx = 0
    max_frames = 1200 # scan up to 1200 frames (~40 seconds of video)
    while frame_idx < max_frames:
        ret, frame = cap.read()
        if not ret:
            break
            
        frame_idx += 1
        # Check every 4th frame for speed
        if frame_idx % 4 != 0:
            continue
            
        # Detect face
        face_bbox = detector.detect_faces(frame)
        if face_bbox is not None:
            fx1, fy1, fx2, fy2 = face_bbox
            h, w = frame.shape[:2]
            fx1, fy1 = max(0, fx1), max(0, fy1)
            fx2, fy2 = min(w, fx2), min(h, fy2)
            face_crop = frame[fy1:fy2, fx1:fx2]
            
            if face_crop.size > 0:
                print(f"Successfully extracted face from {os.path.basename(video_path)} at frame {frame_idx} ✓")
                embedding = embedder.extract_embedding(face_crop)
                cap.release()
                return embedding, face_crop
                
    cap.release()
    print(f"No face detected in {os.path.basename(video_path)}.")
    return None, None

def seed_registry():
    print("Initializing Face AI Workers...")
    detector = FaceDetector()
    embedder = FaceEmbedder()
    
    db = SessionLocal()
    
    # Define test people to enroll
    # (video_filename, fullname, is_employee, status/code)
    test_enrollments = [
        ("SS1.mp4", "Vikram Singh", False, VisitorStatus.WHITELISTED),
        ("SS2.mp4", "Officer Raj Kumar", True, "EMP-99201"),
        ("SS3.mp4", "Alice Cooper", False, VisitorStatus.WATCHLIST)
    ]
    
    tests_dir = os.path.join(project_dir, "tests")
    assets_dir = os.path.join(project_dir, "backend", "assets")
    
    # Ensure asset dirs exist
    os.makedirs(os.path.join(assets_dir, "visitors"), exist_ok=True)
    os.makedirs(os.path.join(assets_dir, "employees"), exist_ok=True)
    
    try:
        for filename, name, is_employee, identifier in test_enrollments:
            video_path = os.path.join(tests_dir, filename)
            print(f"\nProcessing {name} from {filename}...")
            
            embedding, face_crop = extract_first_face(video_path, detector, embedder)
            
            # If face extraction failed, fall back to a random stable unit vector
            if embedding is None:
                print(f"Using synthetic fallback vector for {name}...")
                embedding = np.random.normal(0, 0.1, 512)
                embedding /= np.linalg.norm(embedding)
                embedding = embedding.tolist()
                face_crop = np.zeros((112, 112, 3), dtype=np.uint8)
                cv2.putText(face_crop, "Fallback", (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

            # Check if already enrolled to avoid duplicates
            if is_employee:
                existing = db.query(Employee).filter(Employee.fullname == name).first()
                if existing:
                    print(f"Employee {name} is already registered. Updating embedding.")
                    existing.face_embedding_id = json.dumps(embedding)
                    existing.employee_code = identifier
                    db.commit()
                    continue
                
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
                    face_embedding_id=json.dumps(embedding),
                    is_active=True
                )
                db.add(emp)
                print(f"Registered Employee: {name} ({identifier})")
            else:
                existing = db.query(Visitor).filter(Visitor.fullname == name).first()
                if existing:
                    print(f"Visitor {name} is already registered. Updating embedding and status.")
                    existing.face_embedding_id = json.dumps(embedding)
                    existing.status = identifier
                    db.commit()
                    continue
                
                # Save face crop image
                photo_name = f"visitor_seeded_{name.replace(' ', '_').lower()}.jpg"
                photo_path = os.path.join(assets_dir, "visitors", photo_name)
                cv2.imwrite(photo_path, face_crop)
                
                visitor = Visitor(
                    fullname=name,
                    passport_number=f"P{np.random.randint(100000, 999999)}",
                    nationality="Indian" if "Singh" in name else "British",
                    phone_number="+91 9876543210",
                    status=identifier,
                    photo_path=f"/assets/visitors/{photo_name}",
                    face_embedding_id=json.dumps(embedding),
                    purpose="Surveillance Pipeline Testing",
                    approved_by="System Admin",
                    requires_escort=(identifier == VisitorStatus.WATCHLIST)
                )
                db.add(visitor)
                print(f"Registered Visitor: {name} (Status: {identifier.value})")
                
            db.commit()
            
        print("\nDatabase seeding completed successfully ✓")
        
    except Exception as e:
        print(f"Seeding failed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_registry()
