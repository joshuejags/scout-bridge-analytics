import cv2
import numpy as np
import logging

logger = logging.getLogger(__name__)


class VideoAnalyzer:
    """Main video analysis orchestrator."""

    def __init__(self, player_detector, ball_tracker):
        """Initialize analyzer with detectors."""
        self.player_detector = player_detector
        self.ball_tracker = ball_tracker

    def analyze_frame(self, frame):
        """
        Analyze a single frame.

        Args:
            frame: Input video frame

        Returns:
            Analysis results
        """
        try:
            players = self.player_detector.detect_players(frame)
            ball = self.ball_tracker.detect_ball(frame)

            return {"players": players, "ball": ball}
        except Exception as e:
            logger.error(f"Error analyzing frame: {e}")
            return {"players": [], "ball": None}

    def analyze_video(self, video_path, output_path=None):
        """
        Analyze entire video.

        Args:
            video_path: Path to input video
            output_path: Path to save output video (optional)

        Returns:
            Analysis results
        """
        try:
            cap = cv2.VideoCapture(video_path)
            if not cap.isOpened():
                raise ValueError(f"Cannot open video: {video_path}")

            fps = cap.get(cv2.CAP_PROP_FPS)
            frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

            analysis_results = {
                "metadata": {"fps": fps, "frame_count": frame_count, "width": width, "height": height},
                "frames": [],
            }

            frame_idx = 0
            while True:
                ret, frame = cap.read()
                if not ret:
                    break

                frame_analysis = self.analyze_frame(frame)
                analysis_results["frames"].append(
                    {"frame_number": frame_idx, "analysis": frame_analysis}
                )

                frame_idx += 1

                if frame_idx % 30 == 0:
                    logger.info(f"Analyzed frame {frame_idx}/{frame_count}")

            cap.release()
            return analysis_results

        except Exception as e:
            logger.error(f"Error analyzing video: {e}")
            return None
