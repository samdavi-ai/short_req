import numpy as np
import cv2
import torch
import torchvision.transforms as T
from torchvision.models import resnet50, ResNet50_Weights

class BodyReIDEmbedder:
    def __init__(self, model_path: str = None, use_gpu: bool = False):
        self.device = torch.device('cuda' if use_gpu and torch.cuda.is_available() else 'cpu')
        
        # We load a pre-trained ResNet50 model as a proxy for TransReID
        self.model = resnet50(weights=ResNet50_Weights.IMAGENET1K_V1)
        
        # Remove the final classification layer to get the 2048-d feature vector
        self.model.fc = torch.nn.Identity()
        self.model.to(self.device)
        self.model.eval()
        
        # Standard ImageNet transforms
        self.transform = T.Compose([
            T.ToPILImage(),
            T.Resize((256, 128)), # ReID standard size
            T.ToTensor(),
            T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])
        
        print(f"BodyReID ResNet50 proxy loaded ✓ (Device: {self.device})")
        
    def extract_embedding(self, person_crop: np.ndarray):
        """
        Extracts a 2048-dim ReID signature from a person crop.
        """
        if person_crop.size == 0:
            return np.zeros(2048).tolist()
            
        # Convert BGR to RGB
        crop_rgb = cv2.cvtColor(person_crop, cv2.COLOR_BGR2RGB)
        
        # Transform
        input_tensor = self.transform(crop_rgb).unsqueeze(0).to(self.device)
        
        with torch.no_grad():
            features = self.model(input_tensor)
            
        # L2 normalize
        vec = features.squeeze().cpu().numpy()
        vec_norm = vec / (np.linalg.norm(vec) + 1e-12)
        
        return vec_norm.tolist()
