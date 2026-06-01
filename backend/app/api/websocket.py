"""
WebSocket server with Redis pub/sub integration.

Architecture:
  Processing workers  →  publish to Redis channel "ws_events"
  WebSocket server    →  subscribes and forwards to all connected clients
  Frontend clients    →  receive real-time TRACK_UPDATE, ALERT_NEW, CAMERA_STATUS events
"""

import asyncio
import json
import logging
from typing import Dict, Set

import redis.asyncio as aioredis
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from starlette.websockets import WebSocketState

from app.core.config import settings

logger = logging.getLogger(__name__)
ws_router = APIRouter()

# ─── Redis pub/sub channel names ─────────────────────────────────────────────
WS_CHANNEL = "ws_events"


# ─── Connection Manager ────────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        # camera_id → set of connected WebSockets
        self._camera_subs: Dict[int, Set[WebSocket]] = {}
        # WebSockets subscribed to all events (no camera filter)
        self._global_subs: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket, camera_id: int | None = None):
        await websocket.accept()
        if camera_id is not None:
            self._camera_subs.setdefault(camera_id, set()).add(websocket)
        else:
            self._global_subs.add(websocket)
        logger.info(
            "WS client connected. camera_id=%s global=%d camera_rooms=%d",
            camera_id, len(self._global_subs), len(self._camera_subs),
        )

    def disconnect(self, websocket: WebSocket, camera_id: int | None = None):
        if camera_id is not None:
            self._camera_subs.get(camera_id, set()).discard(websocket)
        else:
            self._global_subs.discard(websocket)

    async def _safe_send(self, ws: WebSocket, payload: str):
        """Send to a WebSocket, silently handle closed connections."""
        try:
            if ws.client_state == WebSocketState.CONNECTED:
                await ws.send_text(payload)
        except Exception:
            pass

    async def broadcast(self, message: dict):
        """Broadcast a message to all connected clients."""
        payload = json.dumps(message, default=str)
        tasks = []

        # Global subscribers
        for ws in list(self._global_subs):
            tasks.append(self._safe_send(ws, payload))

        # Camera-specific subscribers (also receive global broadcasts)
        for ws_set in self._camera_subs.values():
            for ws in list(ws_set):
                tasks.append(self._safe_send(ws, payload))

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def send_to_camera_room(self, camera_id: int, message: dict):
        """Send a message only to clients subscribed to a specific camera."""
        payload = json.dumps(message, default=str)
        room = self._camera_subs.get(camera_id, set())
        tasks = [self._safe_send(ws, payload) for ws in list(room)]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    @property
    def total_connections(self) -> int:
        cam_total = sum(len(v) for v in self._camera_subs.values())
        return len(self._global_subs) + cam_total


manager = ConnectionManager()


# ─── Redis Subscriber Task ─────────────────────────────────────────────────────

async def redis_subscriber():
    """
    Long-running background coroutine that subscribes to the Redis channel
    and pushes all messages to connected WebSocket clients.
    Started once at app startup.
    """
    while True:
        try:
            redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
            pubsub = redis.pubsub()
            await pubsub.subscribe(WS_CHANNEL)
            logger.info("Redis subscriber listening on channel: %s", WS_CHANNEL)

            async for message in pubsub.listen():
                if message["type"] != "message":
                    continue
                try:
                    data = json.loads(message["data"])
                    cam_id = data.get("camera_id")

                    # Route to specific camera room if camera_id is present
                    if cam_id is not None:
                        await manager.send_to_camera_room(int(cam_id), data)
                    # Always broadcast to global subscribers
                    await manager.broadcast(data)

                except json.JSONDecodeError:
                    logger.warning("Received non-JSON message from Redis: %s", message["data"])
                except Exception as e:
                    logger.error("Error processing Redis message: %s", e)

        except Exception as e:
            logger.error("Redis subscriber disconnected: %s. Reconnecting in 3s...", e)
            await asyncio.sleep(3)


# ─── WebSocket Endpoint ────────────────────────────────────────────────────────

@ws_router.websocket("/ws")
async def websocket_global(websocket: WebSocket):
    """
    Global WebSocket endpoint — receives all system events.
    Connect here to get TRACK_UPDATE, ALERT_NEW, CAMERA_STATUS from all cameras.
    """
    await manager.connect(websocket, camera_id=None)
    try:
        await websocket.send_json({
            "type": "CONNECTION_ESTABLISHED",
            "message": "Connected to Airport Surveillance global feed",
            "total_connections": manager.total_connections,
        })

        while True:
            # Keep connection alive; accept optional client-side commands
            raw = await websocket.receive_text()
            try:
                cmd = json.loads(raw)
                await _handle_client_command(websocket, cmd)
            except json.JSONDecodeError:
                pass

    except WebSocketDisconnect:
        manager.disconnect(websocket, camera_id=None)
        logger.info("Global WS client disconnected")


@ws_router.websocket("/ws/camera/{camera_id}")
async def websocket_camera(websocket: WebSocket, camera_id: int):
    """
    Per-camera WebSocket endpoint — receives events only for a specific camera.
    Useful for the single-camera detail view in the Live View panel.
    """
    await manager.connect(websocket, camera_id=camera_id)
    try:
        await websocket.send_json({
            "type": "CONNECTION_ESTABLISHED",
            "message": f"Connected to camera {camera_id} feed",
        })

        while True:
            await websocket.receive_text()   # keep alive

    except WebSocketDisconnect:
        manager.disconnect(websocket, camera_id=camera_id)


# ─── Client Command Handler ────────────────────────────────────────────────────

async def _handle_client_command(websocket: WebSocket, cmd: dict):
    """
    Handle optional commands sent FROM the client over WebSocket.
    E.g., ping, request_snapshot, subscribe_camera.
    """
    cmd_type = cmd.get("type", "").upper()

    if cmd_type == "PING":
        await websocket.send_json({"type": "PONG"})

    elif cmd_type == "STATUS":
        await websocket.send_json({
            "type": "STATUS",
            "total_connections": manager.total_connections,
        })

    else:
        logger.debug("Unknown WS command: %s", cmd_type)


# ─── Internal publish helper (used by API routes to push instant alerts) ──────

_redis_publish_client: aioredis.Redis | None = None


async def get_publish_client() -> aioredis.Redis:
    global _redis_publish_client
    if _redis_publish_client is None:
        _redis_publish_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis_publish_client


async def publish_event(event: dict):
    """
    Helper to publish an event to Redis from anywhere inside the app
    (e.g., alert creation triggers immediate WS push).
    """
    try:
        redis = await get_publish_client()
        await redis.publish(WS_CHANNEL, json.dumps(event, default=str))
    except Exception as e:
        logger.error("Failed to publish event to Redis: %s", e)
