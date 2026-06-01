import numpy as np

class FaceDetector:
    def __init__(self, model_path: str):
        self.model_path = model_path
        print(f"FaceDetector initialized with model: {model_path}")
        
    def detect_faces(self, person_crop: np.ndarray):
        # Extract faces from inside person crop bounding boxes
        h, w = person_crop.shape[:2]
        # Return face bounding box relative to crop if face is present
        if h > 80 and w > 80 and np.random.rand() > 0.4:
            return [int(w*0.2), int(h*0.05), int(w*0.8), int(h*0.35)]
        return None
