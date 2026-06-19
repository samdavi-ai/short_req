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
    crop_path = os.path.join(project_dir, "backend/assets/visitors/face_SS2_t65_f90.jpg")
    ref_crop = cv2.imread(crop_path)
    if ref_crop is None:
        print("Reference crop not found")
        return
        
    person_detector = PersonDetector()
    face_detector = FaceDetector()
    
    video_path = os.path.join(project_dir, "tests/SS2.mp4")
    cap = cv2.VideoCapture(video_path)
    
    best_mse = float('inf')
    best_frame = -1
    best_person = -1
    
    # Scan frames from 70 to 110
    for f_idx in range(70, 110):
        cap.set(cv2.CAP_PROP_POS_FRAMES, f_idx)
        ret, frame = cap.read()
        if not ret:
            break
            
        person_boxes = person_detector.detect_and_track(frame)
        for p_idx, p in enumerate(person_boxes):
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
                
                # Compare dimensions and values
                if face_crop.shape == ref_crop.shape:
                    diff = np.abs(face_crop.astype(float) - ref_crop.astype(float))
                    mse = np.mean(diff ** 2)
                    if mse < best_mse:
                        best_mse = mse
                        best_frame = f_idx
                        best_person = p_idx
                        print(f"Match found: Frame {f_idx + 1}, Person {p_idx}, Shape match, MSE={mse:.4f}")
                else:
                    # Resize and check MSE anyway
                    r_live = cv2.resize(face_crop, (ref_crop.shape[1], ref_crop.shape[0]))
                    diff = np.abs(r_live.astype(float) - ref_crop.astype(float))
                    mse = np.mean(diff ** 2)
                    if mse < best_mse:
                        best_mse = mse
                        best_frame = f_idx
                        best_person = p_idx
                        print(f"Resize Match: Frame {f_idx + 1}, Person {p_idx}, Shape {face_crop.shape} vs {ref_crop.shape}, MSE={mse:.4f}")
                        
    cap.release()
    print(f"\nBest match: Frame {best_frame + 1}, Person {best_person}, MSE: {best_mse:.4f}")

if __name__ == "__main__":
    main()
