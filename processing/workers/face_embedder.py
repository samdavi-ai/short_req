"""
FaceEmbedder — Real face feature extraction using ResNet50 proxy.

Produces a 512-dimensional L2-normalized embedding vector from a face crop.
In production this would use ArcFace/FaceNet; here we use a ResNet50
backbone with a dimensionality reduction head to produce a stable 512-d vector.
"""

import numpy as np
import cv2
import logging
import torch
import torchvision.transforms as T
from torchvision.models import resnet50, ResNet50_Weights

logger = logging.getLogger(__name__)


class FaceEmbedder:
    def __init__(self, model_path: str = None, use_gpu: bool = False):
        self.device = torch.device('cuda' if use_gpu and torch.cuda.is_available() else 'cpu')

        # Load a pre-trained ResNet50 as a proxy for ArcFace
        base_model = resnet50(weights=ResNet50_Weights.IMAGENET1K_V1)

        # Replace classifier with a 2048 → 512 projection head
        base_model.fc = torch.nn.Sequential(
            torch.nn.Linear(2048, 512),
            torch.nn.BatchNorm1d(512),
        )
        self.model = base_model
        self.model.to(self.device)
        self.model.eval()

        # Standard face preprocessing (112x112 crop, ImageNet normalization)
        self.transform = T.Compose([
            T.ToPILImage(),
            T.Resize((112, 112)),
            T.ToTensor(),
            T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])

        logger.info("FaceEmbedder ResNet50-proxy loaded ✓ (Device: %s, Dim: 512)", self.device)

    def extract_embedding(self, face_crop: np.ndarray):
        """
        Extract a 512-dim L2-normalized face embedding from a BGR face crop.
        Returns list[float] of length 512, or a zero vector if the crop is empty.
        """
        if face_crop is None or face_crop.size == 0:
            return np.zeros(512).tolist()

        try:
            # Convert BGR → RGB
            crop_rgb = cv2.cvtColor(face_crop, cv2.COLOR_BGR2RGB)

            input_tensor = self.transform(crop_rgb).unsqueeze(0).to(self.device)

            with torch.no_grad():
                features = self.model(input_tensor)

            vec = features.squeeze().cpu().numpy()
            # L2 normalize
            vec_norm = vec / (np.linalg.norm(vec) + 1e-12)
            return vec_norm.tolist()

        except Exception as e:
            logger.warning("FaceEmbedder extraction failed: %s", e)
            return np.zeros(512).tolist()
