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
        
        # We run the tracker sequentially to match production pipeline tracking
        person_boxes = person_detector.detect_and_track(frame)
        
        if frame_idx == target_frame:
            print(f"\n{video_name} Frame {target_frame}: Detected {len(person_boxes)} persons.")
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
                    # We pick the largest person in the frame (usually the main tracked subject)
                    if area > best_area:
                        best_area = area
                        best_emb = emb
                        print(f"  Candidate: track_id={p.get('track_id')} bbox={bbox} face_bbox={face_bbox} area={area}")
            
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
    
    for name, video, frame in targets:
        print(f"\n=== Extracting for {name} from {video} frame {frame} ===")
        emb = extract_from_frame(video, frame)
        if emb is not None:
            emb_arr = np.array(emb)
            print(f"Successfully extracted! Sum={emb_arr.sum():.6f}, Norm={np.linalg.norm(emb_arr):.6f}")
        else:
            print("Failed to extract embedding.")

if __name__ == "__main__":
    main()
