"""
EmployeeBreakMonitor — Real-time break compliance tracking.

Tracks when identified employees enter/leave LOUNGE zones.
Triggers BREAK_VIOLATION alerts if an employee goes too long without a break.
"""

import time
import json
import logging
from typing import Optional, Dict

logger = logging.getLogger(__name__)


class EmployeeBreakMonitor:
    def __init__(self, redis_client=None):
        self.redis_client = redis_client

        # employee_id → last break end time (epoch)
        self.last_break_end: Dict[int, float] = {}
        # employee_id → break start time (epoch) — None if not currently on break
        self.current_break_start: Dict[int, float] = {}
        # employee_id → True if already alerted for current cycle
        self.alert_fired: Dict[int, bool] = {}
        # Default break policy
        self.default_interval_minutes = 120     # must take break every 2 hours
        self.default_min_duration_minutes = 15  # minimum 15 min break

        logger.info("EmployeeBreakMonitor initialized.")

    def update_employee_status(self, employee_id: int, in_lounge_zone: bool,
                               camera_id: int = 0,
                               break_interval_minutes: int = None,
                               break_duration_minutes: int = None) -> Dict:
        """
        Called every frame when an identified employee is detected.

        Args:
            employee_id: DB ID of the matched employee
            in_lounge_zone: True if the employee is currently inside a LOUNGE zone
            camera_id: Camera where detected
            break_interval_minutes: max minutes between breaks (from employee record)
            break_duration_minutes: minimum break duration (from employee record)

        Returns:
            dict: {
                "compliant": bool,
                "is_on_break": bool,
                "time_since_break": float (seconds),
                "overdue_by": float (seconds) or 0,
                "break_duration": float (seconds) or 0,
            }
        """
        now = time.time()
        interval = (break_interval_minutes or self.default_interval_minutes) * 60
        min_duration = (break_duration_minutes or self.default_min_duration_minutes) * 60

        # Initialize if first time seeing this employee
        if employee_id not in self.last_break_end:
            self.last_break_end[employee_id] = now  # assume they just started
            self.alert_fired[employee_id] = False

        # ── Track break state transitions ─────────────────────────────────

        if in_lounge_zone:
            # Employee entered/is in lounge → on break
            if employee_id not in self.current_break_start:
                self.current_break_start[employee_id] = now
                logger.info("Employee %d entered break zone.", employee_id)

            break_duration = now - self.current_break_start[employee_id]
            time_since_break = 0.0
            is_on_break = True

        else:
            # Employee is NOT in lounge zone
            is_on_break = False
            break_duration = 0.0

            # If they were just on break, record end time
            if employee_id in self.current_break_start:
                ended_break_duration = now - self.current_break_start[employee_id]
                del self.current_break_start[employee_id]

                if ended_break_duration >= min_duration:
                    # Valid break — reset the timer
                    self.last_break_end[employee_id] = now
                    self.alert_fired[employee_id] = False
                    logger.info("Employee %d completed valid break (%.0fs).",
                                employee_id, ended_break_duration)
                else:
                    logger.info("Employee %d left lounge early (%.0fs < %.0fs required).",
                                employee_id, ended_break_duration, min_duration)

            time_since_break = now - self.last_break_end[employee_id]

        # ── Compliance check ──────────────────────────────────────────────

        overdue_by = max(0.0, time_since_break - interval) if not is_on_break else 0.0
        compliant = time_since_break <= interval or is_on_break

        # Fire alert if overdue and not yet alerted
        if not compliant and not self.alert_fired.get(employee_id, False):
            self.alert_fired[employee_id] = True
            self._fire_break_alert(employee_id, camera_id, time_since_break, overdue_by)

        return {
            "compliant": compliant,
            "is_on_break": is_on_break,
            "time_since_break": round(time_since_break, 1),
            "overdue_by": round(overdue_by, 1),
            "break_duration": round(break_duration, 1),
        }

    def _fire_break_alert(self, employee_id: int, camera_id: int,
                          time_since: float, overdue_by: float):
        """Publish a BREAK_VIOLATION alert to Redis for WebSocket broadcast."""
        event = {
            "type": "ALERT_NEW",
            "camera_id": camera_id,
            "data": {
                "alert_type": "BREAK_VIOLATION",
                "severity": "MEDIUM",
                "description": (
                    f"⚠️ Break violation: Employee #{employee_id} has not taken a break "
                    f"for {int(time_since / 60)} minutes (overdue by {int(overdue_by / 60)} min)"
                ),
                "employee_id": employee_id,
                "time_since_break_seconds": time_since,
                "timestamp": str(time.time()),
                "acknowledged": False,
            }
        }

        if self.redis_client:
            try:
                self.redis_client.publish("ws_events", json.dumps(event, default=str))
                logger.warning("BREAK_VIOLATION alert for employee %d", employee_id)
            except Exception as e:
                logger.error("Failed to publish break alert: %s", e)

    def reset_employee(self, employee_id: int):
        """Reset all tracking state for an employee (e.g., new shift)."""
        self.last_break_end.pop(employee_id, None)
        self.current_break_start.pop(employee_id, None)
        self.alert_fired.pop(employee_id, None)
