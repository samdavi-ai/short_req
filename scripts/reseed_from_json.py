import os
import json
import sys

# Setup backend app path imports
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'backend'))

from app.core.database import SessionLocal, Base, engine
from app.models.models import Building, Camera, CameraStatus, Zone, ZoneType

def reseed():
    db = SessionLocal()
    try:
        # Find ALPHA-2 Building
        building = db.query(Building).filter_by(name="ALPHA-2").first()
        if not building:
            print("[ERROR] Building 'ALPHA-2' not found in database!")
            return

        print(f"Found Building 'ALPHA-2' (ID: {building.id})")

        # Load accurate blueprint data
        json_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'blueprint_data.json')
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Clear existing cameras and zones for this building
        print("Clearing existing cameras and zones...")
        db.query(Camera).filter_by(building_id=building.id).delete()
        db.query(Zone).filter_by(building_id=building.id).delete()
        db.flush()

        # Seed cameras
        print(f"Seeding {len(data['cameras'])} cameras...")
        for c in data['cameras']:
            # Unique suffix for rtsp urls
            name_lower = c['name'].lower().replace(' ', '_').replace('-', '_')
            rtsp = c.get('rtsp_url') or f"rtsp://127.0.0.1:8554/{name_lower}"
            camera = Camera(
                name=c['name'],
                rtsp_url=rtsp,
                location=c.get('location') or f"Floor {c['floor']} location",
                description=c.get('description'),
                floor=c['floor'],
                building_id=building.id,
                x_coord=float(c['x']),
                y_coord=float(c['y']),
                angle=float(c['angle']),
                fov=float(c['fov']),
                status=CameraStatus.ACTIVE,
                is_overhead=True
            )
            db.add(camera)

        # Seed zones
        print(f"Seeding {len(data['zones'])} zones...")
        for z in data['zones']:
            zone = Zone(
                name=z['name'],
                floor=z['floor'],
                building_id=building.id,
                coordinates=z['points'],
                zone_type=ZoneType(z['type']),
                dwell_alert_seconds=z.get('dwell_alert_seconds', 300),
                color=z['color'],
                is_active=True
            )
            db.add(zone)

        db.commit()
        print("Successfully re-seeded cameras and zones with pixel-accurate coordinates!")
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Seeding failed: {e}")
        raise
    finally:
        db.close()

if __name__ == '__main__':
    reseed()
