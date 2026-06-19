"""
FaceEmbedder — Real face feature extraction using ArcFace (w600k_r50.onnx) from InsightFace buffalo_l pack.

Produces a 512-dimensional L2-normalized embedding vector from a face crop.
Uses the FaceDetector instance's cache to avoid re-running models on the same crop.
"""

import numpy as np
import cv2
import logging
from workers.face_detector import get_shared_face_analysis

logger = logging.getLogger(__name__)


class FaceEmbedder:
    def __init__(self, model_path: str = None, use_gpu: bool = False,
                 face_detector=None):
        """
        Args:
            face_detector: Optional FaceDetector instance to share cached face data.
                           This avoids re-running the model on the same person crop.
        """
        self._face_detector = face_detector
        # Warm up shared app
        try:
            get_shared_face_analysis()
            logger.info("FaceEmbedder successfully initialized using ArcFace from InsightFace buffalo_l.")
        except Exception as e:
            logger.error("Failed to initialize FaceEmbedder: %s", e)

    def extract_embedding(self, face_crop: np.ndarray):
        """
        Extract a 512-dim L2-normalized face embedding from a BGR face crop.
        Returns list[float] of length 512, or a zero vector if the crop is empty.
        """
        if face_crop is None or face_crop.size == 0:
            return np.zeros(512).tolist()

        try:
            # Check if there is a cached face embedding from the last detect_faces run
            last_faces = self._face_detector.last_faces if self._face_detector else []
            if last_faces:
                # Return the embedding of the largest detected face
                faces_sorted = sorted(last_faces, key=lambda f: (f.bbox[2]-f.bbox[0])*(f.bbox[3]-f.bbox[1]), reverse=True)
                embedding = faces_sorted[0].embedding
                norm = np.linalg.norm(embedding) + 1e-12
                return (embedding / norm).tolist()

            # Fallback: if face_crop is passed directly (e.g. during manual visitor enrollment),
            # run FaceAnalysis on the face crop itself
            app = get_shared_face_analysis()
            faces = app.get(face_crop)
            if faces:
                faces_sorted = sorted(faces, key=lambda f: (f.bbox[2]-f.bbox[0])*(f.bbox[3]-f.bbox[1]), reverse=True)
                embedding = faces_sorted[0].embedding
                norm = np.linalg.norm(embedding) + 1e-12
                return (embedding / norm).tolist()

        except Exception as e:
            logger.warning("FaceEmbedder extraction failed: %s", e)

        return np.zeros(512).tolist()
