"""Analytics API — Dashboard stats, traffic trends, and zone reports."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract, and_
from typing import List
from datetime import datetime, timezone, timedelta

from app.core.database import get_db
from app.models.models import (
    Camera, CameraStatus as CameraStatusEnum,
    ActiveTrack, Visitor, VisitorStatus as VisitorStatusEnum,
    Employee, Alert, AlertSeverity as AlertSeverityEnum, Zone,
)
from app.schemas.schemas import SystemStats, AnalyticsDashboard, HourlyTrafficPoint

router = APIRouter()


def _get_system_stats(db: Session) -> SystemStats:
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    total_cameras = db.query(Camera).count()
    active_cameras = db.query(Camera).filter(Camera.status == CameraStatusEnum.ACTIVE).count()
    offline_cameras = db.query(Camera).filter(Camera.status == CameraStatusEnum.OFFLINE).count()
    active_tracks = db.query(ActiveTrack).filter(
        ActiveTrack.is_active == True,
        ActiveTrack.last_seen >= datetime.now(timezone.utc) - timedelta(seconds=10),
    ).count()

    total_visitors = db.query(Visitor).count()
    blacklisted = db.query(Visitor).filter(Visitor.status == VisitorStatusEnum.BLACKLISTED).count()
    watchlist = db.query(Visitor).filter(Visitor.status == VisitorStatusEnum.WATCHLIST).count()

    total_employees = db.query(Employee).count()
    active_employees = db.query(Employee).filter(Employee.is_active == True).count()

    total_alerts_today = db.query(Alert).filter(Alert.timestamp >= today_start).count()
    unacknowledged = db.query(Alert).filter(Alert.acknowledged == False).count()
    critical = db.query(Alert).filter(
        Alert.severity == AlertSeverityEnum.CRITICAL,
        Alert.acknowledged == False,
    ).count()

    return SystemStats(
        total_cameras=total_cameras,
        active_cameras=active_cameras,
        offline_cameras=offline_cameras,
        active_tracks=active_tracks,
        total_visitors=total_visitors,
        blacklisted_visitors=blacklisted,
        watchlist_visitors=watchlist,
        total_employees=total_employees,
        active_employees=active_employees,
        total_alerts_today=total_alerts_today,
        unacknowledged_alerts=unacknowledged,
        critical_alerts=critical,
    )


@router.get("/", response_model=AnalyticsDashboard)
def get_analytics_dashboard(db: Session = Depends(get_db)):
    """
    Full analytics dashboard payload — stats, hourly traffic, and top alert zones.
    """
    stats = _get_system_stats(db)

    # Hourly traffic for the last 12 hours
    now = datetime.now(timezone.utc)
    hourly_traffic = []
    for i in range(11, -1, -1):
        hour_start = (now - timedelta(hours=i)).replace(minute=0, second=0, microsecond=0)
        hour_end = hour_start + timedelta(hours=1)

        # Count unique global_ids seen in this hour
        passenger_count = (
            db.query(func.count(func.distinct(ActiveTrack.global_id)))
            .filter(
                ActiveTrack.first_seen >= hour_start,
                ActiveTrack.first_seen < hour_end,
            )
            .scalar() or 0
        )

        alert_count = (
            db.query(func.count(Alert.id))
            .filter(Alert.timestamp >= hour_start, Alert.timestamp < hour_end)
            .scalar() or 0
        )

        hourly_traffic.append(
            HourlyTrafficPoint(
                hour=hour_start.strftime("%H:00"),
                passenger_count=passenger_count,
                alert_count=alert_count,
            )
        )

    # Top zones by alert count (last 24 hours)
    since_24h = now - timedelta(hours=24)
    top_zones_raw = (
        db.query(Zone.name, func.count(Alert.id).label("alert_count"))
        .join(Alert, Alert.zone_id == Zone.id)
        .filter(Alert.timestamp >= since_24h)
        .group_by(Zone.name)
        .order_by(func.count(Alert.id).desc())
        .limit(5)
        .all()
    )
    top_alert_zones = [{"zone": row[0], "alert_count": row[1]} for row in top_zones_raw]

    # Camera status summary (FPS requires live Prometheus metrics; show status-based value)
    cameras = db.query(Camera).all()
    camera_fps = [
        {"camera_id": c.id, "name": c.name, "fps": 25.0 if c.status == CameraStatusEnum.ACTIVE else 0.0, "status": c.status.value if hasattr(c.status, 'value') else str(c.status)}
        for c in cameras
    ]

    return AnalyticsDashboard(
        stats=stats,
        hourly_traffic=hourly_traffic,
        top_alert_zones=top_alert_zones,
        camera_fps=camera_fps,
    )


@router.get("/stats", response_model=SystemStats)
def get_stats(db: Session = Depends(get_db)):
    """Quick stats-only response (lighter than full dashboard)."""
    return _get_system_stats(db)


@router.get("/entry-exit")
def get_entry_exit_counts(
    hours: int = Query(24, ge=1, le=168),
    db: Session = Depends(get_db),
):
    """
    Aggregate entry/exit event counts per hour for the last N hours.
    Uses Python-side hourly bucketing for SQLite + PostgreSQL compatibility.
    """
    now = datetime.now(timezone.utc)
    since = now - timedelta(hours=hours)

    # Fetch all alerts in range and bucket them by hour in Python
    # (avoids func.date_trunc which is PostgreSQL-only)
    alerts_in_range = (
        db.query(Alert.timestamp)
        .filter(Alert.timestamp >= since)
        .all()
    )

    # Build hourly buckets
    buckets: dict = {}
    for i in range(hours):
        bucket_key = (now - timedelta(hours=hours - 1 - i)).replace(minute=0, second=0, microsecond=0)
        buckets[bucket_key] = 0

    for (ts,) in alerts_in_range:
        if ts is None:
            continue
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        bucket_key = ts.replace(minute=0, second=0, microsecond=0)
        if bucket_key in buckets:
            buckets[bucket_key] += 1

    return [
        {"hour": k.strftime("%Y-%m-%dT%H:00:00Z"), "count": v}
        for k, v in sorted(buckets.items())
    ]
