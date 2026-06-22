"""
GlobalTracker — Cross-Camera Person Re-Identification Engine.

Maintains a spatio-temporal cache of all tracked persons across cameras.
Uses multi-signal fusion (face + body + head + spatio-temporal) with
camera-type-aware weighted cosine similarity to match detections across
camera boundaries.

Fusion weight profiles (from PROJECT_REQUIREMENTS.md):
  Overhead (80% of cameras): body=0.50, head=0.30, face=0.00, spatial=0.20
  Face-capture camera:       body=0.15, head=0.10, face=0.60, spatial=0.15
  Mixed camera:              body=0.30, head=0.20, face=0.30, spatial=0.20
"""

import uuid
import time
import logging
import numpy as np

logger = logging.getLogger(__name__)


# ── Fusion Weight Profiles ────────────────────────────────────────────────────
# Keys: (body, head, face, spatial)

WEIGHT_PROFILES = {
    "overhead": {"body": 0.50, "head": 0.30, "face": 0.00, "spatial": 0.20},
    "face_capture": {"body": 0.15, "head": 0.10, "face": 0.60, "spatial": 0.15},
    "mixed": {"body": 0.30, "head": 0.20, "face": 0.30, "spatial": 0.20},
}


class GlobalTracker:
    # ── Thresholds ────────────────────────────────────────────────────────
    MATCH_THRESHOLD_FULL = 0.60       # body + head + spatial (overhead default)
    MATCH_THRESHOLD_FACE = 0.48       # face-only match (ArcFace dot product)
    MATCH_THRESHOLD_BODY_ONLY = 0.55  # body-only fallback
    MATCH_THRESHOLD_HEAD_ONLY = 0.70  # head-only is unreliable
    EMA_ALPHA = 0.3                   # exponential moving average for embedding drift
    STALE_SECONDS = 300               # drop tracks not seen for 5 minutes

    # ── Spatio-temporal parameters ────────────────────────────────────────
    # Typical walking speed in an airport: ~1.2 m/s → ~72 m/min
    # Adjacent cameras on same floor: expect <60s gap
    # Cross-floor: expect 60-180s gap (elevator/escalator)
    SAME_FLOOR_MAX_GAP_S = 120       # max plausible gap on same floor
    CROSS_FLOOR_MAX_GAP_S = 300      # max plausible gap across floors
    SHORT_GAP_BOOST_S = 5            # gap < 5s → high spatio-temporal score

    def __init__(self):
        """
        spatio_temporal_cache: global_id -> {
            "camera_id": int,
            "floor": int,
            "face_vector": np.ndarray | None,
            "body_vector": np.ndarray | None,
            "head_vector": np.ndarray | None,
            "last_seen": float (epoch),
            "matched_via": str,
            "identity_type": str,       # UNKNOWN / KNOWN_VISITOR / KNOWN_EMPLOYEE / WATCHLIST / BLACKLISTED
            "matched_person_id": int | None,
            "matched_name": str | None,
        }
        """
        self.spatio_temporal_cache = {}
        logger.info("Global Multi-Camera Tracker initialized (overhead-first multi-signal fusion).")

    # ── Vector math ───────────────────────────────────────────────────────

    @staticmethod
    def cosine_similarity(v1, v2):
        """Cosine similarity between two vectors. Returns -1..1."""
        if v1 is None or v2 is None:
            return 0.0
        a = np.asarray(v1, dtype=np.float32)
        b = np.asarray(v2, dtype=np.float32)
        if a.shape != b.shape:
            return 0.0
        dot = np.dot(a, b)
        norm = np.linalg.norm(a) * np.linalg.norm(b) + 1e-12
        return float(dot / norm)

    @staticmethod
    def _is_zero_vector(vec):
        """Check if a vector is all zeros or None."""
        if vec is None:
            return True
        arr = np.asarray(vec)
        return np.allclose(arr, 0)

    # ── EMA update ────────────────────────────────────────────────────────

    def _ema_update(self, old_vec, new_vec):
        """
        Exponential moving average to gradually adapt stored embeddings
        to appearance drift (lighting, angle, partial occlusion).
        """
        if old_vec is None:
            return new_vec
        if new_vec is None:
            return old_vec
        old = np.asarray(old_vec, dtype=np.float32)
        new = np.asarray(new_vec, dtype=np.float32)
        blended = self.EMA_ALPHA * new + (1 - self.EMA_ALPHA) * old
        # Re-normalize
        norm = np.linalg.norm(blended) + 1e-12
        return (blended / norm).tolist()

    # ── Housekeeping ──────────────────────────────────────────────────────

    def _purge_stale(self):
        """Remove tracks that haven't been seen for STALE_SECONDS."""
        now = time.time()
        stale_ids = [
            gid for gid, data in self.spatio_temporal_cache.items()
            if now - data.get("last_seen", 0) > self.STALE_SECONDS
        ]
        for gid in stale_ids:
            del self.spatio_temporal_cache[gid]
        if stale_ids:
            logger.debug("Purged %d stale global tracks.", len(stale_ids))

    # ── Spatio-temporal scoring ───────────────────────────────────────────

    def _compute_spatiotemporal_score(self, camera_id, floor, cached_data):
        """
        Compute spatio-temporal plausibility score (0.0 – 1.0).

        High score when:
          - Same camera, short gap → very likely same person
          - Same floor, reasonable gap → plausible handoff
        Low score when:
          - Different floor, very short gap → physically impossible
          - Very long gap → person could be anyone
        """
        now = time.time()
        cached_camera = cached_data.get("camera_id", -1)
        cached_floor = cached_data.get("floor", -1)
        last_seen = cached_data.get("last_seen", 0)
        time_gap = now - last_seen

        if time_gap <= 0:
            time_gap = 0.01  # avoid division by zero

        # Same camera, short gap → very high confidence (same person continuing)
        if cached_camera == camera_id:
            if time_gap < self.SHORT_GAP_BOOST_S:
                return 1.0
            elif time_gap < 30:
                return 0.85
            elif time_gap < 120:
                return 0.5
            else:
                return 0.2

        # Different camera, same floor → cross-camera handoff
        if cached_floor == floor:
            if time_gap < self.SHORT_GAP_BOOST_S:
                # Too fast for different camera — slightly suspicious but possible
                return 0.6
            elif time_gap < 60:
                # Sweet spot: person walked from one camera to adjacent camera
                return 0.8
            elif time_gap < self.SAME_FLOOR_MAX_GAP_S:
                # Plausible but decreasing confidence
                return max(0.3, 1.0 - (time_gap / self.SAME_FLOOR_MAX_GAP_S))
            else:
                return 0.1

        # Different floor → requires elevator/escalator/stairs
        if time_gap < 15:
            # Physically impossible to change floors in <15 seconds
            return 0.0
        elif time_gap < 90:
            # Plausible via escalator/elevator
            return 0.6
        elif time_gap < self.CROSS_FLOOR_MAX_GAP_S:
            return max(0.2, 1.0 - (time_gap / self.CROSS_FLOOR_MAX_GAP_S))
        else:
            return 0.05

    # ── Weight profile selection ──────────────────────────────────────────

    @staticmethod
    def _get_weight_profile(is_overhead, has_face):
        """
        Select the fusion weight profile based on camera type and
        whether a face was detected in this frame.
        """
        if is_overhead:
            if has_face:
                # Overhead camera but face was detected (rare upward glance)
                return WEIGHT_PROFILES["mixed"]
            return WEIGHT_PROFILES["overhead"]
        else:
            if has_face:
                return WEIGHT_PROFILES["face_capture"]
            # Face-capture camera but no face visible this frame
            return WEIGHT_PROFILES["mixed"]

    # ── Core matching ─────────────────────────────────────────────────────

    def match_or_create(self, face_vector, body_vector, head_vector,
                        camera_id, floor=1, is_overhead=True, exclude_ids=None):
        """
        Match a new detection against all cached global tracks using
        camera-type-aware weighted multi-signal fusion with
        spatio-temporal scoring.

        Args:
            face_vector: 512-dim face embedding or None
            body_vector: 2048-dim body ReID embedding or None
            head_vector: 256-dim head-top embedding or None
            camera_id: source camera
            floor: floor number for spatial gating
            is_overhead: True if this is a ceiling-mounted camera
            exclude_ids: set of global_ids already matched in the current frame

        Returns:
            str: matched or newly created global_id
        """
        self._purge_stale()

        has_face = not self._is_zero_vector(face_vector)
        has_body = not self._is_zero_vector(body_vector)
        has_head = not self._is_zero_vector(head_vector)

        # Select weight profile for THIS camera
        weights = self._get_weight_profile(is_overhead, has_face)

        best_match_id = None
        best_score = -1.0

        for gid, data in self.spatio_temporal_cache.items():
            if exclude_ids and gid in exclude_ids:
                continue
            score = self._compute_fusion_score(
                face_vector, body_vector, head_vector,
                has_face, has_body, has_head,
                data, camera_id, floor, weights
            )
            if score > best_score:
                best_score = score
                best_match_id = gid

        # Determine dynamic threshold based on available signals
        threshold = self._select_threshold(has_face, has_body, has_head, is_overhead)

        if best_score >= threshold and best_match_id:
            # Update existing track with EMA blended embeddings
            entry = self.spatio_temporal_cache[best_match_id]
            if has_face:
                entry["face_vector"] = self._ema_update(entry.get("face_vector"), face_vector)
            if has_body:
                entry["body_vector"] = self._ema_update(entry.get("body_vector"), body_vector)
            if has_head:
                entry["head_vector"] = self._ema_update(entry.get("head_vector"), head_vector)
            entry["camera_id"] = camera_id
            entry["floor"] = floor
            entry["last_seen"] = time.time()
            entry["matched_via"] = self._describe_match(has_face, has_body, has_head)
            return best_match_id

        # No match — create new global ID
        global_id = str(uuid.uuid4())
        self.spatio_temporal_cache[global_id] = {
            "camera_id": camera_id,
            "floor": floor,
            "face_vector": face_vector if has_face else None,
            "body_vector": body_vector if has_body else None,
            "head_vector": head_vector if has_head else None,
            "last_seen": time.time(),
            "matched_via": "new_track",
            "identity_type": "UNKNOWN",
            "matched_person_id": None,
            "matched_name": None,
        }
        return global_id

    def _select_threshold(self, has_face, has_body, has_head, is_overhead):
        """Select matching threshold based on available signals and camera type."""
        if has_face and not is_overhead:
            # Face-capture camera with face visible → ArcFace threshold
            return self.MATCH_THRESHOLD_FACE
        if has_face and has_body:
            return self.MATCH_THRESHOLD_FULL
        if has_body and has_head:
            # Overhead: body + head (primary signals)
            return self.MATCH_THRESHOLD_FULL
        if has_body:
            return self.MATCH_THRESHOLD_BODY_ONLY
        if has_head:
            return self.MATCH_THRESHOLD_HEAD_ONLY
        # Nothing meaningful
        return 0.85

    @staticmethod
    def _describe_match(has_face, has_body, has_head):
        """Human-readable description of which signals contributed."""
        parts = []
        if has_face:
            parts.append("face")
        if has_body:
            parts.append("body")
        if has_head:
            parts.append("head")
        return "+".join(parts) if parts else "spatial_only"

    def _compute_fusion_score(self, face_vec, body_vec, head_vec,
                              has_face, has_body, has_head,
                              cached_data, camera_id, floor, weights):
        """
        Compute a weighted similarity score between new vectors and
        a cached track entry. Uses camera-type-aware fusion weights
        and includes spatio-temporal plausibility scoring.
        """
        cached_face = cached_data.get("face_vector")
        cached_body = cached_data.get("body_vector")
        cached_head = cached_data.get("head_vector")

        components = []
        active_weights = []

        # Face similarity
        if has_face and cached_face is not None and weights["face"] > 0:
            sim = self.cosine_similarity(face_vec, cached_face)
            components.append(sim)
            active_weights.append(weights["face"])

        # Body similarity
        if has_body and cached_body is not None and weights["body"] > 0:
            sim = self.cosine_similarity(body_vec, cached_body)
            components.append(sim)
            active_weights.append(weights["body"])

        # Head similarity
        if has_head and cached_head is not None and weights["head"] > 0:
            sim = self.cosine_similarity(head_vec, cached_head)
            components.append(sim)
            active_weights.append(weights["head"])

        # Spatio-temporal score (always computed)
        if weights["spatial"] > 0:
            st_score = self._compute_spatiotemporal_score(camera_id, floor, cached_data)
            components.append(st_score)
            active_weights.append(weights["spatial"])

        if not components:
            return 0.0

        total_weight = sum(active_weights)
        weighted_score = sum(c * w for c, w in zip(components, active_weights)) / total_weight
        return weighted_score

    # ── Identity annotation ───────────────────────────────────────────────

    def set_identity(self, global_id, identity_type, person_id=None, person_name=None, person_type=None):
        """
        Called by IdentityResolver when a track matches a registered person.
        """
        if global_id in self.spatio_temporal_cache:
            entry = self.spatio_temporal_cache[global_id]
            entry["identity_type"] = identity_type
            entry["matched_person_id"] = person_id
            entry["matched_name"] = person_name
            entry["person_type"] = person_type

    def get_identity(self, global_id):
        """Return cached identity info for a global_id."""
        entry = self.spatio_temporal_cache.get(global_id, {})
        return {
            "identity_type": entry.get("identity_type", "UNKNOWN"),
            "matched_person_id": entry.get("matched_person_id"),
            "matched_name": entry.get("matched_name"),
            "person_type": entry.get("person_type"),
            "matched_via": entry.get("matched_via", "unknown"),
        }

    @property
    def active_count(self):
        return len(self.spatio_temporal_cache)
