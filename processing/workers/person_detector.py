import numpy as np
import cv2

class PersonDetector:
    def __init__(self, model_path: str = None, use_gpu: bool = False):
        self.model_path = model_path
        self.use_gpu = use_gpu
        self.hog = cv2.HOGDescriptor()
        self.hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
        print("Initializing CPU-optimized OpenCV HOG human detector ✓")
        
    def detect(self, frame: np.ndarray):
        """
        Detect people in the frame using OpenCV HOG + SVM.
        Returns:
            list of list: [[x1, y1, x2, y2, confidence]]
        """
        # Convert to grayscale for HOG
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Multi-scale detection
        rects, weights = self.hog.detectMultiScale(
            gray, 
            winStride=(4, 4), 
            padding=(8, 8), 
            scale=1.05
        )
        
        detections = []
        for (x, y, w, h), weight in zip(rects, weights):
            # Normalise and filter by weight threshold
            if weight > 0.2:
                detections.append([int(x), int(y), int(x + w), int(y + h), float(weight)])
                
        return detections
