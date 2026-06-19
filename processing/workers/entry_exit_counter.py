"""
EntryExitCounter — Real tripwire line-crossing detection.

Uses line-segment intersection math to detect when a tracked person
crosses a virtual tripwire line, and determines direction (IN / OUT)
based on which side of the line the centroid moved from/to.

Supports bidirectional crossing: a person can enter (IN) and later
exit (OUT) through the same tripwire. Same-direction consecutive
crossings are suppressed with a cooldown to prevent double-counting.
"""

import time
import logging
from typing import Optional, Tuple, Dict

logger = logging.getLogger(__name__)


class EntryExitCounter:
    # Cooldown: suppress same-direction re-crossing for this many seconds
    DIRECTION_COOLDOWN_S = 3.0

    def __init__(self):
        # track_id → last known centroid position
        self.prev_positions: Dict[str, Tuple[float, float]] = {}
        # (track_id, zone_id) → {"direction": "IN"/"OUT", "timestamp": float}
        self._last_crossing: Dict[Tuple[str, int], dict] = {}
        # zone_id → {"in": int, "out": int}
        self.zone_counts: Dict[int, Dict[str, int]] = {}

    def check_tripwire(self, track_id: str, current_pos: Tuple[float, float],
                       tripwire_line: Tuple[float, float, float, float],
                       zone_id: int = 0) -> Optional[str]:
        """
        Check if the person's movement from prev_pos to current_pos
        crosses the tripwire line.

        Args:
            track_id: unique track identifier
            current_pos: (cx, cy) current centroid
            tripwire_line: (x1, y1, x2, y2) the two endpoints of the tripwire
            zone_id: zone identifier for counting

        Returns:
            "IN", "OUT", or None
        """
        prev_pos = self.prev_positions.get(track_id)
        self.prev_positions[track_id] = current_pos

        if prev_pos is None:
            return None

        lx1, ly1, lx2, ly2 = tripwire_line
        px1, py1 = prev_pos
        px2, py2 = current_pos

        # Check line segment intersection using cross products
        crossed = self._segments_intersect(px1, py1, px2, py2, lx1, ly1, lx2, ly2)

        if not crossed:
            return None

        # Determine direction based on cross product sign
        direction = self._compute_direction(px1, py1, px2, py2, lx1, ly1, lx2, ly2)

        # Check directional cooldown — only suppress SAME direction re-crossing
        now = time.time()
        crossing_key = (track_id, zone_id)
        last = self._last_crossing.get(crossing_key)

        if last is not None:
            if last["direction"] == direction and (now - last["timestamp"]) < self.DIRECTION_COOLDOWN_S:
                # Same direction within cooldown → jitter/double-count, suppress
                return None

        # Record this crossing
        self._last_crossing[crossing_key] = {"direction": direction, "timestamp": now}

        # Update zone counts
        if zone_id not in self.zone_counts:
            self.zone_counts[zone_id] = {"in": 0, "out": 0}

        if direction == "IN":
            self.zone_counts[zone_id]["in"] += 1
        else:
            self.zone_counts[zone_id]["out"] += 1

        logger.info("Tripwire crossed: track %s → %s (zone %d)", track_id, direction, zone_id)
        return direction

    @staticmethod
    def _cross_product(ox, oy, ax, ay, bx, by) -> float:
        """Cross product of vector OA and OB."""
        return (ax - ox) * (by - oy) - (ay - oy) * (bx - ox)

    def _segments_intersect(self, ax1, ay1, ax2, ay2, bx1, by1, bx2, by2) -> bool:
        """
        Check if line segment A (ax1,ay1)→(ax2,ay2)
        intersects line segment B (bx1,by1)→(bx2,by2)
        using the cross product orientation test.
        """
        d1 = self._cross_product(bx1, by1, bx2, by2, ax1, ay1)
        d2 = self._cross_product(bx1, by1, bx2, by2, ax2, ay2)
        d3 = self._cross_product(ax1, ay1, ax2, ay2, bx1, by1)
        d4 = self._cross_product(ax1, ay1, ax2, ay2, bx2, by2)

        if ((d1 > 0 and d2 < 0) or (d1 < 0 and d2 > 0)) and \
           ((d3 > 0 and d4 < 0) or (d3 < 0 and d4 > 0)):
            return True

        # Collinear cases (edge cases, skip for performance)
        return False

    @staticmethod
    def _compute_direction(px1, py1, px2, py2, lx1, ly1, lx2, ly2) -> str:
        """
        Determine direction of crossing.
        Uses the sign of the cross product of the line vector
        and the movement end-point relative to the line.

        Convention: positive cross product = "IN", negative = "OUT"
        """
        # Line vector
        line_dx = lx2 - lx1
        line_dy = ly2 - ly1
        # Vector from line start to movement end
        point_dx = px2 - lx1
        point_dy = py2 - ly1
        cross = line_dx * point_dy - line_dy * point_dx
        return "IN" if cross > 0 else "OUT"

    def get_zone_counts(self, zone_id: int) -> Dict[str, int]:
        """Get current IN/OUT counts for a zone."""
        return self.zone_counts.get(zone_id, {"in": 0, "out": 0})

    def get_zone_occupancy(self, zone_id: int) -> int:
        """Get net occupancy (in - out) for a zone."""
        counts = self.get_zone_counts(zone_id)
        return max(0, counts["in"] - counts["out"])

    def reset_zone_counts(self, zone_id: int):
        """Reset counts for a zone (e.g., at end of shift)."""
        self.zone_counts[zone_id] = {"in": 0, "out": 0}

    def cleanup_track(self, track_id: str):
        """Remove tracking data for a deregistered track."""
        self.prev_positions.pop(track_id, None)
        # Clean up all crossing records for this track
        keys_to_remove = [k for k in self._last_crossing if k[0] == track_id]
        for k in keys_to_remove:
            del self._last_crossing[k]
