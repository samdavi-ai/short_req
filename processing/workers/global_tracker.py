"""
GlobalTracker — Cross-Camera Person Re-Identification Engine.

Maintains a spatio-temporal cache of all tracked persons across cameras.
Uses multi-signal fusion (face + body + head embeddings) with weighted
cosine similarity to match detections across camera boundaries.
"""

import uuid
import time
import logging
import numpy as np

logger = logging.getLogger(__name__)


class GlobalTracker:
    # ── Fusion weights ────────────────────────────────────────────────────
    FACE_WEIGHT = 0.50
    BODY_WEIGHT = 0.35
    HEAD_WEIGHT = 0.15

    # ── Thresholds ────────────────────────────────────────────────────────
    MATCH_THRESHOLD = 0.55        # minimum weighted score to consider a match
    FACE_ONLY_THRESHOLD = 0.70    # face-only match when body/head unavailable
    BODY_ONLY_THRESHOLD = 0.65    # body-only match when face unavailable
    EMA_ALPHA = 0.3               # exponential moving average for embedding drift
    STALE_SECONDS = 300           # drop tracks not seen for 5 minutes

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
        logger.info("Global Multi-Camera Tracker initialized (multi-signal fusion).")

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

    # ── Core matching ─────────────────────────────────────────────────────

    def match_or_create(self, face_vector, body_vector, head_vector,
                        camera_id, floor=1):
        """
        Match a new detection against all cached global tracks using
        weighted multi-signal fusion. Returns the global_id.

        Args:
            face_vector: 512-dim face embedding or None
            body_vector: 2048-dim body ReID embedding or None
            head_vector: 256-dim head-top embedding or None
            camera_id: source camera
            floor: floor number for spatial gating

        Returns:
            str: matched or newly created global_id
        """
        self._purge_stale()

        has_face = not self._is_zero_vector(face_vector)
        has_body = not self._is_zero_vector(body_vector)
        has_head = not self._is_zero_vector(head_vector)

        best_match_id = None
        best_score = -1.0

        for gid, data in self.spatio_temporal_cache.items():
            score = self._compute_fusion_score(
                face_vector, body_vector, head_vector,
                has_face, has_body, has_head,
                data
            )
            if score > best_score:
                best_score = score
                best_match_id = gid

        # Determine dynamic threshold based on available signals
        if has_face and has_body:
            threshold = self.MATCH_THRESHOLD
        elif has_face:
            threshold = self.FACE_ONLY_THRESHOLD
        elif has_body:
            threshold = self.BODY_ONLY_THRESHOLD
        else:
            threshold = 0.80  # head-only is unreliable, require high confidence

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
            entry["matched_via"] = "fusion" if (has_face and has_body) else (
                "face" if has_face else ("body" if has_body else "head")
            )
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

    def _compute_fusion_score(self, face_vec, body_vec, head_vec,
                              has_face, has_body, has_head, cached_data):
        """
        Compute a weighted similarity score between new vectors and
        a cached track entry. Only includes signals where both sides
        have valid vectors. Re-normalizes weights accordingly.
        """
        cached_face = cached_data.get("face_vector")
        cached_body = cached_data.get("body_vector")
        cached_head = cached_data.get("head_vector")

        components = []
        weights = []

        if has_face and cached_face is not None:
            sim = self.cosine_similarity(face_vec, cached_face)
            components.append(sim)
            weights.append(self.FACE_WEIGHT)

        if has_body and cached_body is not None:
            sim = self.cosine_similarity(body_vec, cached_body)
            components.append(sim)
            weights.append(self.BODY_WEIGHT)

        if has_head and cached_head is not None:
            sim = self.cosine_similarity(head_vec, cached_head)
            components.append(sim)
            weights.append(self.HEAD_WEIGHT)

        if not components:
            return 0.0

        total_weight = sum(weights)
        weighted_score = sum(c * w for c, w in zip(components, weights)) / total_weight
        return weighted_score

    # ── Identity annotation ───────────────────────────────────────────────

    def set_identity(self, global_id, identity_type, person_id=None, person_name=None):
        """
        Called by IdentityResolver when a track matches a registered person.
        """
        if global_id in self.spatio_temporal_cache:
            entry = self.spatio_temporal_cache[global_id]
            entry["identity_type"] = identity_type
            entry["matched_person_id"] = person_id
            entry["matched_name"] = person_name

    def get_identity(self, global_id):
        """Return cached identity info for a global_id."""
        entry = self.spatio_temporal_cache.get(global_id, {})
        return {
            "identity_type": entry.get("identity_type", "UNKNOWN"),
            "matched_person_id": entry.get("matched_person_id"),
            "matched_name": entry.get("matched_name"),
            "matched_via": entry.get("matched_via", "unknown"),
        }

    @property
    def active_count(self):
        return len(self.spatio_temporal_cache)
