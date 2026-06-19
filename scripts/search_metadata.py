import json
import os

project_dir = "/Users/samdavi/projects/short_req"
metadata_path = os.path.join(project_dir, "backend/assets/extracted_faces_metadata.json")

with open(metadata_path, 'r') as f:
    data = json.load(f)

targets = ["face_SS3_t68_f555.jpg", "face_SS2_t65_f90.jpg", "face_MS2_t26_f675.jpg"]

for target in targets:
    found = False
    for item in data:
        # Check if the filename is in the item's path
        if target in item.get("file_path", ""):
            print(f"\nMetadata for {target}:")
            # Print without printing the entire face embedding if it's too long
            clean_item = {k: v for k, v in item.items() if k != "face_embedding"}
            print(json.dumps(clean_item, indent=2))
            if "face_embedding" in item:
                emb = item["face_embedding"]
                import numpy as np
                emb_arr = np.array(emb)
                print(f"  Face embedding exists, length: {len(emb)}, sum: {emb_arr.sum():.6f}, norm: {np.linalg.norm(emb_arr):.6f}")
            found = True
            break
    if not found:
        print(f"\nCould not find {target} in metadata.")
