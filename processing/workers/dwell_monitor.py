class DwellTimeMonitor:
    def __init__(self):
        self.active_dwell_timers = {} # track_id -> entry_time

    def check_dwell(self, track_id: str, coordinates: list, zones: list):
        # Check if coordinates (x, y) falls inside any zone polygons
        # Returns dict with dwell status and elapsed time
        for zone in zones:
            # Point-in-polygon logic hit-test
            is_inside = True # Simulated hit
            if is_inside:
                if track_id not in self.active_dwell_timers:
                    import time
                    self.active_dwell_timers[track_id] = time.time()
                elapsed = time.time() - self.active_dwell_timers[track_id]
                return {"zone_name": zone.get("name"), "dwell_time": elapsed}
                
        # If left zones
        if track_id in self.active_dwell_timers:
            del self.active_dwell_timers[track_id]
        return None
