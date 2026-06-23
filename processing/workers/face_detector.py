"""
FaceDetector — Face detection using RetinaFace (det_10g.onnx) from InsightFace buffalo_l pack.

Uses instance-level caching to ensure thread/process safety when multiple
CameraPipeline instances run concurrently. Each FaceDetector instance
maintains its own cache of last-processed faces.
"""

import numpy as np
import cv2
import logging
from insightface.app import FaceAnalysis

logger = logging.getLogger(__name__)

# Shared FaceAnalysis model (loaded once, safe to share — the model is stateless)
_shared_face_analysis = None


def get_shared_face_analysis():
    global _shared_face_analysis
    if _shared_face_analysis is None:
        logger.info("Initializing InsightFace buffalo_l pack on ONNX Runtime (CPU) ...")
        # Run strictly on CPU using CPUExecutionProvider as specified by cc.txt
        _shared_face_analysis = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
        # det_size=(320, 320) is standard for person crop detection
        _shared_face_analysis.prepare(ctx_id=-1, det_size=(320, 320))
        logger.info("InsightFace buffalo_l pack loaded successfully ✓")
    return _shared_face_analysis


class FaceDetector:
    def __init__(self, model_path: str = None):
        self.model_path = model_path
        # Per-instance cache — ensures each CameraPipeline gets its own face data
        self._last_crop_id = None
        self._last_faces = []
        # Warm up shared app
        try:
            get_shared_face_analysis()
            logger.info("FaceDetector successfully initialized using InsightFace buffalo_l pack.")
        except Exception as e:
            logger.error("Failed to initialize FaceDetector with InsightFace: %s. Falling back to stub.", e)

    @property
    def last_faces(self):
        """Return the last detected faces for this detector instance."""
        return self._last_faces

    def detect_faces(self, person_crop: np.ndarray):
        """
        Detect a face inside the crop of a person using det_10g (RetinaFace) via InsightFace.
        Results are cached per-instance to allow FaceEmbedder to reuse them.

        Returns:
            list: [fx1, fy1, fx2, fy2] relative to the person crop, or None
        """
        if person_crop is None or person_crop.size == 0:
            return None

        try:
            # Use image object id and shape as a cache key
            crop_id = (id(person_crop), person_crop.shape)
            if crop_id == self._last_crop_id:
                faces = self._last_faces
            else:
                app = get_shared_face_analysis()
                faces = app.get(person_crop)
                # Filter faces by a minimum detection confidence threshold to reject false positives (noise)
                faces = [f for f in faces if getattr(f, 'det_score', 0.0) >= 0.6]
                self._last_crop_id = crop_id
                self._last_faces = faces

            if faces:
                # Sort by bbox area descending to get the largest face
                faces = sorted(faces, key=lambda f: (f.bbox[2]-f.bbox[0])*(f.bbox[3]-f.bbox[1]), reverse=True)
                bbox = faces[0].bbox
                # Ensure coordinates are within image bounds
                h, w = person_crop.shape[:2]
                fx1, fy1, fx2, fy2 = int(bbox[0]), int(bbox[1]), int(bbox[2]), int(bbox[3])
                return [max(0, fx1), max(0, fy1), min(w, fx2), min(h, fy2)]
        except Exception as e:
            logger.warning("FaceDetector RetinaFace detection failed: %s", e)

        return None
