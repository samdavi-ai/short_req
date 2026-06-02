import numpy as np
from collections import OrderedDict

class SingleCameraTracker:
    def __init__(self, max_disappeared=30):
        self.next_track_id = 1
        self.objects = OrderedDict()
        self.bboxes = OrderedDict()
        self.disappeared = OrderedDict()
        self.max_disappeared = max_disappeared

    def register(self, centroid, bbox):
        self.objects[self.next_track_id] = centroid
        self.bboxes[self.next_track_id] = bbox
        self.disappeared[self.next_track_id] = 0
        self.next_track_id += 1

    def deregister(self, object_id):
        if object_id in self.objects:
            del self.objects[object_id]
        if object_id in self.bboxes:
            del self.bboxes[object_id]
        if object_id in self.disappeared:
            del self.disappeared[object_id]

    def update(self, rects):
        """
        Update tracked objects with new frame detections.
        Args:
            rects: list of [x1, y1, x2, y2, confidence]
        Returns:
            list of tuples: [(track_id, [x1, y1, x2, y2]), ...]
        """
        if len(rects) == 0:
            # Mark existing tracked objects as disappeared
            for object_id in list(self.disappeared.keys()):
                self.disappeared[object_id] += 1
                if self.disappeared[object_id] > self.max_disappeared:
                    self.deregister(object_id)
            return [(oid, self.bboxes[oid]) for oid in self.objects.keys()]

        # Initialize input centroids for the current frame
        input_centroids = np.zeros((len(rects), 2), dtype="int")
        input_bboxes = []
        for i, rect in enumerate(rects):
            x1, y1, x2, y2 = rect[:4]
            cx = int((x1 + x2) / 2.0)
            cy = int((y1 + y2) / 2.0)
            input_centroids[i] = (cx, cy)
            input_bboxes.append((int(x1), int(y1), int(x2), int(y2)))

        # If not tracking any objects, register all
        if len(self.objects) == 0:
            for i in range(0, len(input_centroids)):
                self.register(input_centroids[i], input_bboxes[i])
        else:
            object_ids = list(self.objects.keys())
            object_centroids = list(self.objects.values())

            # Euclidean distances between tracked and input centroids
            D = np.linalg.norm(np.array(object_centroids)[:, np.newaxis] - input_centroids, axis=2)

            rows = D.min(axis=1).argsort()
            cols = D.argmin(axis=1)[rows]

            used_rows = set()
            used_cols = set()

            for row, col in zip(rows, cols):
                if row in used_rows or col in used_cols:
                    continue

                object_id = object_ids[row]
                self.objects[object_id] = input_centroids[col]
                self.bboxes[object_id] = input_bboxes[col]
                self.disappeared[object_id] = 0

                used_rows.add(row)
                used_cols.add(col)

            unused_rows = set(range(0, D.shape[0])).difference(used_rows)
            unused_cols = set(range(0, D.shape[1])).difference(used_cols)

            if D.shape[0] >= D.shape[1]:
                for row in unused_rows:
                    object_id = object_ids[row]
                    self.disappeared[object_id] += 1
                    if self.disappeared[object_id] > self.max_disappeared:
                        self.deregister(object_id)
            else:
                for col in unused_cols:
                    self.register(input_centroids[col], input_bboxes[col])

        return [(oid, self.bboxes[oid]) for oid in self.objects.keys()]
