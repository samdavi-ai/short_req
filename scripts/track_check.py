import os
import sys
import cv2
import numpy as np

project_dir = "/Users/samdavi/projects/short_req"
sys.path.insert(0, os.path.join(project_dir, "backend"))
sys.path.insert(0, os.path.join(project_dir, "processing"))

from workers.person_detector import PersonDetector
from workers.face_detector import FaceDetector
from workers.face_embedder import FaceEmbedder

def main():
    video_path = os.path.join(project_dir, "tests/SS2.mp4")
    cap = cv2.VideoCapture(video_path)
    
    person_detector = PersonDetector()
    face_detector = FaceDetector()
    embedder = FaceEmbedder(face_detector=face_detector)
    
    frame_idx = 0
    while cap.isOpened() and frame_idx < 90:
        ret, frame = cap.read()
        if not ret:
            break
        frame_idx += 1
        
        person_boxes = person_detector.detect_and_track(frame)
        if frame_idx == 90:
            print(f"\nFrame 90: Detected {len(person_boxes)} persons.")
            for p in person_boxes:
                track_id = p.get("track_id")
                bbox = p.get("bbox")
                print(f"  Track ID: {track_id} | Bbox: {bbox}")
                
                # Try to extract face embedding
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
                    embedding = embedder.extract_embedding(face_crop)
                    print(f"    Face found! Embedding sum: {np.array(embedding).sum():.6f}")
                else:
                    print("    No face found.")
                    
    cap.release()

if __name__ == "__main__":
    main()
