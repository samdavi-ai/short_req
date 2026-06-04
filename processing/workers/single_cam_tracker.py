import numpy as np

class SingleCameraTracker:
    def __init__(self):
        # We rely on YOLOv8 ByteTrack, so we just maintain active objects
        self.objects = {}
        self.bboxes = {}
        self.disappeared = {}
        self.max_disappeared = 30

    def update(self, tracked_objects):
        """
        Update tracked objects from YOLOv8 tracking output.
        Args:
            tracked_objects: list of dict [{"track_id": int, "bbox": [x1, y1, x2, y2], "conf": float}]
        Returns:
            list of tuples: [(track_id, [x1, y1, x2, y2]), ...]
        """
        # Increment disappeared counts
        for object_id in list(self.disappeared.keys()):
            self.disappeared[object_id] += 1
            if self.disappeared[object_id] > self.max_disappeared:
                self.deregister(object_id)
                
        # Update with new tracking info
        for obj in tracked_objects:
            track_id = obj["track_id"]
            bbox = obj["bbox"]
            
            # calculate centroid
            cx = int((bbox[0] + bbox[2]) / 2)
            cy = int((bbox[1] + bbox[3]) / 2)
            
            self.objects[track_id] = (cx, cy)
            self.bboxes[track_id] = bbox
            self.disappeared[track_id] = 0
            
        return [(oid, self.bboxes[oid]) for oid in self.objects.keys()]

    def deregister(self, object_id):
        if object_id in self.objects:
            del self.objects[object_id]
        if object_id in self.bboxes:
            del self.bboxes[object_id]
        if object_id in self.disappeared:
            del self.disappeared[object_id]
