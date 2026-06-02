import numpy as np
import cv2

class FaceDetector:
    def __init__(self, model_path: str = None):
        self.model_path = model_path
        # Load the built-in Haar Cascade classifier from OpenCV data
        self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        print("Initializing CPU-optimized OpenCV Haar Cascade face detector ✓")
        
    def detect_faces(self, person_crop: np.ndarray):
        """
        Detect a face inside the crop of a person.
        Returns:
            list: [fx1, fy1, fx2, fy2] relative to the person crop, or None
        """
        if person_crop is None or person_crop.size == 0:
            return None
            
        # Convert to grayscale
        gray = cv2.cvtColor(person_crop, cv2.COLOR_BGR2GRAY)
        
        # Detect faces
        faces = self.face_cascade.detectMultiScale(
            gray, 
            scaleFactor=1.1, 
            minNeighbors=4, 
            minSize=(30, 30)
        )
        
        if len(faces) > 0:
            # Return the first/largest detected face inside the bounding box
            x, y, w, h = faces[0]
            return [int(x), int(y), int(x + w), int(y + h)]
            
        return None
