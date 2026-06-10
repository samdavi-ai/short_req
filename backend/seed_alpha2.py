"""
Seed script — ALPHA-2 Building (Airport Authority of India)
Creates:
  - Site: Airport Authority of India — BIAL
  - Building: ALPHA-2
  - 3 Floors: Ground Floor (0), Area A (Intermediate) (1), First Floor (2)
  - Cameras positioned to match the physical floor plan drawings
  - Security zones (RESTRICTED, DWELL, LOUNGE, TRIPWIRE)
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal, Base, engine
from app.models.models import (
    Site, Building, BuildingType, FloorLevel,
    Camera, CameraStatus,
    Zone, ZoneType,
)

Base.metadata.create_all(bind=engine, checkfirst=True)
db = SessionLocal()

def get_or_create(db, model, filter_kwargs, create_kwargs):
    obj = db.query(model).filter_by(**filter_kwargs).first()
    if obj:
        print(f"  [EXISTS] {model.__name__}: {filter_kwargs}")
        return obj
    obj = model(**{**filter_kwargs, **create_kwargs})
    db.add(obj)
    db.flush()
    print(f"  [CREATED] {model.__name__}: {filter_kwargs}")
    return obj

try:
    # ── 1. Site ───────────────────────────────────────────────────────────────
    print("\n── Seeding Site ─────────────────────────────────────────────────────")
    site = get_or_create(db, Site,
        filter_kwargs={"name": "Airport Authority of India — BIAL"},
        create_kwargs={
            "address": "Kempegowda International Airport, Devanahalli, Bangalore, Karnataka 560300",
            "latitude": 13.1986,
            "longitude": 77.7066,
            "is_active": True,
        }
    )

    # ── 2. Building ────────────────────────────────────────────────────────────
    print("\n── Seeding Building ─────────────────────────────────────────────────")
    building = get_or_create(db, Building,
        filter_kwargs={"name": "ALPHA-2", "site_id": site.id},
        create_kwargs={
            "building_type": BuildingType.INDOOR,
            "description": "Airport Authority of India — ALPHA-2 Administrative & Operations Block",
            "x_position": 100,
            "y_position": 80,
            "map_width": 380,
            "map_height": 260,
            "is_active": True,
        }
    )

    # ── 3. Floors ──────────────────────────────────────────────────────────────
    print("\n── Seeding Floors ───────────────────────────────────────────────────")
    floor_ground = get_or_create(db, FloorLevel,
        filter_kwargs={"building_id": building.id, "level": 0},
        create_kwargs={"label": "Ground Floor", "sort_order": 0}
    )
    floor_aa = get_or_create(db, FloorLevel,
        filter_kwargs={"building_id": building.id, "level": 1},
        create_kwargs={"label": "Area A (Intermediate)", "sort_order": 1}
    )
    floor_first = get_or_create(db, FloorLevel,
        filter_kwargs={"building_id": building.id, "level": 2},
        create_kwargs={"label": "First Floor", "sort_order": 2}
    )

    # ── 4. Cameras ─────────────────────────────────────────────────────────────
    # Coordinates are pixel positions on a 1200×800 canvas (matching LayoutEditor defaults)
    print("\n── Seeding Cameras ──────────────────────────────────────────────────")

    cameras_data = [
        # ── GROUND FLOOR (level=0) ─────────────────────────────────────────────
        # BIAL Canteen area
        dict(name="CAM-G01", floor=0, x_coord=110,  y_coord=120,  angle=135, fov=90,  location="BIAL Canteen — NW Corner",       rtsp_url="rtsp://10.10.0.101:554/stream1"),
        dict(name="CAM-G02", floor=0, x_coord=110,  y_coord=400,  angle=45,  fov=90,  location="BIAL Canteen — SW Corner",       rtsp_url="rtsp://10.10.0.102:554/stream1"),
        dict(name="CAM-G03", floor=0, x_coord=300,  y_coord=120,  angle=180, fov=90,  location="BIAL Canteen — Service Counter", rtsp_url="rtsp://10.10.0.103:554/stream1"),
        # Central service core
        dict(name="CAM-G04", floor=0, x_coord=450,  y_coord=120,  angle=180, fov=90,  location="DNIC Room Entrance",             rtsp_url="rtsp://10.10.0.104:554/stream1"),
        dict(name="CAM-G05", floor=0, x_coord=600,  y_coord=120,  angle=180, fov=90,  location="11kV Electrical Room Corridor",  rtsp_url="rtsp://10.10.0.105:554/stream1"),
        dict(name="CAM-G06", floor=0, x_coord=550,  y_coord=400,  angle=0,   fov=90,  location="Reception — Main Hall",          rtsp_url="rtsp://10.10.0.106:554/stream1"),
        dict(name="CAM-G07", floor=0, x_coord=450,  y_coord=550,  angle=315, fov=90,  location="Storage Corridor",               rtsp_url="rtsp://10.10.0.107:554/stream1"),
        # Battery Injection / Right wing
        dict(name="CAM-G08", floor=0, x_coord=850,  y_coord=120,  angle=225, fov=90,  location="Battery Injection — NE",         rtsp_url="rtsp://10.10.0.108:554/stream1"),
        dict(name="CAM-G09", floor=0, x_coord=1050, y_coord=120,  angle=270, fov=90,  location="LIFT Lobby — Ground",            rtsp_url="rtsp://10.10.0.109:554/stream1"),
        dict(name="CAM-G10", floor=0, x_coord=1050, y_coord=600,  angle=180, fov=90,  location="Battery Injection — SE",         rtsp_url="rtsp://10.10.0.110:554/stream1"),
        dict(name="CAM-G11", floor=0, x_coord=800,  y_coord=600,  angle=90,  fov=90,  location="Factory Floor — Exit",           rtsp_url="rtsp://10.10.0.111:554/stream1"),
        dict(name="CAM-G12", floor=0, x_coord=110,  y_coord=660,  angle=315, fov=90,  location="Canteen — South Exit",           rtsp_url="rtsp://10.10.0.112:554/stream1"),

        # ── AREA A (INTERMEDIATE) (level=1) ────────────────────────────────────
        dict(name="CAM-A01", floor=1, x_coord=110,  y_coord=120,  angle=135, fov=90,  location="VHF Maintenance Room — Entry",   rtsp_url="rtsp://10.10.2.101:554/stream1"),
        dict(name="CAM-A02", floor=1, x_coord=200,  y_coord=350,  angle=90,  fov=90,  location="VHF Maintenance — Rack Area",    rtsp_url="rtsp://10.10.2.102:554/stream1"),
        dict(name="CAM-A03", floor=1, x_coord=380,  y_coord=120,  angle=180, fov=90,  location="Locker Room Corridor",           rtsp_url="rtsp://10.10.2.103:554/stream1"),
        dict(name="CAM-A04", floor=1, x_coord=550,  y_coord=120,  angle=180, fov=90,  location="PDS Electronics Room — Entry",   rtsp_url="rtsp://10.10.2.104:554/stream1"),
        dict(name="CAM-A05", floor=1, x_coord=800,  y_coord=120,  angle=225, fov=90,  location="Sales Room",                    rtsp_url="rtsp://10.10.2.105:554/stream1"),
        dict(name="CAM-A06", floor=1, x_coord=1050, y_coord=120,  angle=270, fov=90,  location="Area AA — NE",                  rtsp_url="rtsp://10.10.2.106:554/stream1"),
        dict(name="CAM-A07", floor=1, x_coord=500,  y_coord=380,  angle=0,   fov=110, location="Reporting & Staff Interface",    rtsp_url="rtsp://10.10.2.107:554/stream1"),
        dict(name="CAM-A08", floor=1, x_coord=750,  y_coord=380,  angle=315, fov=90,  location="VHF Accommodation Room",         rtsp_url="rtsp://10.10.2.108:554/stream1"),
        dict(name="CAM-A09", floor=1, x_coord=300,  y_coord=550,  angle=45,  fov=90,  location="HR Pamphlet Service Room",       rtsp_url="rtsp://10.10.2.109:554/stream1"),
        dict(name="CAM-A10", floor=1, x_coord=600,  y_coord=550,  angle=0,   fov=90,  location="Finance Delivery Area",         rtsp_url="rtsp://10.10.2.110:554/stream1"),
        dict(name="CAM-A11", floor=1, x_coord=900,  y_coord=550,  angle=315, fov=90,  location="Battery Room",                  rtsp_url="rtsp://10.10.2.111:554/stream1"),
        dict(name="CAM-A12", floor=1, x_coord=1050, y_coord=650,  angle=315, fov=90,  location="Area AA — SE Corner",           rtsp_url="rtsp://10.10.2.112:554/stream1"),

        # ── FIRST FLOOR (level=2) ──────────────────────────────────────────────
        # Coordinates aligned with symmetric layout of 11-room grid
        dict(name="CAM-FF-01", floor=2, x_coord=240,  y_coord=240,  angle=45,  fov=110, location="Security Check Area — NW",      rtsp_url="rtsp://10.10.1.101:554/stream1"),
        dict(name="CAM-FF-02", floor=2, x_coord=240,  y_coord=400,  angle=0,   fov=100, location="Central Corridor — West End",   rtsp_url="rtsp://10.10.1.102:554/stream1"),
        dict(name="CAM-FF-03", floor=2, x_coord=240,  y_coord=560,  angle=315, fov=110, location="STM Telecom Room — SW Corner",  rtsp_url="rtsp://10.10.1.103:554/stream1"),
        dict(name="CAM-FF-04", floor=2, x_coord=816,  y_coord=240,  angle=135, fov=110, location="Recreation Room — NE Corner",   rtsp_url="rtsp://10.10.1.104:554/stream1"),
        dict(name="CAM-FF-05", floor=2, x_coord=960,  y_coord=400,  angle=180, fov=100, location="Central Corridor — East End",   rtsp_url="rtsp://10.10.1.105:554/stream1"),
        dict(name="CAM-FF-06", floor=2, x_coord=960,  y_coord=560,  angle=225, fov=110, location="APP Room — SE Corner",          rtsp_url="rtsp://10.10.1.106:554/stream1"),
        dict(name="CAM-FF-07", floor=2, x_coord=456,  y_coord=240,  angle=90,  fov=120, location="Training Area — Center Desk",   rtsp_url="rtsp://10.10.1.107:554/stream1"),
        dict(name="CAM-FF-08", floor=2, x_coord=600,  y_coord=240,  angle=90,  fov=120, location="Control Office — Console Area", rtsp_url="rtsp://10.10.1.108:554/stream1"),
        dict(name="CAM-FF-09", floor=2, x_coord=888,  y_coord=240,  angle=90,  fov=120, location="Utility Room — Main Rack",      rtsp_url="rtsp://10.10.1.109:554/stream1"),
        dict(name="CAM-FF-10", floor=2, x_coord=420,  y_coord=560,  angle=270, fov=120, location="ACC Rooms — Bay 1 & 2 Corridor",rtsp_url="rtsp://10.10.1.110:554/stream1"),
        dict(name="CAM-FF-11", floor=2, x_coord=660,  y_coord=560,  angle=270, fov=120, location="ACC Rooms — Bay 3 & 4 Corridor",rtsp_url="rtsp://10.10.1.111:554/stream1"),
        dict(name="CAM-FF-12", floor=2, x_coord=780,  y_coord=560,  angle=270, fov=120, location="ACC Room — Bay 4 (WSO) Interior", rtsp_url="rtsp://10.10.1.112:554/stream1"),
    ]

    for cam_data in cameras_data:
        get_or_create(db, Camera,
            filter_kwargs={"name": cam_data["name"], "building_id": building.id},
            create_kwargs={
                "rtsp_url": cam_data["rtsp_url"],
                "floor": cam_data["floor"],
                "building_id": building.id,
                "x_coord": cam_data["x_coord"],
                "y_coord": cam_data["y_coord"],
                "angle": cam_data["angle"],
                "fov": cam_data["fov"],
                "location": cam_data["location"],
                "status": CameraStatus.ACTIVE,
                "is_overhead": True,
            }
        )

    # ── 5. Zones ───────────────────────────────────────────────────────────────
    print("\n── Seeding Zones ────────────────────────────────────────────────────")

    zones_data = [
        # ── GROUND FLOOR zones ─────────────────────────────────────────────────
        dict(name="BIAL Canteen",            floor=0, zone_type=ZoneType.LOUNGE,     color="#22c55e", dwell_alert_seconds=1800,
             coordinates=[{"x":100,"y":100},{"x":340,"y":100},{"x":340,"y":680},{"x":100,"y":680}]),
        dict(name="Reception Hall",          floor=0, zone_type=ZoneType.DWELL,      color="#f59e0b", dwell_alert_seconds=600,
             coordinates=[{"x":400,"y":300},{"x":680,"y":300},{"x":680,"y":560},{"x":400,"y":560}]),
        dict(name="11kV Electrical Restricted", floor=0, zone_type=ZoneType.RESTRICTED, color="#ef4444", dwell_alert_seconds=0,
             coordinates=[{"x":440,"y":100},{"x":700,"y":100},{"x":700,"y":280},{"x":440,"y":280}]),
        dict(name="Battery Injection Factory",  floor=0, zone_type=ZoneType.RESTRICTED, color="#ef4444", dwell_alert_seconds=0,
             coordinates=[{"x":720,"y":300},{"x":1100,"y":300},{"x":1100,"y":680},{"x":720,"y":680}]),
        dict(name="Ground Floor Main Entry",    floor=0, zone_type=ZoneType.TRIPWIRE,   color="#00f0ff", dwell_alert_seconds=0,
             coordinates=[{"x":400,"y":680},{"x":650,"y":680},{"x":650,"y":720},{"x":400,"y":720}]),

        # ── AREA A (INTERMEDIATE) zones (floor=1) ──────────────────────────────
        dict(name="VHF Maintenance Room",    floor=1, zone_type=ZoneType.RESTRICTED, color="#ef4444", dwell_alert_seconds=0,
             coordinates=[{"x":100,"y":100},{"x":300,"y":100},{"x":300,"y":480},{"x":100,"y":480}]),
        dict(name="PDS Electronics Room",    floor=1, zone_type=ZoneType.RESTRICTED, color="#ef4444", dwell_alert_seconds=0,
             coordinates=[{"x":420,"y":100},{"x":720,"y":100},{"x":720,"y":260},{"x":420,"y":260}]),
        dict(name="Reporting & Interface",   floor=1, zone_type=ZoneType.DWELL,      color="#f59e0b", dwell_alert_seconds=900,
             coordinates=[{"x":320,"y":300},{"x":800,"y":300},{"x":800,"y":520},{"x":320,"y":520}]),
        dict(name="Battery Room AA",         floor=1, zone_type=ZoneType.RESTRICTED, color="#ef4444", dwell_alert_seconds=0,
             coordinates=[{"x":820,"y":420},{"x":1100,"y":420},{"x":1100,"y":680},{"x":820,"y":680}]),
        dict(name="HR & Finance Wing",       floor=1, zone_type=ZoneType.DWELL,      color="#f59e0b", dwell_alert_seconds=600,
             coordinates=[{"x":100,"y":520},{"x":820,"y":520},{"x":820,"y":680},{"x":100,"y":680}]),
        dict(name="Area AA Locker Lounge",   floor=1, zone_type=ZoneType.LOUNGE,     color="#22c55e", dwell_alert_seconds=1200,
             coordinates=[{"x":300,"y":100},{"x":420,"y":100},{"x":420,"y":260},{"x":300,"y":260}]),

        # ── FIRST FLOOR zones (floor=2) ────────────────────────────────────────
        # 11 Symmetric rooms matching the screenshot layout
        dict(name="Security Check Area",     floor=2, zone_type=ZoneType.LOUNGE,     color="#22c55e", dwell_alert_seconds=1200,
             coordinates=[{"x":240,"y":240},{"x":384,"y":240},{"x":384,"y":380},{"x":240,"y":380}]),
        dict(name="Training Area",           floor=2, zone_type=ZoneType.DWELL,      color="#f59e0b", dwell_alert_seconds=3600,
             coordinates=[{"x":384,"y":240},{"x":528,"y":240},{"x":528,"y":380},{"x":384,"y":380}]),
        dict(name="Control Office",          floor=2, zone_type=ZoneType.DWELL,      color="#3b82f6", dwell_alert_seconds=1800,
             coordinates=[{"x":528,"y":240},{"x":672,"y":240},{"x":672,"y":380},{"x":528,"y":380}]),
        dict(name="Recreation Room",         floor=2, zone_type=ZoneType.LOUNGE,     color="#22c55e", dwell_alert_seconds=1200,
             coordinates=[{"x":672,"y":240},{"x":816,"y":240},{"x":816,"y":380},{"x":672,"y":380}]),
        dict(name="Utility Room",            floor=2, zone_type=ZoneType.DWELL,      color="#6b7280", dwell_alert_seconds=900,
             coordinates=[{"x":816,"y":240},{"x":960,"y":240},{"x":960,"y":380},{"x":816,"y":380}]),
             
        dict(name="STM Telecom Room",        floor=2, zone_type=ZoneType.RESTRICTED, color="#ff0055", dwell_alert_seconds=0,
             coordinates=[{"x":240,"y":420},{"x":360,"y":420},{"x":360,"y":560},{"x":240,"y":560}]),
        dict(name="ACC Room - Bay 1",        floor=2, zone_type=ZoneType.RESTRICTED, color="#ff0055", dwell_alert_seconds=0,
             coordinates=[{"x":360,"y":420},{"x":480,"y":420},{"x":480,"y":560},{"x":360,"y":560}]),
        dict(name="ACC Room - Bay 2",        floor=2, zone_type=ZoneType.RESTRICTED, color="#ff0055", dwell_alert_seconds=0,
             coordinates=[{"x":480,"y":420},{"x":600,"y":420},{"x":600,"y":560},{"x":480,"y":560}]),
        dict(name="ACC Room - Bay 3",        floor=2, zone_type=ZoneType.RESTRICTED, color="#ff0055", dwell_alert_seconds=0,
             coordinates=[{"x":600,"y":420},{"x":720,"y":420},{"x":720,"y":560},{"x":600,"y":560}]),
        dict(name="ACC Room - Bay 4 (WSO)",  floor=2, zone_type=ZoneType.RESTRICTED, color="#ff0055", dwell_alert_seconds=0,
             coordinates=[{"x":720,"y":420},{"x":840,"y":420},{"x":840,"y":560},{"x":720,"y":560}]),
        dict(name="APP Room",                floor=2, zone_type=ZoneType.RESTRICTED, color="#ff0055", dwell_alert_seconds=0,
             coordinates=[{"x":840,"y":420},{"x":960,"y":420},{"x":960,"y":560},{"x":840,"y":560}]),
    ]

    for z in zones_data:
        get_or_create(db, Zone,
            filter_kwargs={"name": z["name"], "floor": z["floor"], "building_id": building.id},
            create_kwargs={
                "zone_type": z["zone_type"],
                "color": z["color"],
                "dwell_alert_seconds": z["dwell_alert_seconds"],
                "coordinates": z["coordinates"],
                "is_active": True,
                "building_id": building.id,
            }
        )

    db.commit()
    print(f"""
╔══════════════════════════════════════════════════════════╗
║  ALPHA-2 Seed Complete ✓                                 ║
╠══════════════════════════════════════════════════════════╣
║  Site     : Airport Authority of India — BIAL            ║
║  Building : ALPHA-2                                      ║
║  Floors   : Ground Floor / Area A (Intermediate) / First Floor
║  Cameras  : {len(cameras_data)} cameras seeded                           ║
║  Zones    : {len(zones_data)} zones seeded                            ║
╚══════════════════════════════════════════════════════════╝
""")

except Exception as e:
    db.rollback()
    print(f"\n[ERROR] {e}")
    raise
finally:
    db.close()
