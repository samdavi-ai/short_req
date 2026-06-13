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
        
        print(f"BodyReID Combined ResNet50 + Spatial Color Histogram Embedder loaded ✓ (Device: {self.device})")
        
    def _extract_spatial_color_histogram(self, person_crop: np.ndarray):
        """
        Extracts a spatial color histogram from a person crop.
        Divides the crop vertically into 3 zones (head/chest, waist, legs),
        computes H, S, V 1D histograms, and L2 normalizes.
        """
        h, w, _ = person_crop.shape
        h_stripe = h // 3
        
        # Avoid empty stripes
        if h_stripe == 0:
            h_stripe = 1
            
        stripes = [
            person_crop[0:h_stripe, :],
            person_crop[h_stripe:2*h_stripe, :],
            person_crop[2*h_stripe:h, :]
        ]
        
        hist_features = []
        for stripe in stripes:
            if stripe.size == 0:
                hist_features.extend(np.zeros(32))
                continue
                
            # Convert to HSV color space
            hsv = cv2.cvtColor(stripe, cv2.COLOR_BGR2HSV)
            
            # Compute histograms (Hue: 16 bins, Saturation: 8 bins, Value: 8 bins)
            hist_h = cv2.calcHist([hsv], [0], None, [16], [0, 180])
            hist_s = cv2.calcHist([hsv], [1], None, [8], [0, 256])
            hist_v = cv2.calcHist([hsv], [2], None, [8], [0, 256])
            
            # Normalize each histogram
            hist_h = cv2.normalize(hist_h, hist_h).flatten()
            hist_s = cv2.normalize(hist_s, hist_s).flatten()
            hist_v = cv2.normalize(hist_v, hist_v).flatten()
            
            stripe_feature = np.concatenate([hist_h, hist_s, hist_v])
            
            # L2 normalize the stripe feature
            norm = np.linalg.norm(stripe_feature) + 1e-12
            stripe_feature = stripe_feature / norm
            hist_features.extend(stripe_feature)
            
        hist_features = np.array(hist_features)
        norm = np.linalg.norm(hist_features) + 1e-12
        return hist_features / norm

    def extract_embedding(self, person_crop: np.ndarray):
        """
        Extracts a 2144-dim ReID signature (96-d spatial color hist + 2048-d ResNet50 deep features).
        """
        if person_crop is None or person_crop.size == 0:
            return np.zeros(2144).tolist()
            
        # 1. Extract Deep Features (ResNet50)
        crop_rgb = cv2.cvtColor(person_crop, cv2.COLOR_BGR2RGB)
        input_tensor = self.transform(crop_rgb).unsqueeze(0).to(self.device)
        
        with torch.no_grad():
            features = self.model(input_tensor)
            
        vec = features.squeeze().cpu().numpy()
        resnet_vec = vec / (np.linalg.norm(vec) + 1e-12)
        
        # 2. Extract Spatial Color Histogram
        color_vec = self._extract_spatial_color_histogram(person_crop)
        
        # 3. Fuse embeddings: 70% color pattern, 30% ResNet deep texture/geometry
        w_color = 0.70
        w_resnet = 0.30
        
        combined_vec = np.concatenate([
            np.sqrt(w_color) * color_vec,
            np.sqrt(w_resnet) * resnet_vec
        ])
        
        # Re-normalize to ensure strict L2 norm of 1.0
        combined_vec_norm = combined_vec / (np.linalg.norm(combined_vec) + 1e-12)
        
        return combined_vec_norm.tolist()
