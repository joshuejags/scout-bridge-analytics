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
        Detect players in a frame.

        Args:
            frame: Input video frame (numpy array)

        Returns:
            List of detections with bounding boxes and confidence scores
        """
        try:
            results = self.model(frame)
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
