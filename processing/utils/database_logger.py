import os
import sqlite3
import json
import numpy as np
import time
from typing import List, Optional

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(ROOT_DIR, "database.db")
STATIC_CROPPED_FACES_DIR = os.path.join(ROOT_DIR, "static", "cropped_faces")

def init_db():
    """Initializes the database.db SQLite database and its schema."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    os.makedirs(STATIC_CROPPED_FACES_DIR, exist_ok=True)
    
    with sqlite3.connect(DB_PATH) as conn:
        # 1. enrolled_identities (face embeddings stored as binary blobs)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS enrolled_identities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                face_vector BLOB,
                body_vector BLOB,
                photo_path TEXT,
                timestamp REAL
            )
        """)
        
        # 2. detections logged for every frame detection, including accuracy metrics
        conn.execute("""
            CREATE TABLE IF NOT EXISTS detections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                camera_id INTEGER,
                global_id TEXT,
                body_bbox TEXT, -- JSON string of body bbox [x1, y1, x2, y2]
                face_bbox TEXT, -- JSON string of face bbox [fx1, fy1, fx2, fy2]
                face_landmarks_2d TEXT, -- JSON string of 106 2D points
                face_landmarks_3d TEXT, -- JSON string of 68 3D points
                pose TEXT, -- JSON string of [yaw, pitch, roll]
                gender INTEGER, -- 0: Female, 1: Male
                age INTEGER, -- estimated age
                match_similarity REAL, -- dot product/cosine similarity score
                timestamp REAL
            )
        """)
        conn.commit()

# Run initialization on import
init_db()

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def serialize_vector(vector: Optional[List[float]]) -> Optional[bytes]:
    """Serializes a float list to a binary blob (float32)."""
    if vector is None or len(vector) == 0:
        return None
    return np.array(vector, dtype=np.float32).tobytes()

def deserialize_vector(blob: Optional[bytes]) -> Optional[List[float]]:
    """Deserializes a binary blob back to a list of floats."""
    if blob is None:
        return None
    return np.frombuffer(blob, dtype=np.float32).tolist()

def log_detection(
    camera_id: int,
    global_id: str,
    body_bbox: Optional[List[int]],
    face_bbox: Optional[List[int]],
    face_landmarks_2d: Optional[List[List[float]]] = None,
    face_landmarks_3d: Optional[List[List[float]]] = None,
    pose: Optional[List[float]] = None,
    gender: Optional[int] = None,
    age: Optional[int] = None,
    match_similarity: Optional[float] = None
):
    """Logs a single frame detection with bounding boxes and accuracy metrics."""
    with get_db_connection() as conn:
        conn.execute(
            """
            INSERT INTO detections (
                camera_id, global_id, body_bbox, face_bbox,
                face_landmarks_2d, face_landmarks_3d, pose,
                gender, age, match_similarity, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                camera_id,
                global_id,
                json.dumps(body_bbox) if body_bbox else None,
                json.dumps(face_bbox) if face_bbox else None,
                json.dumps(face_landmarks_2d) if face_landmarks_2d is not None else None,
                json.dumps(face_landmarks_3d) if face_landmarks_3d is not None else None,
                json.dumps(pose) if pose else None,
                gender,
                age,
                match_similarity,
                time.time()
            )
        )
        conn.commit()

def enroll_identity(
    name: str,
    face_vector: Optional[List[float]],
    body_vector: Optional[List[float]],
    photo_path: str
):
    """Enrolls or replaces an identity, saving embeddings as BLOBs."""
    face_blob = serialize_vector(face_vector)
    body_blob = serialize_vector(body_vector)
    
    with get_db_connection() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO enrolled_identities (name, face_vector, body_vector, photo_path, timestamp)
            VALUES (?, ?, ?, ?, ?)
            """,
            (name, face_blob, body_blob, photo_path, time.time())
        )
        conn.commit()

def load_enrolled_identities() -> List[dict]:
    """Loads all enrolled identities, deserializing binary BLOBs."""
    identities = []
    with get_db_connection() as conn:
        rows = conn.execute("SELECT name, face_vector, body_vector, photo_path FROM enrolled_identities").fetchall()
        for row in rows:
            identities.append({
                "name": row["name"],
                "face_vector": deserialize_vector(row["face_vector"]),
                "body_vector": deserialize_vector(row["body_vector"]),
                "photo_path": row["photo_path"]
            })
    return identities
