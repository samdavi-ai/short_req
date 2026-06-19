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
    cap.set(cv2.CAP_PROP_POS_FRAMES, 89)
    ret, frame = cap.read()
    cap.release()
    
    person_detector = PersonDetector()
    face_detector = FaceDetector()
    embedder = FaceEmbedder(face_detector=face_detector)
    
    person_boxes = person_detector.detect_and_track(frame)
    
    # Let's find the person that matches the metadata
    # The metadata says: "bbox": [151, 102, 222, 281] (let's verify what the metadata says for this face)
    metadata_path = os.path.join(project_dir, "backend/assets/extracted_faces_metadata.json")
    with open(metadata_path, 'r') as f:
        data = json.load(f)
    
    meta_item = None
    for item in data:
        if "face_SS2_t65_f90.jpg" in item.get("file_path", ""):
            meta_item = item
            break
            
    if meta_item is None:
        print("Metadata item not found!")
        return
        
    print("Metadata item found:")
    print(f"  file_path: {meta_item.get('file_path')}")
    print(f"  bbox: {meta_item.get('bbox')}")
    print(f"  person_id: {meta_item.get('person_id')}")
    print(f"  frame_index: {meta_item.get('frame_index')}")
    print(f"  camera_id: {meta_item.get('camera_id')}")
    
    meta_emb = np.array(meta_item["embedding"])
    
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
            
            embedding = np.array(embedder.extract_embedding(face_crop))
            sim = np.dot(embedding, meta_emb)
            print(f"\nPerson {idx}: bbox={p['bbox']}, face_bbox={face_bbox}")
            print(f"  Live Emb Sum: {embedding.sum():.6f} | Meta Emb Sum: {meta_emb.sum():.6f}")
            print(f"  Live Emb first 5: {embedding[:5]}")
            print(f"  Meta Emb first 5: {meta_emb[:5]}")
            print(f"  Similarity: {sim:.4f}")

if __name__ == "__main__":
    main()
