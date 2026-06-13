"""
SQLAlchemy ORM Models for Airport Security Surveillance System.

INDEXING RULE: Never use both `index=True` on a Column AND an explicit
Index() for the same column in __table_args__ — they generate the same
index name and SQLite will crash with "index already exists".
Use `index=True` for simple single-column indexes. Use __table_args__
ONLY for composite (multi-column) indexes.
"""

from datetime import datetime
from typing import Optional
from sqlalchemy import (
    Column, Integer, String, Boolean, Float,
    DateTime, ForeignKey, JSON, Text, Enum as SAEnum,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.core.database import Base


# ─── Enumerations ─────────────────────────────────────────────────────────────

class CameraStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    OFFLINE = "OFFLINE"
    MAINTENANCE = "MAINTENANCE"
    PAUSED = "PAUSED"

class VisitorStatus(str, enum.Enum):
    WHITELISTED = "WHITELISTED"
    BLACKLISTED = "BLACKLISTED"
    WATCHLIST = "WATCHLIST"
    PENDING = "PENDING"

class ZoneType(str, enum.Enum):
    DWELL = "DWELL"
    TRIPWIRE = "TRIPWIRE"
    RESTRICTED = "RESTRICTED"
    LOUNGE = "LOUNGE"

class AlertSeverity(str, enum.Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"

class BuildingType(str, enum.Enum):
    INDOOR = "INDOOR"
    OUTDOOR = "OUTDOOR"
    MIXED = "MIXED"

class AlertType(str, enum.Enum):
    RESTRICTED_ZONE = "RESTRICTED_ZONE"
    WATCHLIST_MATCH = "WATCHLIST_MATCH"
    BREAK_VIOLATION = "BREAK_VIOLATION"
    DWELL_EXCEEDED = "DWELL_EXCEEDED"
    CAMERA_OFFLINE = "CAMERA_OFFLINE"
    TAILGATING = "TAILGATING"


# ─── Sites ────────────────────────────────────────────────────────────────────

class Site(Base):
    __tablename__ = "sites"

    id         = Column(Integer, primary_key=True)
    name       = Column(String(255), nullable=False, unique=True)
    address    = Column(Text)
    latitude   = Column(Float)
    longitude  = Column(Float)
    is_active  = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    buildings = relationship("Building", back_populates="site", cascade="all, delete-orphan")


# ─── Buildings ────────────────────────────────────────────────────────────────

class Building(Base):
    __tablename__ = "buildings"

    id            = Column(Integer, primary_key=True)
    site_id       = Column(Integer, ForeignKey("sites.id", ondelete="CASCADE"), nullable=False, index=True)
    name          = Column(String(255), nullable=False)
    building_type = Column(
        SAEnum(BuildingType, name="building_type_enum", native_enum=False),
        default=BuildingType.INDOOR, nullable=False,
    )
    description   = Column(Text)
    x_position    = Column(Float, default=0.0)     # campus map X position
    y_position    = Column(Float, default=0.0)     # campus map Y position
    map_width     = Column(Float, default=200.0)   # campus map visual width
    map_height    = Column(Float, default=150.0)   # campus map visual height
    is_active     = Column(Boolean, default=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    site   = relationship("Site", back_populates="buildings")
    floors = relationship("FloorLevel", back_populates="building", cascade="all, delete-orphan", order_by="FloorLevel.sort_order")


# ─── Floors ───────────────────────────────────────────────────────────────────

class FloorLevel(Base):
    __tablename__ = "floors"

    id          = Column(Integer, primary_key=True)
    building_id = Column(Integer, ForeignKey("buildings.id", ondelete="CASCADE"), nullable=False, index=True)
    level       = Column(Integer, default=0, nullable=False)
    label       = Column(String(100), nullable=False)
    sort_order  = Column(Integer, default=0)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    building = relationship("Building", back_populates="floors")


# ─── User (Operators / Supervisors) ───────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True)
    username      = Column(String(100), unique=True, nullable=False, index=True)
    email         = Column(String(255), unique=True, nullable=False)
    full_name     = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role          = Column(String(50), default="operator")
    department    = Column(String(100))
    is_active     = Column(Boolean, default=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    last_login    = Column(DateTime(timezone=True))


# ─── Cameras ──────────────────────────────────────────────────────────────────

class Camera(Base):
    __tablename__ = "cameras"

    id          = Column(Integer, primary_key=True)
    name        = Column(String(255), nullable=False)
    rtsp_url    = Column(String(500), nullable=False)
    location    = Column(String(255))
    description = Column(Text)
    floor       = Column(Integer, default=1, nullable=False, index=True)
    building_id = Column(Integer, ForeignKey("buildings.id", ondelete="SET NULL"), index=True)
    x_coord     = Column(Float, default=0.0)
    y_coord     = Column(Float, default=0.0)
    angle       = Column(Float, default=0.0)
    fov         = Column(Float, default=90.0)
    status      = Column(
        SAEnum(CameraStatus, name="camera_status_enum", native_enum=False),
        default=CameraStatus.ACTIVE, nullable=False, index=True,
    )
    is_overhead = Column(Boolean, default=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    tracks = relationship("ActiveTrack", back_populates="camera", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="camera")


# ─── Layouts (Floor Plans) ────────────────────────────────────────────────────

class Layout(Base):
    __tablename__ = "layouts"
    __table_args__ = (
        UniqueConstraint('building_id', 'floor_num', name='uq_layout_building_floor'),
    )

    id          = Column(Integer, primary_key=True)
    floor_num   = Column(Integer, nullable=False, index=True)
    building_id = Column(Integer, ForeignKey("buildings.id", ondelete="SET NULL"), index=True)
    name        = Column(String(255), default="Floor Plan")
    image_path  = Column(String(500), nullable=False)
    width       = Column(Integer, default=1920)
    height      = Column(Integer, default=1080)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ─── Zones ────────────────────────────────────────────────────────────────────

class Zone(Base):
    __tablename__ = "zones"

    id                  = Column(Integer, primary_key=True)
    name                = Column(String(255), nullable=False)
    floor               = Column(Integer, default=1, nullable=False, index=True)
    building_id         = Column(Integer, ForeignKey("buildings.id", ondelete="SET NULL"), index=True)
    coordinates         = Column(JSON, nullable=False)
    zone_type           = Column(
        SAEnum(ZoneType, name="zone_type_enum", native_enum=False),
        default=ZoneType.DWELL, nullable=False,
    )
    dwell_alert_seconds = Column(Integer, default=300)
    color               = Column(String(20), default="#6366f1")
    is_active           = Column(Boolean, default=True)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())


# ─── Visitors ─────────────────────────────────────────────────────────────────

class Visitor(Base):
    __tablename__ = "visitors"

    id                  = Column(Integer, primary_key=True)
    fullname            = Column(String(255), nullable=False)
    passport_number     = Column(String(100), index=True)
    nationality         = Column(String(100))
    phone_number        = Column(String(50))
    address             = Column(Text)
    photo_path          = Column(String(500))
    face_embedding_id   = Column(String(100))
    purpose             = Column(Text)
    notes               = Column(Text)
    status              = Column(
        SAEnum(VisitorStatus, name="visitor_status_enum", native_enum=False),
        default=VisitorStatus.WHITELISTED, nullable=False, index=True,
    )
    enrolled_by         = Column(String(100))
    approved_by         = Column(String(100))
    requires_escort     = Column(Boolean, default=False)
    location            = Column(String(255))
    entry_time          = Column(DateTime(timezone=True))
    exit_time           = Column(DateTime(timezone=True))
    approver_id         = Column(String(100))
    department          = Column(String(100))
    role                = Column(String(50))
    created_at          = Column(DateTime(timezone=True), server_default=func.now())
    updated_at          = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ─── Employees ────────────────────────────────────────────────────────────────

class Employee(Base):
    __tablename__ = "employees"

    id                     = Column(Integer, primary_key=True)
    employee_code          = Column(String(100), unique=True, nullable=False, index=True)
    fullname               = Column(String(255), nullable=False)
    department             = Column(String(100))
    shift                  = Column(String(50), default="MORNING")
    photo_path             = Column(String(500))
    face_embedding_id      = Column(String(100))
    break_interval_minutes = Column(Integer, default=120)
    break_duration_minutes = Column(Integer, default=15)
    is_active              = Column(Boolean, default=True)
    created_at             = Column(DateTime(timezone=True), server_default=func.now())

    breaks = relationship("EmployeeBreak", back_populates="employee", cascade="all, delete-orphan")


# ─── Employee Breaks ──────────────────────────────────────────────────────────

class EmployeeBreak(Base):
    __tablename__ = "employee_breaks"

    id               = Column(Integer, primary_key=True)
    employee_id      = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    start_time       = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
    end_time         = Column(DateTime(timezone=True))
    duration_seconds = Column(Integer)
    compliant        = Column(Boolean, default=True)
    lounge_zone_id   = Column(Integer, ForeignKey("zones.id"))

    employee = relationship("Employee", back_populates="breaks")


# ─── Active Person Tracks ─────────────────────────────────────────────────────

class ActiveTrack(Base):
    __tablename__ = "active_tracks"

    id                 = Column(String(100), primary_key=True)
    camera_id          = Column(Integer, ForeignKey("cameras.id", ondelete="SET NULL"))
    global_id          = Column(String(100), nullable=False, index=True)  # cross-camera UUID
    local_track_id     = Column(Integer)
    first_seen         = Column(DateTime(timezone=True), server_default=func.now())
    last_seen          = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_x             = Column(Float)
    last_y             = Column(Float)
    is_active          = Column(Boolean, default=True, index=True)
    matched_visitor_id  = Column(Integer, ForeignKey("visitors.id"))
    matched_employee_id = Column(Integer, ForeignKey("employees.id"))

    camera = relationship("Camera", back_populates="tracks")


# ─── Alerts ───────────────────────────────────────────────────────────────────

class Alert(Base):
    __tablename__ = "alerts"

    id              = Column(Integer, primary_key=True)
    camera_id       = Column(Integer, ForeignKey("cameras.id", ondelete="SET NULL"))
    track_id        = Column(String(100), index=True)
    global_id       = Column(String(100))
    alert_type      = Column(
        SAEnum(AlertType, name="alert_type_enum", native_enum=False),
        nullable=False,
    )
    description     = Column(Text)
    severity        = Column(
        SAEnum(AlertSeverity, name="alert_severity_enum", native_enum=False),
        default=AlertSeverity.HIGH, nullable=False, index=True,
    )
    zone_id         = Column(Integer, ForeignKey("zones.id"))
    snapshot_path   = Column(String(500))
    timestamp       = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    acknowledged    = Column(Boolean, default=False, index=True)
    acknowledged_by = Column(String(100))
    acknowledged_at = Column(DateTime(timezone=True))

    camera = relationship("Camera", back_populates="alerts")
