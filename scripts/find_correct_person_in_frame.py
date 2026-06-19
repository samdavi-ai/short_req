import os
import sys
import cv2
import numpy as np

project_dir = "/Users/samdavi/projects/short_req"
sys.path.insert(0, os.path.join(project_dir, "backend"))
sys.path.insert(0, os.path.join(project_dir, "processing"))

from workers.person_detector import PersonDetector
from workers.face_detector import FaceDetector

def main():
    # Load physical crop
    crop_path = os.path.join(project_dir, "backend/assets/visitors/face_SS2_t65_f90.jpg")
    ref_crop = cv2.imread(crop_path)
    if ref_crop is None:
        print("Reference crop not found")
        return
    print(f"Reference crop size: {ref_crop.shape}")

    # Load video frame 90
    video_path = os.path.join(project_dir, "tests/SS2.mp4")
    cap = cv2.VideoCapture(video_path)
    cap.set(cv2.CAP_PROP_POS_FRAMES, 89)
    ret, frame = cap.read()
    cap.release()
    if not ret:
        print("Failed to read frame 90")
        return

    person_detector = PersonDetector()
    face_detector = FaceDetector()
    person_boxes = person_detector.detect_and_track(frame)
    
    for idx, p in enumerate(person_boxes):
        x1, y1, x2, y2 = p["bbox"]
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
            
            # Resize both to a fixed size for comparison
            r_ref = cv2.resize(ref_crop, (50, 50))
            r_live = cv2.resize(face_crop, (50, 50))
            
            # Compute MSE
            mse = np.mean((r_ref.astype(float) - r_live.astype(float)) ** 2)
            print(f"Person {idx} (bbox={p['bbox']}) face MSE with reference crop: {mse:.2f}")

if __name__ == "__main__":
    main()
