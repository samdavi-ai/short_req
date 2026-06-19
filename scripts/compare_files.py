import os

path1 = "/Users/samdavi/projects/short_req/backend/assets/visitors/face_SS2_t65_f90.jpg"
path2 = "/Users/samdavi/projects/short_req/backend/assets/extracted_faces/face_SS2_t65_f90.jpg"

print(f"Path 1 exists: {os.path.exists(path1)}")
print(f"Path 2 exists: {os.path.exists(path2)}")

if os.path.exists(path1) and os.path.exists(path2):
    with open(path1, 'rb') as f1, open(path2, 'rb') as f2:
        c1 = f1.read()
        c2 = f2.read()
        print(f"Sizes: {len(c1)} vs {len(c2)}")
        print(f"Identical: {c1 == c2}")
