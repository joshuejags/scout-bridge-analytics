import logging

from ultralytics import YOLO

logger = logging.getLogger(__name__)

# COCO's 17-keypoint skeleton, in the order YOLOv8-pose outputs them.
COCO_KEYPOINT_NAMES = [
    "nose",
    "left_eye",
    "right_eye",
    "left_ear",
    "right_ear",
    "left_shoulder",
    "right_shoulder",
    "left_elbow",
    "right_elbow",
    "left_wrist",
    "right_wrist",
    "left_hip",
    "right_hip",
    "left_knee",
    "right_knee",
    "left_ankle",
    "right_ankle",
]


class PoseEstimator:
    """Per-frame human pose estimation via YOLOv8-pose (yolov8n-pose.pt).

    Deliberately a separate model/pass from PlayerDetector's yolov8n.pt +
    TrackTrack tracking, rather than switching player detection over to a
    combined detect+pose model: PlayerDetector's tracker config has been
    specifically tuned for this project (ReID, merge behavior — see its
    own docstring), and swapping the underlying detector model would risk
    regressing that already-verified tracking accuracy. Detections from
    this pass are matched back to existing tracks by bounding-box overlap
    (see video_analyzer.py's _match_pose_to_track) instead of creating a
    second, parallel identity system.
    """

    def __init__(self, model_path="yolov8n-pose.pt"):
        try:
            self.model = YOLO(model_path)
            logger.info(f"YOLOv8-pose model loaded: {model_path}")
        except Exception as e:
            logger.error(f"Error loading pose model: {e}")
            raise

    def estimate(self, frame):
        """
        Returns a list of {"bbox": [x1, y1, x2, y2], "keypoints": {name: {x, y, confidence}}}
        for every person detected in this frame. bbox is only used to
        match against existing player tracks by IoU — this never creates
        tracks of its own.
        """
        try:
            results = self.model(frame, verbose=False)
            detections = []
            for result in results:
                if result.keypoints is None or result.boxes is None:
                    continue
                boxes = result.boxes
                kpts = result.keypoints
                for i in range(len(boxes)):
                    if int(boxes.cls[i]) != 0:  # person class (COCO)
                        continue
                    xy = kpts.xy[i]
                    conf = kpts.conf[i] if kpts.conf is not None else None
                    keypoints = {}
                    for j, name in enumerate(COCO_KEYPOINT_NAMES):
                        x, y = float(xy[j][0]), float(xy[j][1])
                        if x == 0.0 and y == 0.0:
                            continue  # model marks an undetected joint this way
                        c = float(conf[j]) if conf is not None else 0.0
                        keypoints[name] = {"x": round(x, 1), "y": round(y, 1), "confidence": round(c, 3)}
                    x1, y1, x2, y2 = [float(v) for v in boxes.xyxy[i]]
                    detections.append({"bbox": [x1, y1, x2, y2], "keypoints": keypoints})
            return detections
        except Exception as e:
            logger.error(f"Error estimating pose: {e}")
            return []
