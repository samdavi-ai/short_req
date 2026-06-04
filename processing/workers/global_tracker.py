import uuid
import numpy as np

class GlobalTracker:
    def __init__(self):
        # In a full deployment, this connects to Milvus vector collections.
        # We will use an in-memory cosine similarity store for local matching.
        print("Global Multi-Camera Tracker initialized (local similarity cache).")
        self.spatio_temporal_cache = {} # global_id -> { camera_id, body_vector, last_seen }
        self.similarity_threshold = 0.75 # Cosine similarity threshold

    def cosine_similarity(self, v1, v2):
        return np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-12)

    def match_or_create(self, face_vector, body_vector, head_vector, camera_id):
        best_match_id = None
        highest_sim = -1.0

        if body_vector is not None and sum(body_vector) != 0:
            for gid, data in self.spatio_temporal_cache.items():
                if data["body_vector"] is not None:
                    sim = self.cosine_similarity(body_vector, data["body_vector"])
                    if sim > highest_sim:
                        highest_sim = sim
                        best_match_id = gid

        if highest_sim > self.similarity_threshold and best_match_id:
            # Update cache
            self.spatio_temporal_cache[best_match_id]["camera_id"] = camera_id
            self.spatio_temporal_cache[best_match_id]["body_vector"] = body_vector
            return best_match_id

        # Generate new UUID if no match exists
        global_id = str(uuid.uuid4())
        self.spatio_temporal_cache[global_id] = {
            "camera_id": camera_id,
            "body_vector": body_vector,
            "matched_via": "new_track"
        }
        return global_id
