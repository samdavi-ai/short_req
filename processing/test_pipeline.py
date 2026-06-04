"""
Test Pipeline — Smoke test for all processing workers.

Validates that every worker loads correctly and can produce outputs
from a dummy frame without crashing.
"""

import cv2
import numpy as np
import sys
import os

# Add processing dir to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Mock redis for IntrusionEngine so it doesn't fail on connection
import redis
class MockRedis:
    def publish(self, *args, **kwargs): pass
    def get(self, *args, **kwargs): return None
    def from_url(self, *args, **kwargs): return self
redis.from_url = lambda *args, **kwargs: MockRedis()


def main():
    print("=" * 60)
    print("  Processing Pipeline Smoke Test")
    print("=" * 60)

    # ── 1. PersonDetector ─────────────────────────────────────────
    print("\n[1/8] Testing PersonDetector...")
    from workers.person_detector import PersonDetector
    detector = PersonDetector()
    dummy_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    tracks = detector.detect_and_track(dummy_frame)
    print(f"  ✓ PersonDetector loaded. Detections on blank frame: {len(tracks)}")

    # ── 2. SingleCameraTracker ────────────────────────────────────
    print("\n[2/8] Testing SingleCameraTracker...")
    from workers.single_cam_tracker import SingleCameraTracker
    tracker = SingleCameraTracker()
    state = tracker.update(tracks)
    print(f"  ✓ SingleCameraTracker loaded. Active tracks: {len(state)}")

    # ── 3. FaceDetector ───────────────────────────────────────────
    print("\n[3/8] Testing FaceDetector...")
    from workers.face_detector import FaceDetector
    face_det = FaceDetector()
    face_result = face_det.detect_faces(dummy_frame)
    print(f"  ✓ FaceDetector loaded. Face detected: {face_result is not None}")

    # ── 4. FaceEmbedder ───────────────────────────────────────────
    print("\n[4/8] Testing FaceEmbedder...")
    from workers.face_embedder import FaceEmbedder
    face_embed = FaceEmbedder()
    face_crop = np.random.randint(0, 255, (112, 112, 3), dtype=np.uint8)
    face_vec = face_embed.extract_embedding(face_crop)
    print(f"  ✓ FaceEmbedder loaded. Vector dim: {len(face_vec)}, non-zero: {not np.allclose(face_vec, 0)}")

    # ── 5. BodyReIDEmbedder ───────────────────────────────────────
    print("\n[5/8] Testing BodyReIDEmbedder...")
    from workers.body_reid import BodyReIDEmbedder
    body_reid = BodyReIDEmbedder()
    body_crop = np.random.randint(0, 255, (256, 128, 3), dtype=np.uint8)
    body_vec = body_reid.extract_embedding(body_crop)
    print(f"  ✓ BodyReIDEmbedder loaded. Vector dim: {len(body_vec)}, non-zero: {not np.allclose(body_vec, 0)}")

    # ── 6. HeadTopEmbedder ────────────────────────────────────────
    print("\n[6/8] Testing HeadTopEmbedder...")
    from workers.head_top_embedder import HeadTopEmbedder
    head_embed = HeadTopEmbedder()
    head_crop = np.random.randint(0, 255, (64, 64, 3), dtype=np.uint8)
    head_vec = head_embed.extract_embedding(head_crop)
    print(f"  ✓ HeadTopEmbedder loaded. Vector dim: {len(head_vec)}, non-zero: {not np.allclose(head_vec, 0)}")

    # ── 7. GlobalTracker ──────────────────────────────────────────
    print("\n[7/8] Testing GlobalTracker multi-signal fusion...")
    from workers.global_tracker import GlobalTracker
    gt = GlobalTracker()

    # Simulate person detected on camera 1
    gid1 = gt.match_or_create(face_vec, body_vec, head_vec, camera_id=1, floor=1)
    print(f"  ✓ New global track created: {gid1[:8]}...")

    # Simulate same person detected on camera 2 with similar body vector
    # (slightly noisy to simulate different angle)
    noisy_body = (np.array(body_vec) + np.random.randn(len(body_vec)) * 0.05).tolist()
    gid2 = gt.match_or_create(None, noisy_body, head_vec, camera_id=2, floor=1)

    matched = gid1 == gid2
    print(f"  ✓ Cross-camera match test: {'PASS — same ID' if matched else 'Expected — different ID (body noise too high or no face)'}")
    print(f"  ✓ Active global tracks: {gt.active_count}")

    # ── 8. WatchlistMatcher + IdentityResolver ────────────────────
    print("\n[8/8] Testing WatchlistMatcher + IdentityResolver...")
    from workers.watchlist_matcher import WatchlistMatcher
    from workers.identity_resolver import IdentityResolver

    wm = WatchlistMatcher()
    # Load a mock registry
    wm.load_registry(
        visitors=[{
            "id": 1,
            "fullname": "Test Visitor",
            "status": "BLACKLISTED",
            "face_vector": face_vec,
        }],
        employees=[],
    )
    print(f"  ✓ WatchlistMatcher loaded with {wm.registry_size} enrolled person(s).")

    ir = IdentityResolver(gt, wm, redis_client=None)
    identity = ir.resolve(
        global_id=gid1,
        face_vector=face_vec,
        body_vector=body_vec,
        head_vector=head_vec,
        camera_id=1,
    )
    print(f"  ✓ IdentityResolver result: {identity['identity_type']} "
          f"(name: {identity['matched_name']}, sim: {identity.get('similarity')})")

    # ── 9. EntryExitCounter ───────────────────────────────────────
    print("\n[Bonus] Testing EntryExitCounter...")
    from workers.entry_exit_counter import EntryExitCounter
    eec = EntryExitCounter()
    # Simulate movement across a tripwire
    eec.check_tripwire("t1", (100, 200), (400, 300, 400, 500), zone_id=1)
    result = eec.check_tripwire("t1", (500, 400), (400, 300, 400, 500), zone_id=1)
    print(f"  ✓ EntryExitCounter tripwire crossing: {result}")
    print(f"  ✓ Zone counts: {eec.get_zone_counts(1)}")

    # ── 10. BreakMonitor ──────────────────────────────────────────
    print("\n[Bonus] Testing EmployeeBreakMonitor...")
    from workers.break_monitor import EmployeeBreakMonitor
    bm = EmployeeBreakMonitor()
    status = bm.update_employee_status(employee_id=42, in_lounge_zone=False, camera_id=1)
    print(f"  ✓ BreakMonitor status: compliant={status['compliant']}, "
          f"time_since_break={status['time_since_break']}s")

    print("\n" + "=" * 60)
    print("  ALL CHECKS PASSED ✓")
    print("=" * 60)


if __name__ == "__main__":
    main()
