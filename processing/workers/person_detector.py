import numpy as np
import cv2
import torch
# Monkeypatch torch.load to bypass weights_only default in PyTorch 2.6
_orig_load = torch.load
def _custom_load(*args, **kwargs):
    if 'weights_only' not in kwargs:
        kwargs['weights_only'] = False
    return _orig_load(*args, **kwargs)
torch.load = _custom_load

from ultralytics import YOLO

class PersonDetector:
    # Production-grade thresholds
    CONF_THRESHOLD = 0.38   # minimum detection confidence (restored to capture moving targets)
    IOU_THRESHOLD  = 0.50   # NMS IoU for deduplication
    MIN_BOX_AREA   = 800    # reject tiny false-positive boxes (px²) (lowered to catch smaller targets)

    def __init__(self, model_path: str = 'yolov8s.pt', use_gpu: bool = False):
        self.model_path = model_path
        self.use_gpu = use_gpu
        self.device = 0 if use_gpu else 'cpu'
        
        # Load YOLOv8 model
        self.model = YOLO(model_path)
        print(f"Initializing Ultralytics YOLOv8 human detector/tracker ✓ (Device: {self.device})")
        
    def detect_and_track(self, frame: np.ndarray):
        """
        Detect and track people in the frame using YOLOv8 built-in ByteTrack.
        Returns:
            list of dict: [{"track_id": int, "bbox": [x1, y1, x2, y2], "conf": float}]
        """
        # Run tracking with ByteTrack, persist=True is required to keep tracks across frames
        results = self.model.track(
            frame,
            classes=[0],
            device=self.device,
            persist=True,
            verbose=False,
            tracker="bytetrack.yaml",
            conf=self.CONF_THRESHOLD,
            iou=self.IOU_THRESHOLD,
        )
        
        tracked_objects = []
        for result in results:
            boxes = result.boxes
            if boxes.id is None:
                continue
            
            for box in boxes:
                if box.id is None:
                    continue
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                conf = float(box.conf[0])
                track_id = int(box.id[0])
                
                # Reject tiny boxes (noise / partial body parts at frame edge)
                box_area = (x2 - x1) * (y2 - y1)
                if conf > self.CONF_THRESHOLD and box_area > self.MIN_BOX_AREA:
                    tracked_objects.append({
                        "track_id": track_id,
                        "bbox": [int(x1), int(y1), int(x2), int(y2)],
                        "conf": conf
                    })
                    
        return tracked_objects

