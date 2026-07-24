"""OCR-based jersey number reader, restricted to digit recognition."""

import logging
import re

logger = logging.getLogger(__name__)

_DIGIT_RE = re.compile(r"^\d{1,2}$")


class JerseyReader:
    """Reads 1-2 digit jersey numbers from torso crops using EasyOCR."""

    def __init__(self):
        import easyocr  # heavy import; defer until actually needed

        self.reader = easyocr.Reader(["en"], gpu=False, verbose=False)

    def read_number(self, crop):
        """
        Attempt to read a jersey number from a BGR image crop.

        Args:
            crop: numpy array, ideally cropped to the player's torso/back.

        Returns:
            (number: int, confidence: float) or (None, 0.0) if no legible
            1-2 digit number was found.
        """
        if crop is None or crop.size == 0:
            return None, 0.0
        try:
            results = self.reader.readtext(
                crop, allowlist="0123456789", detail=1, paragraph=False
            )
        except Exception as e:
            logger.debug(f"OCR failed: {e}")
            return None, 0.0

        best = None
        best_conf = 0.0
        for _, text, conf in results:
            text = text.strip()
            if _DIGIT_RE.match(text) and conf > best_conf:
                best = int(text)
                best_conf = float(conf)
        return best, best_conf
