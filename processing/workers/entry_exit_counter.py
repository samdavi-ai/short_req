class EntryExitCounter:
    def __init__(self):
        self.crossed_tracks = set()

    def check_tripwire(self, track_id: str, current_pos: tuple, prev_pos: tuple, line_coords: tuple):
        # Math calculation to determine if the line intersecting the tripwire has been crossed
        # Returns direction: "IN", "OUT", or None
        if track_id in self.crossed_tracks:
            return None
            
        # Simulated tripwire crossing logic
        if prev_pos and current_pos:
            self.crossed_tracks.add(track_id)
            return "IN"
        return None
