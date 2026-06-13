import numpy as np
import cv2

class FaceDetector:
    def __init__(self, model_path: str = None):
        self.model_path = model_path
        # Load the built-in Haar Cascade classifiers from OpenCV data
        self.face_cascade_default = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        self.face_cascade_alt = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_alt.xml')
        self.face_cascade_alt2 = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_alt2.xml')
        self.profile_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_profileface.xml')
        
        # Backward compatibility alias
        self.face_cascade = self.face_cascade_default
        print("Initializing CPU-optimized Multi-Cascade Combinational Face Detector (Frontal + Alt + Alt2 + Left/Right Profile) ✓")
        
    def detect_faces(self, person_crop: np.ndarray):
        """
        Detect a face inside the crop of a person using a custom combinational cascade pipeline.
        Returns:
            list: [fx1, fy1, fx2, fy2] relative to the person crop, or None
        """
        if person_crop is None or person_crop.size == 0:
            return None
            
        # Convert to grayscale
        gray = cv2.cvtColor(person_crop, cv2.COLOR_BGR2GRAY)
        
        # Face bounding box candidates list
        faces = []

        # 1. Try Frontal Default (fastest, standard frontal view)
        faces_def = self.face_cascade_default.detectMultiScale(gray, scaleFactor=1.08, minNeighbors=4, minSize=(24, 24))
        if len(faces_def) > 0:
            faces = faces_def
        
        # 2. Try Frontal Alt (robust to lighting, slight angle variations)
        if len(faces) == 0:
            faces_alt = self.face_cascade_alt.detectMultiScale(gray, scaleFactor=1.08, minNeighbors=4, minSize=(24, 24))
            if len(faces_alt) > 0:
                faces = faces_alt
                
        # 3. Try Frontal Alt2
        if len(faces) == 0:
            faces_alt2 = self.face_cascade_alt2.detectMultiScale(gray, scaleFactor=1.08, minNeighbors=4, minSize=(24, 24))
            if len(faces_alt2) > 0:
                faces = faces_alt2

        # 4. Try Profile Face (essential for side profiles in surveillance)
        if len(faces) == 0:
            faces_prof = self.profile_cascade.detectMultiScale(gray, scaleFactor=1.08, minNeighbors=4, minSize=(24, 24))
            if len(faces_prof) > 0:
                faces = faces_prof
            else:
                # 5. Flip horizontally to detect profiles facing the other direction
                flipped_gray = cv2.flip(gray, 1)
                flipped_faces = self.profile_cascade.detectMultiScale(flipped_gray, scaleFactor=1.08, minNeighbors=4, minSize=(24, 24))
                if len(flipped_faces) > 0:
                    fx, fy, fw, fh = flipped_faces[0]
                    # Map x back to original coordinate system
                    original_x = gray.shape[1] - fx - fw
                    faces = [[original_x, fy, fw, fh]]

        if len(faces) > 0:
            # Return the first/largest detected face inside the bounding box
            # Sort by area descending so the largest face is selected first
            faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
            x, y, w, h = faces[0]
            return [int(x), int(y), int(x + w), int(y + h)]
            
        return None
