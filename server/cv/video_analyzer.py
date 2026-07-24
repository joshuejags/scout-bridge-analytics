"""
Video analysis CLI.

Usage:
    python video_analyzer.py <video_path> [--output <json_path>] [--max-frames N]

Reads a video, runs player detection and ball tracking per frame, then writes
a JSON analysis document to the output path (or stdout) shaped to match the
Node Analysis schema.

Player detections are produced by Ultralytics' ByteTrack, which frequently
fragments a single real player into several track IDs across occlusions or
re-entries into frame. To recover real player identities (a football match
has 22 players + 1 referee, not the 40-70 raw tracks ByteTrack tends to
produce), each track is periodically OCR-sampled for a visible jersey
number and classified by dominant shirt color. Tracks that agree on both
(jersey number, shirt color) are merged into a single player identity
before statistics are computed. Tracks with no legible number remain
distinct "unidentified" entities rather than being merged speculatively.

Ball tracking produces a per-frame position series. Possession is
approximated by nearest-player within a radius. "Shot" actions are inferred
from velocity spikes near the ball; "pass"/"tackle"/"interception" are
inferred from possession transferring between players, classified by
whether the two players share a shirt color (pass) and, if not, whether
they were physically close together at the moment of transfer (tackle) or
not (interception). A grid heatmap aggregates all player positions.
"""

import argparse
import json
import logging
import math
import os
import sys
import time

import cv2
import numpy as np
from collections import defaultdict, Counter

from player_detector import PlayerDetector
from ball_tracker import BallTracker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("video_analyzer")

# Per-sport calibration: real-world playing-surface length (the dimension a
# broadcast-style side-on camera typically shows across the frame's full
# width) and the ball's HSV color range for ball_tracker's color-based
# detection. Pixels-per-meter is derived at runtime as
# frame_width_px / field_length_m rather than a flat constant, so it's
# correct for whatever the actual video's resolution is, not just a
# 1280-wide assumption.
#
# "soccer" is the original, tested default (105m pitch length; the ball
# color range is whatever this project's own broadcast-footage tuning
# arrived at — it is deliberately left unchanged from before per-sport
# support existed). The other presets are reasonable starting points, not
# footage-verified the way soccer's is: a real deployment for a new sport
# should confirm the ball color range against its own footage.
SPORT_PRESETS = {
    "soccer": {
        "field_length_m": 105.0,
        "ball_color_lower": (35, 100, 100),
        "ball_color_upper": (85, 255, 255),
    },
    "basketball": {
        "field_length_m": 28.0,
        "ball_color_lower": (5, 150, 100),
        "ball_color_upper": (20, 255, 255),
    },
    "hockey": {
        "field_length_m": 91.4,
        "ball_color_lower": (0, 0, 180),
        "ball_color_upper": (179, 60, 255),
    },
    "rugby": {
        "field_length_m": 100.0,
        "ball_color_lower": (0, 0, 180),
        "ball_color_upper": (179, 60, 255),
    },
}
DEFAULT_SPORT = "soccer"

# Player speed above this many m/s is counted as a sprint.
SPRINT_SPEED_MS = 7.0
# Minimum speed (m/s) for a player to be considered to "have" the ball.
POSSESSION_RADIUS_PX = 60
# Number of matched frames back used to compute a smoothed instantaneous
# speed. Raw frame-to-frame centroid deltas are dominated by YOLO bbox
# jitter; averaging over a short window filters that noise out.
SPEED_WINDOW = 5
# Consecutive matched frames a track must sustain SPRINT_SPEED_MS before it
# counts as one sprint event (avoids counting single noisy frames).
MIN_SPRINT_RUN = 5
# Minimum frame gap between two "shot" events for the same track.
SHOT_COOLDOWN_FRAMES = 30
# When ball possession transfers between two players on different teams
# (by shirt color), the transfer is a "tackle" if the two were within this
# many pixels of each other (a physical challenge) or an "interception"
# otherwise (the new owner read and cut out a pass from a distance).
TACKLE_PROXIMITY_PX = 50

# --- Jersey OCR / track-merging tuning ---
# Only attempt OCR when the detected person is at least this tall in pixels;
# smaller crops are too low-resolution for digits to be legible.
MIN_BBOX_HEIGHT_FOR_OCR = 70
# Minimum frames between OCR attempts on the same track. Real success rate
# is low (~4% of attempts on typical broadcast-angle footage, since a
# number is only legible when the player's back is to the camera), so we
# sample frequently rather than a handful of times per track.
OCR_SAMPLE_INTERVAL_FRAMES = 3
# Stop attempting OCR on a track once it has this many total attempts,
# whether or not a number was ever read (caps worst-case runtime). Set high
# enough to cover most of a track's lifetime — OCR is cheap relative to
# player detection/tracking, so this is not the runtime bottleneck.
MAX_OCR_ATTEMPTS_PER_TRACK = 60
# Stop attempting OCR once a track has this many *agreeing* reads for the
# same number (it's considered "locked").
LOCK_VOTES = 3
# A track needs at least this many agreeing reads (out of however many
# attempts it got) before its jersey number is trusted for merging.
MIN_VOTES_TO_TRUST = 2
# Minimum EasyOCR confidence to count a reading as a vote at all.
MIN_OCR_CONFIDENCE = 0.35


def _grid_cell(x, y, frame_w, frame_h, cell_size=50):
    """Map a (x, y) pixel to a heatmap grid cell."""
    gx = min(int(x / cell_size), (frame_w // cell_size) - 1)
    gy = min(int(y / cell_size), (frame_h // cell_size) - 1)
    return max(gx, 0), max(gy, 0)


# Coarse color buckets used to distinguish kits. HSV hue ranges (OpenCV
# scale: hue in [0, 180]). "White"/"black"/"grey" are decided by
# saturation/value instead of hue since hue is meaningless when desaturated.
_COLOR_BUCKETS = [
    ("red", (0, 10)),
    ("orange", (10, 22)),
    ("yellow", (22, 35)),
    ("green", (35, 78)),
    ("cyan", (78, 100)),
    ("blue", (100, 130)),
    ("purple", (130, 150)),
    ("pink", (150, 170)),
    ("red", (170, 180)),
]


def _torso_crop(frame, bbox):
    """Crop the upper-middle third of a person bbox (torso, where jersey
    numbers and dominant shirt color live), avoiding head and legs."""
    x1, y1, x2, y2 = bbox
    h = y2 - y1
    top = y1 + h * 0.15
    bottom = y1 + h * 0.55
    x1c, x2c = x1 + (x2 - x1) * 0.15, x2 - (x2 - x1) * 0.15
    fh, fw = frame.shape[:2]
    x1c, x2c = max(0, int(x1c)), min(fw, int(x2c))
    top, bottom = max(0, int(top)), min(fh, int(bottom))
    if x2c <= x1c or bottom <= top:
        return None
    return frame[top:bottom, x1c:x2c]


def _dominant_shirt_color(crop):
    """Classify the dominant color of a torso crop into a coarse bucket."""
    if crop is None or crop.size == 0:
        return None
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    h, s, v = hsv[:, :, 0].flatten(), hsv[:, :, 1].flatten(), hsv[:, :, 2].flatten()

    # Exclude near-grass pixels (green field bleeding into crop edges) and
    # very low-saturation/low-value pixels (shadow) from the vote.
    mask = np.ones_like(h, dtype=bool)

    sat_mean = float(np.mean(s[mask])) if mask.any() else 0.0
    val_mean = float(np.mean(v[mask])) if mask.any() else 0.0

    if sat_mean < 40 and val_mean > 170:
        return "white"
    if val_mean < 60:
        return "black"
    if sat_mean < 40:
        return "grey"

    hue_mean = float(np.median(h[mask & (s > 40)])) if (mask & (s > 40)).any() else float(np.median(h))
    for name, (lo, hi) in _COLOR_BUCKETS:
        if lo <= hue_mean < hi:
            return name
    return "unknown"


def analyze(video_path, max_frames=None, enable_jersey_ocr=True, thumbnail_dir=None, sport=DEFAULT_SPORT):
    """Run full analysis and return a dict matching the Analysis schema.

    Args:
        thumbnail_dir: if given, one representative JPEG crop per surviving
            player track is written here as "<track_id>.jpg", for use by a
            human-review UI (jersey OCR only identifies a small fraction of
            tracks on typical broadcast-angle footage, so a person needs to
            be able to look at each track and label/merge it manually).
        sport: key into SPORT_PRESETS, controlling real-world field-size
            calibration (distance/speed accuracy) and ball color detection.
    """
    if not os.path.isfile(video_path):
        raise FileNotFoundError(f"Video not found: {video_path}")

    if thumbnail_dir:
        os.makedirs(thumbnail_dir, exist_ok=True)

    preset = SPORT_PRESETS.get(sport, SPORT_PRESETS[DEFAULT_SPORT])

    detector = PlayerDetector()
    tracker = BallTracker(preset["ball_color_lower"], preset["ball_color_upper"])

    jersey_reader = None
    if enable_jersey_ocr:
        try:
            from jersey_reader import JerseyReader

            jersey_reader = JerseyReader()
            logger.info("Jersey OCR enabled")
        except Exception as e:
            logger.warning(f"Jersey OCR unavailable, continuing without it: {e}")
            jersey_reader = None

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    # Derived from the actual frame width rather than a flat constant, so
    # it's correct for whatever resolution this particular video is, not
    # just whatever resolution the original flat constant assumed.
    px_per_meter = width / preset["field_length_m"] if width > 0 else 12.0

    # Tracks: track_id -> {positions: [...], frames: [...], speeds: [...]}
    tracks = {}
    ball_series = []
    possession_events = []  # list of (frame, track_id, duration)
    actions = []
    heatmap_counts = defaultdict(int)

    frame_idx = 0
    last_ball_owner = None
    last_owner_since = None

    while True:
        if max_frames is not None and frame_idx >= max_frames:
            break
        ret, frame = cap.read()
        if not ret:
            break

        # 1. Detect + track players in one pass using Ultralytics' built-in
        # ByteTrack tracker, which maintains identity across brief occlusion
        # far more robustly than nearest-centroid matching.
        detections = detector.track_players(frame)
        matched_tids = set()
        for d in detections:
            tid = d.get("track_id")
            if tid is None:
                # Tracker hasn't confirmed an ID for this detection yet; skip
                # rather than inventing a synthetic one that fragments tracks.
                continue
            cx = (d["bbox"][0] + d["bbox"][2]) / 2
            cy = (d["bbox"][1] + d["bbox"][3]) / 2
            if tid not in tracks:
                tracks[tid] = {
                    "positions": [],
                    "frames": [],
                    "confidences": [],
                    "poses": [],
                    "speeds": [],
                    "sprint_run": 0,
                    "sprint_count": 0,
                    "jersey_votes": Counter(),
                    "jersey_number": None,
                    "color_votes": Counter(),
                    "shirt_color": None,
                    "ocr_attempts": 0,
                    "last_ocr_frame": -OCR_SAMPLE_INTERVAL_FRAMES,
                }
            track = tracks[tid]
            track["positions"].append({"x": cx, "y": cy})
            track["frames"].append(frame_idx)
            track["confidences"].append(d["confidence"])
            track["poses"].append({})
            track["_last_xy"] = (cx, cy)
            matched_tids.add(tid)

            # Keep the largest (closest-to-camera, most legible) full-body
            # crop seen so far as this track's representative thumbnail.
            if thumbnail_dir:
                bbox_h = d["bbox"][3] - d["bbox"][1]
                if bbox_h > track.get("best_crop_score", 0):
                    x1, y1, x2, y2 = [int(v) for v in d["bbox"]]
                    x1, y1 = max(0, x1), max(0, y1)
                    x2, y2 = min(width, x2), min(height, y2)
                    if x2 > x1 and y2 > y1:
                        track["best_crop_score"] = bbox_h
                        track["best_crop"] = frame[y1:y2, x1:x2].copy()

            # Shirt color: cheap per-frame classification, voted on every
            # matched frame (unlike OCR, which is comparatively expensive).
            torso = _torso_crop(frame, d["bbox"])
            color = _dominant_shirt_color(torso)
            if color:
                track["color_votes"][color] += 1
                track["shirt_color"] = track["color_votes"].most_common(1)[0][0]

            # Jersey number OCR: only on tall-enough crops, throttled per
            # track, and stopped once a number has enough agreeing votes.
            bbox_h = d["bbox"][3] - d["bbox"][1]
            if (
                jersey_reader is not None
                and track["jersey_number"] is None
                and bbox_h >= MIN_BBOX_HEIGHT_FOR_OCR
                and track["ocr_attempts"] < MAX_OCR_ATTEMPTS_PER_TRACK
                and frame_idx - track["last_ocr_frame"] >= OCR_SAMPLE_INTERVAL_FRAMES
            ):
                track["last_ocr_frame"] = frame_idx
                track["ocr_attempts"] += 1
                torso_full = _torso_crop(frame, d["bbox"])
                number, conf = jersey_reader.read_number(torso_full)
                if number is not None and conf >= MIN_OCR_CONFIDENCE:
                    track["jersey_votes"][number] += 1
                    top_number, top_votes = track["jersey_votes"].most_common(1)[0]
                    if top_votes >= LOCK_VOTES or (
                        track["ocr_attempts"] >= MAX_OCR_ATTEMPTS_PER_TRACK
                        and top_votes >= MIN_VOTES_TO_TRUST
                    ):
                        track["jersey_number"] = top_number

        # 3. Compute smoothed speed (m/s) per matched track using real elapsed
        # frames (not assumed 1/fps), averaged over a short window to filter
        # out YOLO bbox centroid jitter.
        for tid in matched_tids:
            track = tracks[tid]
            positions = track["positions"]
            frames = track["frames"]
            n = len(positions)
            if n >= 2:
                lookback = min(SPEED_WINDOW, n - 1)
                p_prev = positions[n - 1 - lookback]
                p_curr = positions[n - 1]
                frame_gap = frames[n - 1] - frames[n - 1 - lookback]
                dt = frame_gap / fps if frame_gap > 0 else 1.0 / fps
                dx = (p_curr["x"] - p_prev["x"]) / px_per_meter
                dy = (p_curr["y"] - p_prev["y"]) / px_per_meter
                speed = math.hypot(dx, dy) / dt if dt > 0 else 0.0
            else:
                speed = 0.0
            track.setdefault("speeds", []).append(speed)

            # Sprint counted as a discrete event: MIN_SPRINT_RUN consecutive
            # matched frames above threshold increments sprint_count once,
            # then requires the run to break before counting again.
            if speed >= SPRINT_SPEED_MS:
                track["sprint_run"] = track.get("sprint_run", 0) + 1
                if track["sprint_run"] == MIN_SPRINT_RUN:
                    track["sprint_count"] = track.get("sprint_count", 0) + 1
            else:
                track["sprint_run"] = 0

        # 4. Ball detection
        ball = tracker.detect_ball(frame)
        if ball:
            bx, by = ball["position"]
            ball_series.append(
                {
                    "frameNumber": frame_idx,
                    "position": {"x": float(bx), "y": float(by)},
                    "confidence": float(min(1.0, ball["area"] / 5000.0)),
                }
            )
            # 5. Possession: nearest currently-visible player within radius
            nearest_tid = None
            nearest_d = POSSESSION_RADIUS_PX
            for tid in matched_tids:
                tx, ty = tracks[tid]["_last_xy"]
                d = math.hypot(bx - tx, by - ty)
                if d < nearest_d:
                    nearest_d = d
                    nearest_tid = tid
            if nearest_tid is not None:
                if last_ball_owner == nearest_tid:
                    pass  # same owner, accumulate
                else:
                    if last_ball_owner is not None and last_owner_since is not None:
                        duration_frames = frame_idx - last_owner_since
                        if duration_frames > 0:
                            possession_events.append(
                                {
                                    "playerId": str(last_ball_owner),
                                    "duration": float(duration_frames / fps),
                                    "startFrame": last_owner_since,
                                    "endFrame": frame_idx,
                                }
                            )
                        # 5b. Classify the transfer itself as a pass (same
                        # team), tackle (opposing team, players close
                        # together — a physical challenge), or interception
                        # (opposing team, at a distance — a misplaced pass
                        # read and cut out). Shirt color, voted every
                        # matched frame for the track-merge step above, is
                        # the only team signal available without a jersey
                        # number on both sides, so this only classifies
                        # transfers where both tracks have a color already.
                        prev_color = tracks[last_ball_owner].get("shirt_color")
                        new_color = tracks[nearest_tid].get("shirt_color")
                        if prev_color and new_color:
                            if prev_color == new_color:
                                actions.append(
                                    {
                                        "type": "pass",
                                        "playerId": str(last_ball_owner),
                                        "frameNumber": frame_idx,
                                        "confidence": 0.5,
                                    }
                                )
                            else:
                                ptx, pty = tracks[last_ball_owner]["_last_xy"]
                                ntx, nty = tracks[nearest_tid]["_last_xy"]
                                proximity = math.hypot(ntx - ptx, nty - pty)
                                action_type = (
                                    "tackle" if proximity < TACKLE_PROXIMITY_PX else "interception"
                                )
                                actions.append(
                                    {
                                        "type": action_type,
                                        "playerId": str(nearest_tid),
                                        "frameNumber": frame_idx,
                                        "confidence": 0.5,
                                    }
                                )
                    last_ball_owner = nearest_tid
                    last_owner_since = frame_idx
        # else: ball not detected this frame; ownership unchanged

        # 6. Heatmap accumulation (one tick per currently-visible player this frame)
        for tid in matched_tids:
            x, y = tracks[tid]["_last_xy"]
            gx, gy = _grid_cell(x, y, width, height)
            heatmap_counts[(gx, gy)] += 1

        # 7. Action detection: heuristic for "shot" = sprint + close to ball
        if ball:
            bx, by = ball["position"]
            for tid in matched_tids:
                track = tracks[tid]
                if not track.get("speeds"):
                    continue
                cur_speed = track["speeds"][-1]
                if cur_speed < SPRINT_SPEED_MS:
                    continue
                last_shot_frame = track.get("last_shot_frame")
                if last_shot_frame is not None and frame_idx - last_shot_frame < SHOT_COOLDOWN_FRAMES:
                    continue
                tx, ty = track["_last_xy"]
                d = math.hypot(bx - tx, by - ty)
                if d < 80:
                    track["last_shot_frame"] = frame_idx
                    actions.append(
                        {
                            "type": "shot",
                            "playerId": str(tid),
                            "frameNumber": frame_idx,
                            "confidence": 0.6,
                        }
                    )

        frame_idx += 1
        if frame_idx % 30 == 0:
            logger.info(f"Processed frame {frame_idx}/{frame_count}")

    cap.release()

    # Close out last possession
    if last_ball_owner is not None and last_owner_since is not None:
        duration_frames = frame_idx - last_owner_since
        if duration_frames > 0:
            possession_events.append(
                {
                    "playerId": str(last_ball_owner),
                    "duration": float(duration_frames / fps),
                    "startFrame": last_owner_since,
                    "endFrame": frame_idx,
                }
            )

    # Merge ByteTrack fragments that are almost certainly the same real
    # player: tracks whose OCR-read jersey number agrees (with enough
    # votes to trust) AND whose dominant shirt color agrees. Football has
    # 22 players + 1 referee on the pitch; raw ByteTrack output routinely
    # produces 40-100+ fragments because a player who is briefly occluded,
    # leaves frame, or is momentarily mis-detected gets a new ID. Tracks
    # with no trusted jersey number are left unmerged (each stays its own
    # "unidentified" entity) since color alone isn't reliable enough to
    # merge on (many teammates share a shirt color).
    id_remap = {}
    groups = defaultdict(list)
    for tid, track in tracks.items():
        votes = track.get("jersey_votes")
        number = track.get("jersey_number")
        if number is None or not votes:
            continue
        top_votes = votes.most_common(1)[0][1] if votes else 0
        if top_votes < MIN_VOTES_TO_TRUST:
            continue
        color = track.get("shirt_color") or "unknown"
        groups[(number, color)].append(tid)

    merged_count = 0
    for (number, color), tids in groups.items():
        if len(tids) < 2:
            continue
        # Canonical id = the track with the most matched frames (most
        # complete data to keep as the base).
        tids_sorted = sorted(tids, key=lambda t: len(tracks[t]["positions"]), reverse=True)
        canonical = tids_sorted[0]
        base = tracks[canonical]
        for other_tid in tids_sorted[1:]:
            other = tracks[other_tid]
            # Interleave by frame number so distance/speed calculations
            # (which assume chronological order) stay valid after merge.
            combined = list(
                zip(base["frames"], base["positions"], base["confidences"], base["poses"])
            ) + list(
                zip(other["frames"], other["positions"], other["confidences"], other["poses"])
            )
            combined.sort(key=lambda x: x[0])
            base["frames"] = [c[0] for c in combined]
            base["positions"] = [c[1] for c in combined]
            base["confidences"] = [c[2] for c in combined]
            base["poses"] = [c[3] for c in combined]
            base["sprint_count"] = base.get("sprint_count", 0) + other.get("sprint_count", 0)
            if other.get("best_crop_score", 0) > base.get("best_crop_score", 0):
                base["best_crop_score"] = other["best_crop_score"]
                base["best_crop"] = other["best_crop"]
            id_remap[other_tid] = canonical
            del tracks[other_tid]
            merged_count += 1
        base["jersey_number"] = number
        base["shirt_color"] = color

    if merged_count:
        logger.info(
            f"Merged {merged_count} fragmented track(s) into "
            f"{len(groups)} jersey-identified player(s) via OCR"
        )
        # Recompute speeds for merged base tracks now that positions/frames
        # were re-sorted chronologically (per-frame speeds were computed
        # incrementally during the loop against the pre-merge sequence).
        for (number, color), tids in groups.items():
            if len(tids) < 2:
                continue
            # Only the canonical (surviving) id from this group remains in
            # tracks; the rest were deleted during the merge above.
            surviving = [t for t in tids if t in tracks]
            if not surviving:
                continue
            base = tracks[surviving[0]]
            positions = base["positions"]
            frames = base["frames"]
            recomputed = []
            for n in range(len(positions)):
                if n >= 1:
                    lookback = min(SPEED_WINDOW, n)
                    p_prev = positions[n - lookback]
                    p_curr = positions[n]
                    frame_gap = frames[n] - frames[n - lookback]
                    dt = frame_gap / fps if frame_gap > 0 else 1.0 / fps
                    dx = (p_curr["x"] - p_prev["x"]) / px_per_meter
                    dy = (p_curr["y"] - p_prev["y"]) / px_per_meter
                    speed = math.hypot(dx, dy) / dt if dt > 0 else 0.0
                else:
                    speed = 0.0
                recomputed.append(speed)
            base["speeds"] = recomputed

        # Apply id_remap to actions and possession events so references
        # to a now-deleted fragment id point at the surviving canonical id.
        for a in actions:
            pid = a.get("playerId")
            if pid is not None and pid.isdigit() and int(pid) in id_remap:
                a["playerId"] = str(id_remap[int(pid)])
        for p in possession_events:
            pid = p.get("playerId")
            if pid is not None and pid.isdigit() and int(pid) in id_remap:
                p["playerId"] = str(id_remap[int(pid)])

    # Build playerData. Tracks matched fewer than MIN_TRACK_FRAMES times are
    # almost always spurious single-frame detections (false positives, or a
    # player that was never re-matched) rather than real players, so drop
    # them to avoid inflating totalPlayers with noise.
    MIN_TRACK_FRAMES = 10
    player_data = []
    for tid, track in tracks.items():
        speeds = track.get("speeds", [])
        positions = track["positions"]
        if len(positions) < MIN_TRACK_FRAMES:
            continue
        # Distance: sum of pixel deltas / px_per_meter
        dist_px = 0.0
        for i in range(1, len(positions)):
            dx = positions[i]["x"] - positions[i - 1]["x"]
            dy = positions[i]["y"] - positions[i - 1]["y"]
            dist_px += math.hypot(dx, dy)
        distance_covered = dist_px / px_per_meter
        avg_speed = float(np.mean(speeds)) if speeds else 0.0
        sprint_count = int(track.get("sprint_count", 0))

        # Activation area: bbox centroid quadrant as a coarse label
        cx_avg = float(np.mean([p["x"] for p in positions]))
        cy_avg = float(np.mean([p["y"] for p in positions]))
        if cx_avg < width / 3:
            h_area = "Left"
        elif cx_avg < 2 * width / 3:
            h_area = "Center"
        else:
            h_area = "Right"
        if cy_avg < height / 3:
            v_area = "Top"
        elif cy_avg < 2 * height / 3:
            v_area = "Midfield"
        else:
            v_area = "Bottom"
        activation_area = f"{v_area}-{h_area}"

        # Tracking data: subsample to <= 50 points to keep Mongo doc small
        track_points = track["frames"]
        step = max(1, len(track_points) // 50)
        tracking_data = []
        for i in range(0, len(track_points), step):
            tracking_data.append(
                {
                    "frameNumber": track["frames"][i],
                    "position": {
                        "x": float(track["positions"][i]["x"]),
                        "y": float(track["positions"][i]["y"]),
                    },
                    "confidence": float(track["confidences"][i]),
                    "pose": track["poses"][i],
                }
            )

        jersey_votes = track.get("jersey_votes")
        jersey_conf = None
        if jersey_votes and track.get("jersey_number") is not None:
            top_votes = jersey_votes.most_common(1)[0][1]
            jersey_conf = round(top_votes / max(1, track.get("ocr_attempts", top_votes)), 2)

        thumbnail_filename = None
        if thumbnail_dir and track.get("best_crop") is not None:
            thumbnail_filename = f"{tid}.jpg"
            try:
                cv2.imwrite(
                    os.path.join(thumbnail_dir, thumbnail_filename), track["best_crop"]
                )
            except Exception as e:
                logger.warning(f"Failed to write thumbnail for track {tid}: {e}")
                thumbnail_filename = None

        player_data.append(
            {
                "trackId": str(tid),
                "jerseyNumber": track.get("jersey_number"),
                "jerseyConfidence": jersey_conf,
                "teamColor": track.get("shirt_color"),
                "thumbnail": thumbnail_filename,
                "trackingData": tracking_data,
                "statistics": {
                    "distanceCovered": round(distance_covered, 2),
                    "averageSpeed": round(avg_speed, 2),
                    "sprintCount": sprint_count,
                    "activationArea": activation_area,
                },
            }
        )

    # Build heatmap grid
    cell_size = 50
    cols = max(1, width // cell_size)
    rows = max(1, height // cell_size)
    grid = [[0] * cols for _ in range(rows)]
    for (gx, gy), count in heatmap_counts.items():
        if 0 <= gx < cols and 0 <= gy < rows:
            grid[gy][gx] += count

    # Highlighted moments: top-N sprint frames and any shot frames
    highlighted = []
    for a in actions:
        highlighted.append(
            {
                "frameNumber": a["frameNumber"],
                "type": a["type"],
                "description": f"{a['type'].capitalize()} detected at frame {a['frameNumber']}",
            }
        )
    # Sort by frame number, dedupe by frame
    seen = set()
    deduped = []
    for h in sorted(highlighted, key=lambda x: x["frameNumber"]):
        if h["frameNumber"] in seen:
            continue
        seen.add(h["frameNumber"])
        deduped.append(h)
    highlighted = deduped[:10]

    return {
        "playerData": player_data,
        "ballData": {
            "trackingData": ball_series[:: max(1, len(ball_series) // 200)],
            "possessionStats": possession_events,
        },
        "actions": actions,
        "heatmapData": {"grid": grid, "cellSize": cell_size},
        "summary": {
            "totalPlayers": len(player_data),
            "matchDuration": round(frame_idx / fps, 2) if fps else 0,
            "highlightedMoments": highlighted,
        },
        "metadata": {
            "fps": float(fps),
            "frameCount": frame_idx,
            "width": width,
            "height": height,
        },
    }


def main():
    parser = argparse.ArgumentParser(description="Run CV analysis on a video")
    parser.add_argument("video", help="Path to input video file")
    parser.add_argument(
        "--output", "-o", help="Path to write JSON output (default: stdout)"
    )
    parser.add_argument(
        "--max-frames",
        type=int,
        default=None,
        help="Cap the number of frames processed (useful for smoke tests)",
    )
    parser.add_argument(
        "--no-jersey-ocr",
        action="store_true",
        help="Disable jersey number OCR / track merging (faster, more fragmented player counts)",
    )
    parser.add_argument(
        "--thumbnail-dir",
        help="Directory to write one representative crop per player track (for manual review UI)",
    )
    parser.add_argument(
        "--sport",
        choices=list(SPORT_PRESETS.keys()),
        default=DEFAULT_SPORT,
        help="Sport preset controlling field-size calibration and ball color detection (default: soccer)",
    )
    args = parser.parse_args()

    started = time.time()
    try:
        result = analyze(
            args.video,
            max_frames=args.max_frames,
            enable_jersey_ocr=not args.no_jersey_ocr,
            thumbnail_dir=args.thumbnail_dir,
            sport=args.sport,
        )
    except Exception as e:
        logger.exception("Analysis failed")
        err = {"error": str(e), "traceback": __import__("traceback").format_exc()}
        if args.output:
            with open(args.output, "w") as f:
                json.dump(err, f)
            sys.exit(1)
        json.dump(err, sys.stdout)
        sys.exit(1)

    elapsed = time.time() - started
    result["_runtimeSeconds"] = round(elapsed, 2)

    if args.output:
        with open(args.output, "w") as f:
            json.dump(result, f)
        logger.info(f"Wrote analysis to {args.output} in {elapsed:.1f}s")
    else:
        json.dump(result, sys.stdout)


if __name__ == "__main__":
    main()
