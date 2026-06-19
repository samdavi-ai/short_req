import os
import cv2
import numpy as np
import json
from insightface.app import FaceAnalysis

def main():
    img_path = "/Users/samdavi/projects/short_req/backend/assets/visitors/face_SS2_t65_f90.jpg"
    img = cv2.imread(img_path)
    if img is None:
        print("Image not found")
        return
        
    print(f"Loaded image size: {img.shape}")
    
    # Try different det sizes
    for det_size in [(320, 320), (640, 640), (112, 112)]:
        app = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
        app.prepare(ctx_id=-1, det_size=det_size)
        faces = app.get(img)
        print(f"\nDet size {det_size}: detected {len(faces)} faces.")
        for idx, f in enumerate(faces):
            emb = f.embedding
            norm = np.linalg.norm(emb)
            emb_norm = emb / (norm + 1e-12)
            print(f"  Face {idx}: bbox={f.bbox}, sum={emb_norm.sum():.6f}, norm={np.linalg.norm(emb_norm):.6f}")
            print(f"    first 5: {emb_norm[:5]}")
            
            # Compare with metadata embedding
            metadata_path = "/Users/samdavi/projects/short_req/backend/assets/extracted_faces_metadata.json"
            with open(metadata_path, 'r') as f_meta:
                data = json.load(f_meta)
            for item in data:
                if "face_SS2_t65_f90.jpg" in item.get("file_path", ""):
                    meta_emb = np.array(item["embedding"])
                    sim = np.dot(emb_norm, meta_emb)
                    print(f"    Similarity with metadata: {sim:.4f}")
                    break

if __name__ == "__main__":
    main()
