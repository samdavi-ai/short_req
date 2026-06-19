"""
WatchlistMatcher — Real-time face matching against enrolled visitors & employees.

Loads all registered face embeddings from the database on startup,
maintains an in-memory index, and performs cosine similarity matching
to identify known persons (visitors, employees) and trigger watchlist alerts.
"""

import logging
import time
import numpy as np
from typing import Optional, Dict, List, Tuple

logger = logging.getLogger(__name__)


class PersonRecord:
    """In-memory representation of an enrolled person's face embedding."""
    __slots__ = ("person_id", "person_type", "fullname", "status",
                 "face_vector", "employee_code")

    def __init__(self, person_id: int, person_type: str, fullname: str,
                 status: str, face_vector: list, employee_code: str = None):
        self.person_id = person_id
        self.person_type = person_type        # "visitor" or "employee"
        self.fullname = fullname
        self.status = status                  # WHITELISTED / BLACKLISTED / WATCHLIST / ACTIVE
        self.face_vector = np.asarray(face_vector, dtype=np.float32)
        self.employee_code = employee_code


class WatchlistMatcher:
    FACE_MATCH_THRESHOLD = 0.48       # cosine sim >= this = positive match
    BODY_MATCH_THRESHOLD = 0.55       # body ReID fallback threshold
    REFRESH_INTERVAL = 60             # seconds between DB re-syncs

    def __init__(self):
        self._registry: List[PersonRecord] = []
        self._last_refresh = 0.0
        logger.info("WatchlistMatcher initialized (in-memory cosine index).")

    # ── Registry management ───────────────────────────────────────────────

    def load_registry(self, visitors: list, employees: list):
        """
        Load enrolled face embeddings from database query results.

        Args:
            visitors: list of dicts with keys: id, fullname, status, face_vector
            employees: list of dicts with keys: id, fullname, employee_code, face_vector
        """
        self._registry.clear()
        loaded = 0

        for v in visitors:
            vec = v.get("face_vector")
            if vec and len(vec) > 0 and not np.allclose(vec, 0):
                self._registry.append(PersonRecord(
                    person_id=v["id"],
                    person_type="visitor",
                    fullname=v["fullname"],
                    status=v.get("status", "WHITELISTED"),
                    face_vector=vec,
                ))
                loaded += 1

        for e in employees:
            vec = e.get("face_vector")
            if vec and len(vec) > 0 and not np.allclose(vec, 0):
                self._registry.append(PersonRecord(
                    person_id=e["id"],
                    person_type="employee",
                    fullname=e["fullname"],
                    status="ACTIVE",
                    face_vector=vec,
                    employee_code=e.get("employee_code"),
                ))
                loaded += 1

        self._last_refresh = time.time()
        logger.info("WatchlistMatcher loaded %d enrolled persons (%d visitors, %d employees).",
                     loaded, len(visitors), len(employees))

    @property
    def needs_refresh(self) -> bool:
        return time.time() - self._last_refresh > self.REFRESH_INTERVAL

    @property
    def registry_size(self) -> int:
        return len(self._registry)

    # ── Matching ──────────────────────────────────────────────────────────

    @staticmethod
    def cosine_similarity(v1: np.ndarray, v2: np.ndarray) -> float:
        dot = np.dot(v1, v2)
        norm = np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-12
        return float(dot / norm)

    def match_face(self, face_vector) -> Optional[Dict]:
        """
        Match a face embedding against all enrolled persons.

        Returns:
            dict with {person_id, person_type, fullname, status, similarity}
            or None if no match above threshold.
        """
        if face_vector is None or len(self._registry) == 0:
            return None

        query = np.asarray(face_vector, dtype=np.float32)
        if np.allclose(query, 0):
            return None

        best_match = None
        best_sim = -1.0

        for record in self._registry:
            sim = self.cosine_similarity(query, record.face_vector)
            if sim > best_sim:
                best_sim = sim
                best_match = record

        if best_sim >= self.FACE_MATCH_THRESHOLD and best_match:
            return {
                "person_id": best_match.person_id,
                "person_type": best_match.person_type,
                "fullname": best_match.fullname,
                "status": best_match.status,
                "similarity": round(best_sim, 4),
                "employee_code": best_match.employee_code,
            }

        return None

    def match_body(self, body_vector, body_registry: Optional[List] = None) -> Optional[Dict]:
        """
        Fallback body-based matching when face is not available.
        Uses a separate body vector registry if provided.
        """
        # Body matching is a secondary signal — only used when face unavailable
        # In production, this would query a separate body embedding index
        return None

    def check_watchlist(self, face_vector) -> Optional[Dict]:
        """
        Check if a face matches a BLACKLISTED or WATCHLIST person.
        Returns match details or None.
        """
        match = self.match_face(face_vector)
        if match and match["status"] in ("BLACKLISTED", "WATCHLIST"):
            logger.warning(
                "WATCHLIST ALERT: %s person detected — %s (ID: %d, sim: %.4f)",
                match["status"], match["fullname"], match["person_id"], match["similarity"]
            )
            return match
        return None
