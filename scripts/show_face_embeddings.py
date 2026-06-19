import json
import os
import numpy as np

metadata_path = "/Users/samdavi/projects/short_req/backend/assets/extracted_faces_metadata.json"
with open(metadata_path, 'r') as f:
    data = json.load(f)

targets = ["face_SS3_t68_f555.jpg", "face_SS2_t65_f90.jpg", "face_MS2_t26_f675.jpg"]

for target in targets:
    found = False
    for item in data:
        if target in item.get("file_path", ""):
            print(f"\nMatched target: {target}")
            print(f"  file_path: {item.get('file_path')}")
            for k in item.keys():
                if k in ["face_embedding", "face_embedding_id", "embedding"]:
                    val = item[k]
                    if val is not None:
                        val_arr = np.array(val)
                        print(f"  Key: {k} | Sum: {val_arr.sum():.6f} | Norm: {np.linalg.norm(val_arr):.6f}")
            found = True
            break
    if not found:
        print(f"\nTarget {target} not found in metadata json.")
