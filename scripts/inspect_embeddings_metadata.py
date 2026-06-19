import json
import os
import numpy as np

metadata_path = "/Users/samdavi/projects/short_req/backend/assets/extracted_faces_metadata.json"
with open(metadata_path, 'r') as f:
    data = json.load(f)

for item in data:
    if "face_SS2_t65_f90.jpg" in item.get("file_path", ""):
        print("Metadata keys:", list(item.keys()))
        for key in ["body_embedding", "head_embedding", "face_embedding", "embedding"]:
            if key in item:
                val = item[key]
                if val is not None:
                    val_arr = np.array(val)
                    print(f"  {key}: length={len(val)}, sum={val_arr.sum():.6f}, norm={np.linalg.norm(val_arr):.6f}")
        break
