import os
import sys
import json
import time
import uuid
import sqlite3
import threading
import numpy as np
import cv2
from typing import Dict, List, Optional
from fastapi import FastAPI, Request, Form, UploadFile, File, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

# Add root project and processing directories to sys.path
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, root_dir)
sys.path.insert(0, os.path.join(root_dir, "processing"))

from processing.workers.person_detector import PersonDetector
from processing.workers.face_detector import FaceDetector
from processing.workers.face_embedder import FaceEmbedder
from processing.workers.body_reid import BodyReIDEmbedder
from processing.workers.global_tracker import GlobalTracker

app = FastAPI(title="Surveillance Mini-App Testbed")

# Ensure required folders exist
os.makedirs("mini_app/uploads", exist_ok=True)
os.makedirs("mini_app/assets/crops", exist_ok=True)
os.makedirs("mini_app/assets/enrolled", exist_ok=True)
os.makedirs("mini_app/templates", exist_ok=True)

# Mount assets directory as static files
app.mount("/assets", StaticFiles(directory="mini_app/assets"), name="assets")
templates = Jinja2Templates(directory="mini_app/templates")

# DB Path
DB_PATH = "mini_app/mini_db.sqlite3"

# Global states
tracker = GlobalTracker()
detector = None
face_detector = None
face_embedder = None
body_reid = None

# Active video processing state
active_video_thread = None
processing_active = False
latest_processed_frame = None
active_tracks: Dict[str, dict] = {}  # global_id -> track info
video_dimensions = {"width": 1280, "height": 720}

# ── DB HELPERS ───────────────────────────────────────────────────────────────

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS enrolled_identities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                face_vector TEXT,
                body_vector TEXT,
                photo_path TEXT,
                timestamp REAL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS movement_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                global_id TEXT NOT NULL,
                name TEXT,
                identity_type TEXT,
                camera_id INTEGER,
                timestamp REAL
            )
        """)
        conn.commit()

init_db()

# ── PIPELINE INITIALIZATION ──────────────────────────────────────────────────

def load_models():
    global detector, face_detector, face_embedder, body_reid
    if detector is None:
        print("Loading AI Models into memory...")
        detector = PersonDetector(use_gpu=False)
        face_detector = FaceDetector()
        face_embedder = FaceEmbedder(use_gpu=False)
        body_reid = BodyReIDEmbedder(use_gpu=False)
        print("All models loaded successfully!")

# ── REQUEST MODELS ───────────────────────────────────────────────────────────

class ClickRequest(BaseModel):
    x: float
    y: float
    width: float
    height: float

class IdentifyRequest(BaseModel):
    global_id: str
    name: str

# ── COSINE SIMILARITY HELPER ──────────────────────────────────────────────────

def cosine_similarity(v1, v2):
    if v1 is None or v2 is None:
        return 0.0
    a = np.array(v1, dtype=np.float32)
    b = np.array(v2, dtype=np.float32)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-12))

# ── SEARCH REGISTRY ──────────────────────────────────────────────────────────

def search_registry(face_vec, body_vec):
    """Search enrolled database for a matching face or body embedding."""
    best_name = None
    best_sim = 0.0
    matched_via = None

    with get_db() as conn:
        rows = conn.execute("SELECT name, face_vector, body_vector FROM enrolled_identities").fetchall()
        
        # 1. Try Face Match (high accuracy) across all enrolled identities
        if face_vec is not None:
            for row in rows:
                if row["face_vector"]:
                    db_face = json.loads(row["face_vector"])
                    sim = cosine_similarity(face_vec, db_face)
                    if sim > 0.68 and sim > best_sim:
                        best_sim = sim
                        best_name = row["name"]
                        matched_via = "face"

        # 2. Try Body Re-ID Match (fallback) across all enrolled identities, only if no face match was found
        if best_name is None and body_vec is not None:
            for row in rows:
                if row["body_vector"]:
                    db_body = json.loads(row["body_vector"])
                    sim = cosine_similarity(body_vec, db_body)
                    if sim > 0.72 and sim > best_sim:
                        best_sim = sim
                        best_name = row["name"]
                        matched_via = "body"

    return best_name, best_sim, matched_via

# ── VIDEO PROCESSOR WORKER ───────────────────────────────────────────────────

def process_video_loop(video_path: str, camera_id: int):
    global processing_active, latest_processed_frame, active_tracks, video_dimensions
    load_models()

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"Failed to open video: {video_path}")
        processing_active = False
        return

    video_dimensions["width"] = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    video_dimensions["height"] = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    print(f"Video loaded: {video_dimensions['width']}x{video_dimensions['height']}")

    processing_active = True
    frame_count = 0

    while processing_active:
        ret, frame = cap.read()
        if not ret:
            print("Video completed. Looping back...")
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue

        frame_count += 1
        # Skip frames to optimize cpu processing
        if frame_count % 3 != 0:
            continue

        # 1. YOLO detect and track
        tracked = detector.detect_and_track(frame)

        current_active = {}
        for obj in tracked:
            track_id = obj["track_id"]
            x1, y1, x2, y2 = obj["bbox"]
            conf = obj["conf"]

            # Bounding box sanity checks
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(frame.shape[1], x2), min(frame.shape[0], y2)

            body_crop = frame[y1:y2, x1:x2]
            if body_crop.size == 0:
                continue

            # Extract body Re-ID signature
            body_vec = body_reid.extract_embedding(body_crop)

            # Check for face crop
            face_vec = None
            face_bbox = face_detector.detect_faces(body_crop)
            if face_bbox is not None:
                fx1, fy1, fx2, fy2 = face_bbox
                face_crop = body_crop[fy1:fy2, fx1:fx2]
                if face_crop.size > 0:
                    face_vec = face_embedder.extract_embedding(face_crop)

            # Match or create global tracker ID
            # HeadTop proxy omitted for simplicity in local CPU tests
            global_id = tracker.match_or_create(
                face_vector=face_vec,
                body_vector=body_vec,
                head_vector=None,
                camera_id=camera_id,
                floor=1
            )

            # Search local DB for registered identities
            matched_name, sim, via = search_registry(face_vec, body_vec)

            # Set status details
            identity_type = "UNKNOWN"
            if matched_name:
                identity_type = "VISITOR"
                tracker.set_identity(global_id, identity_type, person_name=matched_name)

            # Check if this person was already identified in the tracker
            existing_identity = tracker.get_identity(global_id)
            final_name = existing_identity.get("matched_name") or matched_name

            if final_name:
                identity_type = "VISITOR"

            # Save the crop
            crop_path = f"mini_app/assets/crops/{global_id}.jpg"
            cv2.imwrite(crop_path, body_crop)

            current_active[global_id] = {
                "global_id": global_id,
                "bbox": [x1, y1, x2, y2],
                "matched_name": final_name,
                "identity_type": identity_type,
                "camera_id": camera_id,
                "timestamp": time.time(),
                "crop_url": f"/assets/crops/{global_id}.jpg"
            }

            # Log movement occasionally (every 30 frames seen)
            if frame_count % 30 == 0:
                with get_db() as conn:
                    conn.execute(
                        "INSERT INTO movement_log (global_id, name, identity_type, camera_id, timestamp) VALUES (?, ?, ?, ?, ?)",
                        (global_id, final_name, identity_type, camera_id, time.time())
                    )
                    conn.commit()

        # Update global active tracks
        active_tracks = current_active

        # Draw annotations directly on display frame
        annotated_frame = frame.copy()
        for gid, info in active_tracks.items():
            bx1, by1, bx2, by2 = info["bbox"]
            name = info["matched_name"] or f"Unknown ({gid[:6]})"
            color = (34, 197, 94) if info["matched_name"] else (148, 163, 184) # green vs gray

            # Draw bbox
            cv2.rectangle(annotated_frame, (bx1, by1), (bx2, by2), color, 2)
            
            # Label background
            label_text = name
            (w, h), _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
            cv2.rectangle(annotated_frame, (bx1, by1 - 20), (bx1 + w, by1), color, -1)
            cv2.putText(annotated_frame, label_text, (bx1, by1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

        # Update streaming frame
        _, buffer = cv2.imencode('.jpg', annotated_frame)
        latest_processed_frame = buffer.tobytes()

        # Simulate real-time stream processing interval
        time.sleep(0.04)

    cap.release()

# ── ROUTE CONTROLLERS ────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/videos/preloaded")
def get_preloaded_videos():
    """Returns a list of preloaded test videos from the tests/ directory."""
    try:
        files = os.listdir("tests")
        videos = [f for f in files if f.endswith(".mp4")]
        return {"videos": sorted(videos)}
    except Exception as e:
        return {"videos": ["test_video.mp4"]}

@app.post("/upload-video")
async def upload_video(file: UploadFile = File(...)):
    """Uploads a video to the uploads/ directory."""
    file_path = os.path.join("mini_app/uploads", file.filename)
    with open(file_path, "wb") as buffer:
        shutil = sys.modules.get("shutil")
        if shutil:
            shutil.copyfileobj(file.file, buffer)
        else:
            buffer.write(await file.read())
    return {"filename": file.filename, "status": "uploaded"}

@app.post("/process-video/start")
def start_processing(video_name: str = Form(...), camera_id: int = Form(1)):
    global active_video_thread, processing_active
    
    # Stop existing thread
    processing_active = False
    if active_video_thread and active_video_thread.is_alive():
        active_video_thread.join()

    # Determine full path of the video
    if os.path.exists(os.path.join("tests", video_name)):
        full_path = os.path.join("tests", video_name)
    elif os.path.exists(os.path.join("mini_app/uploads", video_name)):
        full_path = os.path.join("mini_app/uploads", video_name)
    else:
        # Fallback to absolute tests folder if needed
        full_path = os.path.join(root_dir, "tests", video_name)

    if not os.path.exists(full_path):
        raise HTTPException(status_code=400, detail=f"Video path {full_path} not found.")

    # Reset global tracker to simulate a fresh video test
    global tracker
    tracker = GlobalTracker()
    
    active_video_thread = threading.Thread(
        target=process_video_loop,
        args=(full_path, camera_id),
        daemon=True
    )
    active_video_thread.start()

    return {"status": "started", "video": video_name}

@app.post("/process-video/stop")
def stop_processing():
    global processing_active
    processing_active = False
    return {"status": "stopped"}

@app.get("/video-feed")
def video_feed():
    """Streams the processed frames with overlays as MJPEG."""
    def generate():
        global latest_processed_frame, processing_active
        while True:
            if latest_processed_frame is not None:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + latest_processed_frame + b'\r\n')
            time.sleep(0.05)

    return StreamingResponse(generate(), media_type="multipart/x-mixed-replace; boundary=frame")

@app.post("/click")
def handle_canvas_click(req: ClickRequest):
    """Resolves which global track was clicked based on canvas percentage scale coordinates."""
    global active_tracks, video_dimensions
    
    # Calculate scale factor
    scale_x = video_dimensions["width"] / req.width
    scale_y = video_dimensions["height"] / req.height
    
    click_x = req.x * scale_x
    click_y = req.y * scale_y

    clicked_track = None
    for gid, track in active_tracks.items():
        x1, y1, x2, y2 = track["bbox"]
        if x1 <= click_x <= x2 and y1 <= click_y <= y2:
            clicked_track = {
                "global_id": gid,
                "name": track["matched_name"]
            }
            break

    if clicked_track:
        return {"found": True, **clicked_track}
    return {"found": False}

@app.post("/identify-track")
def identify_track(req: IdentifyRequest):
    """Names a person and enrolls their embedding into SQLite."""
    global active_tracks, tracker
    
    track_info = active_tracks.get(req.global_id)
    if not track_info:
        raise HTTPException(status_code=400, detail="Track is no longer active or visible.")

    # Find the crop image and load vectors
    crop_path = f"mini_app/assets/crops/{req.global_id}.jpg"
    if not os.path.exists(crop_path):
        raise HTTPException(status_code=400, detail="Person crop is unavailable.")

    # Extract vectors directly from crop
    img = cv2.imread(crop_path)
    if img is None:
        raise HTTPException(status_code=500, detail="Failed to load track crop.")

    # Extract body Re-ID
    body_vec = body_reid.extract_embedding(img)
    
    # Extract face Re-ID if face exists
    face_vec = None
    face_bbox = face_detector.detect_faces(img)
    if face_bbox is not None:
        fx1, fy1, fx2, fy2 = face_bbox
        face_crop = img[fy1:fy2, fx1:fx2]
        if face_crop.size > 0:
            face_vec = face_embedder.extract_embedding(face_crop)

    # Copy crop to enrolled photos
    enrolled_path = f"mini_app/assets/enrolled/{req.name}.jpg"
    shutil = sys.modules.get("shutil")
    if shutil:
        shutil.copy2(crop_path, enrolled_path)
    else:
        cv2.imwrite(enrolled_path, img)

    # Save to enrolled database
    with get_db() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO enrolled_identities (name, face_vector, body_vector, photo_path, timestamp)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                req.name,
                json.dumps(face_vec) if face_vec else None,
                json.dumps(body_vec),
                f"/assets/enrolled/{req.name}.jpg",
                time.time()
            )
        )
        conn.commit()

    # Inform the runtime tracker of the name
    tracker.set_identity(req.global_id, "VISITOR", person_name=req.name)
    
    # Log the event
    with get_db() as conn:
        conn.execute(
            "INSERT INTO movement_log (global_id, name, identity_type, camera_id, timestamp) VALUES (?, ?, ?, ?, ?)",
            (req.global_id, req.name, "VISITOR", track_info["camera_id"], time.time())
        )
        conn.commit()

    return {"status": "enrolled", "global_id": req.global_id, "name": req.name}

@app.get("/tracks/active")
def get_active_tracks():
    """Returns 'Where they are now' tracking dashboard details."""
    global active_tracks
    return list(active_tracks.values())

@app.get("/tracks/history")
def get_tracks_history():
    """Returns the scroll movement log history from database."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT global_id, name, identity_type, camera_id, timestamp FROM movement_log ORDER BY id DESC LIMIT 50"
        ).fetchall()
        return [dict(r) for r in rows]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8080)
