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
    active_tracks = db.query(ActiveTrack).filter(ActiveTrack.is_active == True).count()

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

    # Camera FPS (mock values — will be replaced by real Prometheus metrics)
    cameras = db.query(Camera).filter(Camera.status == CameraStatusEnum.ACTIVE).all()
    camera_fps = [
        {"camera_id": c.id, "name": c.name, "fps": 29.5 if c.status == "ACTIVE" else 0}
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
    Based on Alert records of type RESTRICTED_ZONE (proxy for crossings).
    """
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    rows = (
        db.query(
            func.date_trunc("hour", Alert.timestamp).label("hour"),
            func.count(Alert.id).label("count"),
        )
        .filter(Alert.timestamp >= since)
        .group_by(func.date_trunc("hour", Alert.timestamp))
        .order_by(func.date_trunc("hour", Alert.timestamp))
        .all()
    )
    return [{"hour": str(row.hour), "count": row.count} for row in rows]
