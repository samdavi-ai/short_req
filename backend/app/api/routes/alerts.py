"""Alerts API — Security alert management with acknowledge workflow."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone, timedelta

from app.core.database import get_db
from app.models.models import Alert
from app.schemas.schemas import AlertCreate, AlertAcknowledge, AlertResponse

router = APIRouter()


@router.get("/", response_model=List[AlertResponse])
def list_alerts(
    acknowledged: Optional[bool] = Query(None, description="Filter by acknowledgement status"),
    severity: Optional[str] = Query(None, description="CRITICAL|HIGH|MEDIUM|LOW"),
    alert_type: Optional[str] = Query(None, description="RESTRICTED_ZONE|WATCHLIST_MATCH|etc"),
    camera_id: Optional[int] = Query(None),
    hours: Optional[int] = Query(24, description="Return alerts from last N hours"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """
    List alerts with flexible filters.
    Defaults to last 24 hours, unacknowledged only is configurable.
    """
    query = db.query(Alert)

    if acknowledged is not None:
        query = query.filter(Alert.acknowledged == acknowledged)
    if severity:
        query = query.filter(Alert.severity == severity)
    if alert_type:
        query = query.filter(Alert.alert_type == alert_type)
    if camera_id is not None:
        query = query.filter(Alert.camera_id == camera_id)
    if hours:
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
        query = query.filter(Alert.timestamp >= since)

    return (
        query
        .order_by(Alert.timestamp.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/unacknowledged/count")
def count_unacknowledged(db: Session = Depends(get_db)):
    """Quick count of unacknowledged alerts (used by UI badge)."""
    count = db.query(Alert).filter(Alert.acknowledged == False).count()
    return {"count": count}


@router.get("/{alert_id}", response_model=AlertResponse)
def get_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert


@router.post("/", response_model=AlertResponse, status_code=201)
def create_alert(alert_in: AlertCreate, db: Session = Depends(get_db)):
    """
    Create a new alert (called internally by the processing pipeline
    or triggered manually by an operator).
    """
    db_alert = Alert(**alert_in.model_dump())
    db.add(db_alert)
    db.commit()
    db.refresh(db_alert)
    return db_alert


@router.post("/{alert_id}/acknowledge", response_model=AlertResponse)
def acknowledge_alert(
    alert_id: int,
    body: AlertAcknowledge,
    db: Session = Depends(get_db),
):
    """Acknowledge an alert — records who acknowledged it and when."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    if alert.acknowledged:
        raise HTTPException(status_code=409, detail="Alert already acknowledged")

    alert.acknowledged = True
    alert.acknowledged_by = body.acknowledged_by
    alert.acknowledged_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(alert)
    return alert


@router.post("/bulk-acknowledge", response_model=dict)
def bulk_acknowledge(
    alert_ids: List[int],
    acknowledged_by: str = Query(...),
    db: Session = Depends(get_db),
):
    """Acknowledge multiple alerts at once (e.g., end-of-shift bulk clear)."""
    now = datetime.now(timezone.utc)
    updated = (
        db.query(Alert)
        .filter(Alert.id.in_(alert_ids), Alert.acknowledged == False)
        .all()
    )

    for alert in updated:
        alert.acknowledged = True
        alert.acknowledged_by = acknowledged_by
        alert.acknowledged_at = now

    db.commit()
    return {"acknowledged_count": len(updated)}


@router.delete("/{alert_id}", status_code=204)
def delete_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    db.delete(alert)
    db.commit()
