"""
Pydantic v2 schemas for request validation and response serialization.
"""

from pydantic import BaseModel, EmailStr, field_validator, model_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# ─── Enums (mirrors models, used in API contracts) ────────────────────────────

class CameraStatus(str, Enum):
    ACTIVE = "ACTIVE"
    OFFLINE = "OFFLINE"
    MAINTENANCE = "MAINTENANCE"

class VisitorStatus(str, Enum):
    WHITELISTED = "WHITELISTED"
    BLACKLISTED = "BLACKLISTED"
    WATCHLIST = "WATCHLIST"
    PENDING = "PENDING"

class ZoneType(str, Enum):
    DWELL = "DWELL"
    TRIPWIRE = "TRIPWIRE"
    RESTRICTED = "RESTRICTED"
    LOUNGE = "LOUNGE"

class AlertSeverity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"

class AlertType(str, Enum):
    RESTRICTED_ZONE = "RESTRICTED_ZONE"
    WATCHLIST_MATCH = "WATCHLIST_MATCH"
    BREAK_VIOLATION = "BREAK_VIOLATION"
    DWELL_EXCEEDED = "DWELL_EXCEEDED"
    CAMERA_OFFLINE = "CAMERA_OFFLINE"
    TAILGATING = "TAILGATING"


# ─── Auth ─────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    full_name: str
    password: str
    role: str = "operator"
    department: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    role: str
    department: Optional[str] = None
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime] = None

    model_config = {"from_attributes": True}

class UserLogin(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse


# ─── Cameras ─────────────────────────────────────────────────────────────────

class CameraBase(BaseModel):
    name: str
    rtsp_url: str
    location: Optional[str] = None
    description: Optional[str] = None
    floor: int = 1
    x_coord: float = 0.0
    y_coord: float = 0.0
    angle: float = 0.0
    fov: float = 90.0
    status: CameraStatus = CameraStatus.ACTIVE
    is_overhead: bool = True

class CameraCreate(CameraBase):
    pass

class CameraUpdate(BaseModel):
    """Partial update — all fields optional."""
    name: Optional[str] = None
    rtsp_url: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    floor: Optional[int] = None
    x_coord: Optional[float] = None
    y_coord: Optional[float] = None
    angle: Optional[float] = None
    fov: Optional[float] = None
    status: Optional[CameraStatus] = None
    is_overhead: Optional[bool] = None

class CameraResponse(CameraBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─── Layouts ──────────────────────────────────────────────────────────────────

class LayoutBase(BaseModel):
    floor_num: int
    name: str = "Floor Plan"
    image_path: str
    width: int = 1920
    height: int = 1080

class LayoutCreate(LayoutBase):
    pass

class LayoutUpdate(BaseModel):
    name: Optional[str] = None
    image_path: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None

class LayoutResponse(LayoutBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─── Camera Position Update (Layout Editor drag-drop) ─────────────────────────

class CameraPosition(BaseModel):
    """Used by Layout Editor to update a camera's position on the floor plan."""
    camera_id: int
    x_coord: float
    y_coord: float
    angle: float = 0.0
    floor: int

class BulkCameraPositionUpdate(BaseModel):
    positions: List[CameraPosition]


# ─── Zones ────────────────────────────────────────────────────────────────────

class ZoneCoordinate(BaseModel):
    x: float
    y: float

class ZoneBase(BaseModel):
    name: str
    floor: int = 1
    coordinates: List[ZoneCoordinate]
    zone_type: ZoneType = ZoneType.DWELL
    dwell_alert_seconds: int = 300
    color: str = "#6366f1"
    is_active: bool = True

    @field_validator("coordinates")
    @classmethod
    def validate_coordinates(cls, v):
        if len(v) < 3:
            raise ValueError("A zone must have at least 3 coordinate points to form a polygon.")
        return v

class ZoneCreate(ZoneBase):
    pass

class ZoneUpdate(BaseModel):
    name: Optional[str] = None
    coordinates: Optional[List[ZoneCoordinate]] = None
    zone_type: Optional[ZoneType] = None
    dwell_alert_seconds: Optional[int] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None

class ZoneResponse(ZoneBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Visitors ─────────────────────────────────────────────────────────────────

class VisitorBase(BaseModel):
    fullname: str
    passport_number: Optional[str] = None
    nationality: Optional[str] = None
    phone_number: Optional[str] = None
    address: Optional[str] = None
    purpose: Optional[str] = None
    notes: Optional[str] = None
    status: VisitorStatus = VisitorStatus.WHITELISTED
    requires_escort: bool = False

class VisitorCreate(VisitorBase):
    pass

class VisitorUpdate(BaseModel):
    fullname: Optional[str] = None
    passport_number: Optional[str] = None
    nationality: Optional[str] = None
    phone_number: Optional[str] = None
    address: Optional[str] = None
    purpose: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[VisitorStatus] = None
    requires_escort: Optional[bool] = None

class VisitorResponse(VisitorBase):
    id: int
    photo_path: Optional[str] = None
    face_embedding_id: Optional[str] = None
    enrolled_by: Optional[str] = None
    approved_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─── Employees ────────────────────────────────────────────────────────────────

class EmployeeBase(BaseModel):
    employee_code: str
    fullname: str
    department: Optional[str] = None
    shift: str = "MORNING"
    break_interval_minutes: int = 120
    break_duration_minutes: int = 15

class EmployeeCreate(EmployeeBase):
    pass

class EmployeeUpdate(BaseModel):
    fullname: Optional[str] = None
    department: Optional[str] = None
    shift: Optional[str] = None
    break_interval_minutes: Optional[int] = None
    break_duration_minutes: Optional[int] = None
    is_active: Optional[bool] = None

class EmployeeResponse(EmployeeBase):
    id: int
    photo_path: Optional[str] = None
    face_embedding_id: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Employee Breaks ──────────────────────────────────────────────────────────

class BreakStartRequest(BaseModel):
    employee_id: int
    lounge_zone_id: Optional[int] = None

class BreakEndRequest(BaseModel):
    break_id: int

class BreakResponse(BaseModel):
    id: int
    employee_id: int
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    compliant: bool
    lounge_zone_id: Optional[int] = None

    model_config = {"from_attributes": True}

class BreakComplianceStatus(BaseModel):
    """Real-time compliance check result."""
    employee_id: int
    employee_code: str
    fullname: str
    is_on_break: bool
    minutes_since_last_break: Optional[float] = None
    overdue: bool
    overdue_by_minutes: Optional[float] = None


# ─── Tracks ───────────────────────────────────────────────────────────────────

class TrackResponse(BaseModel):
    id: str
    camera_id: Optional[int] = None
    global_id: str
    local_track_id: Optional[int] = None
    first_seen: datetime
    last_seen: datetime
    last_x: Optional[float] = None
    last_y: Optional[float] = None
    is_active: bool
    matched_visitor_id: Optional[int] = None
    matched_employee_id: Optional[int] = None

    model_config = {"from_attributes": True}

class TrackJourney(BaseModel):
    """Cross-camera journey for a global_id."""
    global_id: str
    total_cameras_seen: int
    first_seen: datetime
    last_seen: datetime
    track_segments: List[TrackResponse]


# ─── Alerts ───────────────────────────────────────────────────────────────────

class AlertCreate(BaseModel):
    camera_id: Optional[int] = None
    track_id: Optional[str] = None
    global_id: Optional[str] = None
    alert_type: AlertType
    description: Optional[str] = None
    severity: AlertSeverity = AlertSeverity.HIGH
    zone_id: Optional[int] = None
    snapshot_path: Optional[str] = None

class AlertAcknowledge(BaseModel):
    acknowledged_by: str

class AlertResponse(BaseModel):
    id: int
    camera_id: Optional[int] = None
    track_id: Optional[str] = None
    global_id: Optional[str] = None
    alert_type: AlertType
    description: Optional[str] = None
    severity: AlertSeverity
    zone_id: Optional[int] = None
    snapshot_path: Optional[str] = None
    timestamp: datetime
    acknowledged: bool
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ─── Analytics ────────────────────────────────────────────────────────────────

class SystemStats(BaseModel):
    total_cameras: int
    active_cameras: int
    offline_cameras: int
    active_tracks: int
    total_visitors: int
    blacklisted_visitors: int
    watchlist_visitors: int
    total_employees: int
    active_employees: int
    total_alerts_today: int
    unacknowledged_alerts: int
    critical_alerts: int

class HourlyTrafficPoint(BaseModel):
    hour: str
    passenger_count: int
    alert_count: int

class AnalyticsDashboard(BaseModel):
    stats: SystemStats
    hourly_traffic: List[HourlyTrafficPoint]
    top_alert_zones: List[Dict[str, Any]]
    camera_fps: List[Dict[str, Any]]
