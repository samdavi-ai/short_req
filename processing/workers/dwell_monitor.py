import time
import cv2
import numpy as np

class DwellTimeMonitor:
    def __init__(self):
        self.active_dwell_timers = {} # track_id -> entry_time

    def check_dwell(self, track_id: str, coordinates: list, zones: list):
        # Check if coordinates (x, y) falls inside any zone polygons
        # coordinates is [x, y]
        x, y = coordinates
        
        for zone in zones:
            points = zone.get("points", [])
            if not points:
                continue
                
            # Convert points to numpy array
            pts = np.array([[p["x"], p["y"]] for p in points], np.int32)
            pts = pts.reshape((-1, 1, 2))
            
            # Point-in-polygon hit-test
            dist = cv2.pointPolygonTest(pts, (x, y), False)
            is_inside = dist >= 0
            
            if is_inside:
                if track_id not in self.active_dwell_timers:
                    self.active_dwell_timers[track_id] = time.time()
                elapsed = time.time() - self.active_dwell_timers[track_id]
                return {"zone_name": zone.get("name"), "dwell_time": elapsed}
                
        # If left zones
        if track_id in self.active_dwell_timers:
            del self.active_dwell_timers[track_id]
        return None
