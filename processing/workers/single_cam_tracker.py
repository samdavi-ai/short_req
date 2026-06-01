class SingleCameraTracker:
    def __init__(self):
        # Standard tracking initialization (ByteTrack / simple IoU)
        self.track_history = {} # track_id -> history coordinates
        self.next_track_id = 1
        
    def update(self, detections):
        # detections: list of [x1, y1, x2, y2, confidence]
        # returns list of tracks: [track_id, [x1, y1, x2, y2]]
        tracks = []
        for i, det in enumerate(detections):
            # Simple direct matching simulator
            track_id = self.next_track_id
            self.next_track_id += 1
            tracks.append((track_id, det[:4]))
            
        # Clean up history to keep memory minimal
        if self.next_track_id > 10000:
            self.next_track_id = 1
            
        return tracks
