"""Simulation API — optional backend event publishing path."""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.routes.auth import get_current_user
from app.api.websocket import publish_event
from app.core.database import get_db
from app.models.models import User

router = APIRouter()

_sessions: Dict[str, Dict[str, Any]] = {}


class SimulationPublishRequest(BaseModel):
    floor: int
    building_id: Optional[int] = None
    site_id: Optional[int] = None
    events: List[Dict[str, Any]] = Field(default_factory=list)


class SimulationControlRequest(BaseModel):
    floor: int
    building_id: Optional[int] = None
    site_id: Optional[int] = None
    seed: int = 42
    speed: float = 1.0


class SimulationTickRequest(BaseModel):
    session_id: str
    tick: int
    events: List[Dict[str, Any]] = Field(default_factory=list)


@router.post("/start")
async def start_simulation(
    payload: SimulationControlRequest,
    _db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session_id = f"sim-{payload.site_id or 'na'}-{payload.building_id or 'na'}-{payload.floor}-{int(datetime.now(timezone.utc).timestamp())}"
    _sessions[session_id] = {
        "session_id": session_id,
        "floor": payload.floor,
        "building_id": payload.building_id,
        "site_id": payload.site_id,
        "seed": payload.seed,
        "speed": payload.speed,
        "running": True,
        "tick": 0,
        "started_by": current_user.username,
    }
    return _sessions[session_id]


@router.post("/stop")
async def stop_simulation(
    session_id: str,
    _db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    session = _sessions.get(session_id)
    if not session:
        return {"session_id": session_id, "stopped": False}
    session["running"] = False
    return {"session_id": session_id, "stopped": True}


@router.post("/tick")
async def tick_simulation(
    payload: SimulationTickRequest,
    _db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    session = _sessions.get(payload.session_id)
    if not session:
        return {"session_id": payload.session_id, "accepted": False, "reason": "missing session"}
    session["tick"] = max(session.get("tick", 0), payload.tick)
    published = 0
    for event in payload.events:
        await publish_event({
            "type": event.get("type", "SIMULATION_EVENT"),
            "source": "layout_simulator",
            "session_id": payload.session_id,
            "floor": session.get("floor"),
            "building_id": session.get("building_id"),
            "site_id": session.get("site_id"),
            **event,
        })
        published += 1
    return {"session_id": payload.session_id, "accepted": True, "published": published, "tick": session["tick"]}


@router.post("/publish")
async def publish_simulation_events(
    payload: SimulationPublishRequest,
    _db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    published = 0
    now_iso = datetime.now(timezone.utc).isoformat()
    for event in payload.events:
        envelope: Dict[str, Any] = {
            "type": event.get("type", "SIMULATION_EVENT"),
            "source": "layout_simulator",
            "floor": payload.floor,
            "building_id": payload.building_id,
            "site_id": payload.site_id,
            "timestamp": event.get("timestamp", now_iso),
            "operator": current_user.username,
            **event,
        }
        await publish_event(envelope)
        published += 1
    return {"published": published}
