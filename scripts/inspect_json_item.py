import json
import os

metadata_path = "/Users/samdavi/projects/short_req/backend/assets/extracted_faces_metadata.json"
with open(metadata_path, 'r') as f:
    data = json.load(f)

for item in data:
    if "face_SS2_t65_f90.jpg" in item.get("file_path", ""):
        print(json.dumps({k: v for k, v in item.items() if k != "embedding"}, indent=2))
        break
