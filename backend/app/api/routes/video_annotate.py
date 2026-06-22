"""
Video Annotate Route — Upload an MP4, run the full CameraPipeline
frame-by-frame (without Redis/DB side-effects), burn bounding boxes,
labels, and accuracy metrics directly into frames, and stream back
an annotated MP4 for download.
"""

import os
import sys
import cv2
import uuid
import tempfile
import logging
import numpy as np

from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import FileResponse

logger = logging.getLogger(__name__)
router = APIRouter()

# Add processing directory to path so we can import the pipeline workers
PROCESSING_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "..", "processing"
)
if PROCESSING_DIR not in sys.path:
    sys.path.insert(0, PROCESSING_DIR)


def _draw_box(frame: np.ndarray, x1, y1, x2, y2, label: str,
              sub_label: str, color_bgr: tuple, conf: float, sim: float):
    """Draw a corner-bracket bounding box with labels on frame (OpenCV)."""
    h, w = frame.shape[:2]
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(w - 1, x2), min(h - 1, y2)
    if x2 <= x1 or y2 <= y1:
        return frame

    bw = x2 - x1
    bh = y2 - y1
    corner = max(12, int(min(bw, bh) * 0.18))
    thick = 2

    r, g, b = color_bgr

    # Semi-transparent fill
    overlay = frame.copy()
    cv2.rectangle(overlay, (x1, y1), (x2, y2), (b, g, r), -1)
    alpha = 0.07
    frame = cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0)

    # Corner brackets
    # TL
    cv2.line(frame, (x1, y1), (x1 + corner, y1), (b, g, r), thick)
    cv2.line(frame, (x1, y1), (x1, y1 + corner), (b, g, r), thick)
    # TR
    cv2.line(frame, (x2, y1), (x2 - corner, y1), (b, g, r), thick)
    cv2.line(frame, (x2, y1), (x2, y1 + corner), (b, g, r), thick)
    # BL
    cv2.line(frame, (x1, y2), (x1 + corner, y2), (b, g, r), thick)
    cv2.line(frame, (x1, y2), (x1, y2 - corner), (b, g, r), thick)
    # BR
    cv2.line(frame, (x2, y2), (x2 - corner, y2), (b, g, r), thick)
    cv2.line(frame, (x2, y2), (x2, y2 - corner), (b, g, r), thick)

    # Name label (top-left, above box)
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 0.45
    name_text = label
    (tw, th), _ = cv2.getTextSize(name_text, font, font_scale, 1)
    lx1, ly1 = x1, max(0, y1 - th - 6)
    cv2.rectangle(frame, (lx1, ly1), (lx1 + tw + 8, ly1 + th + 6), (b, g, r), -1)
    cv2.putText(frame, name_text, (lx1 + 4, ly1 + th + 2), font, font_scale, (0, 0, 0), 1, cv2.LINE_AA)

    # Status tag (bottom-left, below box)
    metrics_text = sub_label
    if conf > 0:
        metrics_text += f" | Det:{conf:.0%}"
    if sim is not None:
        metrics_text += f" | Face:{sim:.0%}"
    (tw2, th2), _ = cv2.getTextSize(metrics_text, font, 0.38, 1)
    sx1 = x1
    sy1 = min(h - 1, y2 + 2)
    bg_alpha = 0.6
    overlay2 = frame.copy()
    cv2.rectangle(overlay2, (sx1, sy1), (sx1 + tw2 + 8, sy1 + th2 + 6), (b, g, r), -1)
    frame = cv2.addWeighted(overlay2, bg_alpha, frame, 1 - bg_alpha, 0)
    cv2.putText(frame, metrics_text, (sx1 + 4, sy1 + th2 + 2), font, 0.38, (0, 0, 0), 1, cv2.LINE_AA)

    return frame


@router.post("/")
async def annotate_video(file: UploadFile = File(...)):
    """
    Upload an MP4 file, run the full AI pipeline on every frame,
    burn bounding-box overlays with identity labels and accuracy metrics,
    and return the annotated video as a downloadable MP4.

    - Green boxes  = KNOWN_EMPLOYEE or KNOWN_VISITOR (authorized)
    - Red boxes    = UNKNOWN / BLACKLISTED / WATCHLIST_MATCH (unauthorized)
    """
    if not file.filename or not file.filename.lower().endswith(".mp4"):
        raise HTTPException(status_code=400, detail="Only .mp4 files are supported.")

    # Save uploaded file to temp
    tmp_in = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
    contents = await file.read()
    tmp_in.write(contents)
    tmp_in.close()

    tmp_out_path = tmp_in.name.replace(".mp4", "_annotated.mp4")

    try:
        # Import pipeline workers (lazy — avoids loading heavy models at startup)
        from workers.person_detector import PersonDetector
        from workers.single_cam_tracker import SingleCameraTracker
        from workers.face_detector import FaceDetector
        from workers.face_embedder import FaceEmbedder
        from workers.body_reid import BodyReIDEmbedder
        from workers.global_tracker import GlobalTracker
        from workers.watchlist_matcher import WatchlistMatcher
        from workers.identity_resolver import IdentityResolver
        import utils.database_logger as db_log

        # Initialize workers (shared singleton not needed — this is one-off offline)
        detector = PersonDetector()
        tracker = SingleCameraTracker()
        face_detector = FaceDetector()
        face_embedder = FaceEmbedder(face_detector=face_detector)
        body_reid = BodyReIDEmbedder()
        global_tracker = GlobalTracker()
        watchlist_matcher = WatchlistMatcher()
        # Use a dummy redis-less identity resolver
        identity_resolver = IdentityResolver(global_tracker, watchlist_matcher, redis_client=None)

        # Load enrolled faces
        enrolled = db_log.load_enrolled_identities()
        visitors_reg = []
        employees_reg = []
        for p in enrolled:
            fv = p.get("face_vector")
            if not fv:
                continue
            ptype = (p.get("person_type") or "EMPLOYEE").upper()
            if ptype == "VISITOR":
                visitors_reg.append({"id": p["id"], "fullname": p["name"],
                                     "status": "WHITELISTED", "face_vector": fv})
            else:
                employees_reg.append({"id": p["id"], "fullname": p["name"],
                                      "employee_code": f"EMP-{p['id']:03d}", "face_vector": fv})
        watchlist_matcher.load_registry(visitors_reg, employees_reg)

        # Open video
        cap = cv2.VideoCapture(tmp_in.name)
        if not cap.isOpened():
            raise HTTPException(status_code=500, detail="Could not open uploaded video.")

        fps = cap.get(cv2.CAP_PROP_FPS) or 25
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(tmp_out_path, fourcc, fps, (width, height))

        frame_count = 0
        skip = 1  # process every frame for annotation accuracy

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            frame_count += 1
            # We process every frame but only run AI every `skip` frames
            if frame_count % skip != 0:
                writer.write(frame)
                continue

            h, w = frame.shape[:2]
            tracked_objects = detector.detect_and_track(frame)
            conf_by_track_id = {t["track_id"]: t.get("conf", 0.0) for t in tracked_objects}
            tracks = tracker.update(tracked_objects)

            for track_id, bbox in tracks:
                x1, y1, x2, y2 = bbox
                x1, y1 = max(0, x1), max(0, y1)
                x2, y2 = min(w, x2), min(h, y2)

                crop = frame[y1:y2, x1:x2]
                if crop.size == 0:
                    continue

                # Face detection + embedding
                face_bbox = face_detector.detect_faces(crop)
                has_face = face_bbox is not None
                face_vector = None
                if has_face:
                    fx1, fy1, fx2, fy2 = face_bbox
                    fc = crop[fy1:fy2, fx1:fx2]
                    if fc.size > 0:
                        face_vector = face_embedder.extract_embedding(fc)

                # Body ReID
                body_vector = body_reid.extract_embedding(crop)

                # Global tracking
                global_id = global_tracker.match_or_create(
                    face_vector=face_vector,
                    body_vector=body_vector,
                    head_vector=None,
                    camera_id=-1,
                    floor=1,
                    is_overhead=False,
                )

                # Identity resolution
                identity = identity_resolver.resolve(
                    global_id=global_id,
                    face_vector=face_vector,
                    body_vector=body_vector,
                    head_vector=None,
                    camera_id=-1,
                    floor=1,
                )

                identity_type = identity.get("identity_type", "UNKNOWN")
                matched_name = identity.get("matched_name") or f"UNKNOWN #{track_id}"
                conf = float(conf_by_track_id.get(track_id, 0.0))
                sim = identity.get("similarity")

                is_authorized = identity_type in ("KNOWN_EMPLOYEE", "KNOWN_VISITOR")
                is_dangerous = identity_type in ("BLACKLISTED", "WATCHLIST_MATCH")

                if is_authorized:
                    color = (34, 197, 94)     # green
                    status_tag = "AUTHORIZED"
                elif is_dangerous:
                    color = (239, 68, 68)     # red
                    status_tag = identity_type.replace("_", " ")
                else:
                    color = (239, 68, 68)     # red
                    status_tag = "UNAUTHORIZED"

                face_tag = " [FACE✓]" if has_face else ""
                frame = _draw_box(
                    frame,
                    x1, y1, x2, y2,
                    label=f"{matched_name}{face_tag}",
                    sub_label=status_tag,
                    color_bgr=color,
                    conf=conf,
                    sim=sim,
                )

            writer.write(frame)

        cap.release()
        writer.release()

    except Exception as e:
        logger.exception("Error annotating video: %s", e)
        for p in [tmp_in.name, tmp_out_path]:
            try:
                os.remove(p)
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=f"Annotation failed: {e}")

    finally:
        # Clean up input temp file
        try:
            os.remove(tmp_in.name)
        except Exception:
            pass

    out_filename = f"annotated_{file.filename}"
    return FileResponse(
        path=tmp_out_path,
        media_type="video/mp4",
        filename=out_filename,
        headers={"Content-Disposition": f'attachment; filename="{out_filename}"'},
        background=None,
    )
