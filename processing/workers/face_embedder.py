import numpy as np

class FaceEmbedder:
    def __init__(self, model_path: str):
        self.model_path = model_path
        print(f"FaceEmbedder ArcFace initialized with: {model_path}")
        
    def extract_embedding(self, face_crop: np.ndarray):
        # Extract 512-dim vector from face crop image
        # Return a normalized simulated 512-dim vector
        vec = np.random.randn(512)
        return (vec / np.linalg.norm(vec)).tolist()
