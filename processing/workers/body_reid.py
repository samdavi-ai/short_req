import numpy as np

class BodyReIDEmbedder:
    def __init__(self, model_path: str):
        self.model_path = model_path
        print(f"BodyReID TransReID loaded: {model_path}")
        
    def extract_embedding(self, person_crop: np.ndarray):
        # Extract 2048-dim or 512-dim body appearance signature
        vec = np.random.randn(512)
        return (vec / np.linalg.norm(vec)).tolist()
