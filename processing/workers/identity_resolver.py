"""
IdentityResolver — Central orchestrator for person identification.

Combines cross-camera ReID (GlobalTracker), face matching (WatchlistMatcher),
and classification logic to label every detected person as:
  KNOWN_EMPLOYEE, KNOWN_VISITOR, WATCHLIST_MATCH, BLACKLISTED, or UNKNOWN.

Also triggers real-time WATCHLIST_MATCH alerts.
"""

import json
import time
import logging
from typing import Optional, Dict

logger = logging.getLogger(__name__)


class IdentityResolver:
    # Cache identity results to avoid re-matching every frame
    IDENTITY_CACHE_TTL = 10  # seconds — re-check identity every 10s

    def __init__(self, global_tracker, watchlist_matcher, redis_client=None):
        """
        Args:
            global_tracker: GlobalTracker instance (cross-camera ReID)
            watchlist_matcher: WatchlistMatcher instance (DB face index)
            redis_client: Redis client for publishing alerts (optional)
        """
        self.global_tracker = global_tracker
        self.watchlist_matcher = watchlist_matcher
        self.redis_client = redis_client

        # global_id → {identity_type, person_id, person_name, last_checked}
        self._identity_cache: Dict[str, dict] = {}

        # Track which alerts we've already fired to avoid duplicates
        self._fired_alerts: set = set()

        logger.info("IdentityResolver initialized.")

    def resolve(self, global_id: str, face_vector, body_vector,
                head_vector, camera_id: int, floor: int = 1) -> Dict:
        """
        Full identity resolution pipeline for a single detected person.

        Steps:
            1. Cross-camera ReID via GlobalTracker
            2. Check identity cache
            3. Face match against enrolled visitors/employees
            4. Classify as KNOWN_EMPLOYEE / KNOWN_VISITOR / WATCHLIST / BLACKLISTED / UNKNOWN
            5. Trigger watchlist alerts if applicable

        Args:
            global_id: The cross-camera UUID from GlobalTracker
            face_vector: 512-dim face embedding or None
            body_vector: 2048-dim body ReID embedding or None
            head_vector: 256-dim head-top embedding or None
            camera_id: source camera
            floor: floor number

        Returns:
            dict: {
                "global_id": str,
                "identity_type": str,
                "matched_person_id": int | None,
                "matched_name": str | None,
                "person_type": str | None,   # "visitor" or "employee"
                "similarity": float | None,
                "matched_via": str,
            }
        """
        now = time.time()

        # Check cache first — don't re-match every frame
        cached = self._identity_cache.get(global_id)
        if cached and (now - cached.get("last_checked", 0)) < self.IDENTITY_CACHE_TTL:
            return cached

        # Get current identity info from global tracker
        existing_identity = self.global_tracker.get_identity(global_id)
        matched_via = existing_identity.get("matched_via", "unknown")

        # Default result
        result = {
            "global_id": global_id,
            "identity_type": "UNKNOWN",
            "matched_person_id": None,
            "matched_name": None,
            "person_type": None,
            "similarity": None,
            "matched_via": matched_via,
            "last_checked": now,
        }

        # If already identified as a known person, keep that identity
        if existing_identity.get("identity_type") not in (None, "UNKNOWN"):
            result["identity_type"] = existing_identity["identity_type"]
            result["matched_person_id"] = existing_identity["matched_person_id"]
            result["matched_name"] = existing_identity["matched_name"]
            self._identity_cache[global_id] = result
            return result

        # Attempt face-based identification
        face_match = None
        if face_vector is not None:
            face_match = self.watchlist_matcher.match_face(face_vector)

        if face_match:
            person_type = face_match["person_type"]
            status = face_match["status"]

            if person_type == "employee":
                result["identity_type"] = "KNOWN_EMPLOYEE"
            elif status == "BLACKLISTED":
                result["identity_type"] = "BLACKLISTED"
            elif status == "WATCHLIST":
                result["identity_type"] = "WATCHLIST_MATCH"
            else:
                result["identity_type"] = "KNOWN_VISITOR"

            result["matched_person_id"] = face_match["person_id"]
            result["matched_name"] = face_match["fullname"]
            result["person_type"] = person_type
            result["similarity"] = face_match["similarity"]

            # Persist identity in GlobalTracker cache
            self.global_tracker.set_identity(
                global_id,
                identity_type=result["identity_type"],
                person_id=face_match["person_id"],
                person_name=face_match["fullname"],
            )

            # Trigger alert for watchlist/blacklisted persons
            if result["identity_type"] in ("BLACKLISTED", "WATCHLIST_MATCH"):
                self._fire_watchlist_alert(global_id, camera_id, face_match)

        # Cache the result
        self._identity_cache[global_id] = result
        return result

    def _fire_watchlist_alert(self, global_id: str, camera_id: int, match: dict):
        """
        Publish a WATCHLIST_MATCH alert to Redis for WebSocket broadcast.
        Deduplicates so the same person doesn't trigger repeat alerts.
        """
        alert_key = (global_id, match["person_id"])
        if alert_key in self._fired_alerts:
            return

        self._fired_alerts.add(alert_key)

        event = {
            "type": "ALERT_NEW",
            "camera_id": camera_id,
            "data": {
                "alert_type": "WATCHLIST_MATCH",
                "severity": "CRITICAL" if match["status"] == "BLACKLISTED" else "HIGH",
                "description": (
                    f"🚨 {match['status']} person detected: {match['fullname']} "
                    f"(ID: {match['person_id']}, similarity: {match['similarity']:.2%})"
                ),
                "global_id": global_id,
                "matched_person_id": match["person_id"],
                "matched_name": match["fullname"],
                "timestamp": str(time.time()),
                "acknowledged": False,
            }
        }

        if self.redis_client:
            try:
                self.redis_client.publish("ws_events", json.dumps(event, default=str))
                logger.warning("WATCHLIST ALERT published for %s (global_id: %s)",
                               match["fullname"], global_id)
            except Exception as e:
                logger.error("Failed to publish watchlist alert: %s", e)

    def clear_stale_cache(self, max_age: float = 300):
        """Remove cached identities older than max_age seconds."""
        now = time.time()
        stale = [gid for gid, data in self._identity_cache.items()
                 if now - data.get("last_checked", 0) > max_age]
        for gid in stale:
            del self._identity_cache[gid]

    @property
    def known_count(self) -> int:
        """Count of currently identified (non-unknown) persons."""
        return sum(1 for d in self._identity_cache.values()
                   if d.get("identity_type") != "UNKNOWN")

    @property
    def unknown_count(self) -> int:
        return sum(1 for d in self._identity_cache.values()
                   if d.get("identity_type") == "UNKNOWN")
