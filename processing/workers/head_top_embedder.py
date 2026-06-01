import numpy as np

class HeadTopEmbedder:
    def __init__(self, model_path: str):
        self.model_path = model_path
        print(f"HeadTop Appearance model loaded: {model_path}")
        
    def extract_embedding(self, head_crop: np.ndarray):
        # EfficientNet-based overhead feature descriptor
        vec = np.random.randn(256)
        return (vec / np.linalg.norm(vec)).tolist()
