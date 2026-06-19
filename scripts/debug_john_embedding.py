import os
import sys
import cv2
import numpy as np
import json

project_dir = "/Users/samdavi/projects/short_req"
sys.path.insert(0, os.path.join(project_dir, "backend"))
sys.path.insert(0, os.path.join(project_dir, "processing"))

from workers.person_detector import PersonDetector
from workers.face_detector import FaceDetector
from workers.face_embedder import FaceEmbedder

def main():
    video_path = os.path.join(project_dir, "tests/SS2.mp4")
    cap = cv2.VideoCapture(video_path)
    
    # Go to frame 90
    cap.set(cv2.CAP_PROP_POS_FRAMES, 89) # 0-indexed
    ret, frame = cap.read()
    cap.release()
    
    if not ret:
        print("Failed to read frame 90 of SS2.mp4")
        return
        
    print("Frame 90 read successfully.")
    
    person_detector = PersonDetector()
    face_detector = FaceDetector()
    embedder = FaceEmbedder(face_detector=face_detector)
    
    # Detect person
    person_boxes = person_detector.detect_and_track(frame)
    print(f"Detected {len(person_boxes)} person(s).")
    
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
            
            embedding = embedder.extract_embedding(face_crop)
            emb_arr = np.array(embedding)
            print(f"Person {idx} face embedding: sum={emb_arr.sum():.6f}, norm={np.linalg.norm(emb_arr):.6f}")
            
            # Load metadata embedding for comparison
            metadata_path = os.path.join(project_dir, "backend/assets/extracted_faces_metadata.json")
            with open(metadata_path, 'r') as f:
                data = json.load(f)
            
            for item in data:
                if "face_SS2_t65_f90.jpg" in item.get("file_path", ""):
                    meta_emb = np.array(item["embedding"])
                    print(f"Metadata embedding: sum={meta_emb.sum():.6f}, norm={np.linalg.norm(meta_emb):.6f}")
                    # Cosine similarity
                    dot = np.dot(emb_arr, meta_emb)
                    sim = dot / (np.linalg.norm(emb_arr) * np.linalg.norm(meta_emb) + 1e-12)
                    print(f"Cosine Similarity: {sim:.4f}")
                    break

if __name__ == "__main__":
    main()
