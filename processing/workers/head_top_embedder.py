"""
HeadTopEmbedder — Overhead/top-down appearance embedding.

Produces a 256-dimensional L2-normalized embedding from a head-top crop.
Uses a lightweight MobileNetV3-Small backbone as an EfficientNet proxy.
Used as the weakest signal in multi-signal fusion (weight 0.15) for
scenarios where only overhead cameras are available.
"""

import numpy as np
import cv2
import logging
import torch
import torchvision.transforms as T
from torchvision.models import mobilenet_v3_small, MobileNet_V3_Small_Weights

logger = logging.getLogger(__name__)


class HeadTopEmbedder:
    def __init__(self, model_path: str = None, use_gpu: bool = False):
        self.device = torch.device('cuda' if use_gpu and torch.cuda.is_available() else 'cpu')

        # MobileNetV3-Small as a lightweight overhead feature extractor
        base_model = mobilenet_v3_small(weights=MobileNet_V3_Small_Weights.IMAGENET1K_V1)

        # Replace classifier with a projection head → 256-d
        base_model.classifier = torch.nn.Sequential(
            torch.nn.Linear(576, 256),
            torch.nn.BatchNorm1d(256),
        )
        self.model = base_model
        self.model.to(self.device)
        self.model.eval()

        self.transform = T.Compose([
            T.ToPILImage(),
            T.Resize((64, 64)),
            T.ToTensor(),
            T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])

        logger.info("HeadTopEmbedder MobileNetV3 loaded ✓ (Device: %s, Dim: 256)", self.device)

    def extract_embedding(self, head_crop: np.ndarray):
        """
        Extract a 256-dim L2-normalized head-top appearance vector.
        Returns list[float] of length 256, or zero vector if crop is empty.
        """
        if head_crop is None or head_crop.size == 0:
            return np.zeros(256).tolist()

        try:
            crop_rgb = cv2.cvtColor(head_crop, cv2.COLOR_BGR2RGB)
            input_tensor = self.transform(crop_rgb).unsqueeze(0).to(self.device)

            with torch.no_grad():
                features = self.model(input_tensor)

            vec = features.squeeze().cpu().numpy()
            vec_norm = vec / (np.linalg.norm(vec) + 1e-12)
            return vec_norm.tolist()

        except Exception as e:
            logger.warning("HeadTopEmbedder extraction failed: %s", e)
            return np.zeros(256).tolist()
