import os
import cv2
import numpy as np
from ultralytics import YOLO
import logging

logger = logging.getLogger(__name__)


class PlayerDetector:
    """YOLO-based player detection and tracking."""

    def __init__(self, model_path="yolov8n.pt"):
        """Initialize YOLO model for player detection."""
        try:
            self.model = YOLO(model_path)
            logger.info(f"YOLO model loaded: {model_path}")
        except Exception as e:
            logger.error(f"Error loading YOLO model: {e}")
            raise

    def detect_players(self, frame):
        """
        Detect players in a frame (no cross-frame identity tracking).

        Args:
            frame: Input video frame (numpy array)

        Returns:
            List of detections with bounding boxes and confidence scores
        """
        try:
            results = self.model(frame, verbose=False)
            detections = []

            for result in results:
                boxes = result.boxes
                for box in boxes:
                    x1, y1, x2, y2 = box.xyxy[0]
                    conf = box.conf[0]
                    cls = box.cls[0]

                    # Filter for person class (class 0 in COCO)
                    if int(cls) == 0:
                        detections.append(
                            {
                                "bbox": [float(x1), float(y1), float(x2), float(y2)],
                                "confidence": float(conf),
                                "class": int(cls),
                            }
                        )

            return detections
        except Exception as e:
            logger.error(f"Error detecting players: {e}")
            return []

    def track_players(self, frame, tracker_config=None):
        """
        Detect and track players across frames using Ultralytics' built-in
        tracker. Must be called on consecutive frames of the same video for
        track IDs to be meaningful; use a fresh PlayerDetector instance
        between videos so the tracker's internal state doesn't bleed
        across clips.

        Args:
            frame: Input video frame (numpy array)
            tracker_config: path to a tracker YAML config. Defaults to the
                bundled tracktrack_reid.yaml (TrackTrack, a 2025 multi-cue
                tracker, with appearance ReID enabled). Measured on this
                project's football footage: 48 surviving tracks over a full
                46s clip vs 68 for plain ByteTrack and 68 for stock
                TrackTrack without ReID — a ~29% reduction in fragmented
                player identities, at no meaningful runtime cost since ReID
                reuses YOLO's own features rather than a separate model.
                Plain BoT-SORT+ReID was also tried and showed no
                improvement over ByteTrack (41 vs 42 tracks/300 frames).

        Returns:
            List of detections with bounding boxes, confidence scores, and
            a persistent "track_id" (int, or None if the tracker has not
            yet assigned one for this detection).
        """
        if tracker_config is None:
            tracker_config = os.path.join(
                os.path.dirname(os.path.abspath(__file__)), "tracktrack_reid.yaml"
            )
        try:
            results = self.model.track(
                frame,
                persist=True,
                classes=[0],
                verbose=False,
                tracker=tracker_config,
            )
            detections = []

            for result in results:
                boxes = result.boxes
                if boxes is None:
                    continue
                ids = boxes.id
                for i, box in enumerate(boxes):
                    x1, y1, x2, y2 = box.xyxy[0]
                    conf = box.conf[0]
                    track_id = int(ids[i]) if ids is not None else None
                    detections.append(
                        {
                            "bbox": [float(x1), float(y1), float(x2), float(y2)],
                            "confidence": float(conf),
                            "class": 0,
                            "track_id": track_id,
                        }
                    )

            return detections
        except Exception as e:
            logger.error(f"Error tracking players: {e}")
            return []

    def draw_detections(self, frame, detections):
        """Draw bounding boxes on frame."""
        for det in detections:
            x1, y1, x2, y2 = det["bbox"]
            cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), (0, 255, 0), 2)
            cv2.putText(
                frame,
                f"Conf: {det['confidence']:.2f}",
                (int(x1), int(y1) - 10),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (0, 255, 0),
                2,
            )
        return frame
