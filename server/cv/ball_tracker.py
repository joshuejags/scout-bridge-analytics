import cv2
import numpy as np
import logging

logger = logging.getLogger(__name__)


class BallTracker:
    """Ball detection and tracking using color-based detection."""

    def __init__(self, ball_color_lower=(35, 100, 100), ball_color_upper=(85, 255, 255)):
        """
        Initialize ball tracker.

        Args:
            ball_color_lower: Lower HSV bound for ball color
            ball_color_upper: Upper HSV bound for ball color
        """
        self.ball_color_lower = np.array(ball_color_lower)
        self.ball_color_upper = np.array(ball_color_upper)

    def detect_ball(self, frame):
        """
        Detect ball in frame using color-based detection.

        Args:
            frame: Input video frame

        Returns:
            Ball position (x, y) or None if not found
        """
        try:
            hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
            mask = cv2.inRange(hsv, self.ball_color_lower, self.ball_color_upper)

            # Morphological operations
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
            mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
            mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

            # Find contours
            contours, _ = cv2.findContours(mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

            if contours:
                # Get largest contour
                largest_contour = max(contours, key=cv2.contourArea)
                area = cv2.contourArea(largest_contour)

                if area > 50:
                    M = cv2.moments(largest_contour)
                    if M["m00"] > 0:
                        cx = int(M["m10"] / M["m00"])
                        cy = int(M["m01"] / M["m00"])
                        return {"position": (cx, cy), "area": area}

            return None
        except Exception as e:
            logger.error(f"Error detecting ball: {e}")
            return None

    def draw_ball(self, frame, ball_data):
        """Draw ball on frame."""
        if ball_data:
            x, y = ball_data["position"]
            cv2.circle(frame, (x, y), 10, (0, 0, 255), 2)
        return frame
