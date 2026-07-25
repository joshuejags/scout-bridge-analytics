"""
Unit tests for the pure-logic helpers behind pose estimation and
tactical/formation analysis in video_analyzer.py: IoU bbox matching,
nearest-frame pose lookup, team shape aggregation, and formation-line
banding. None of these touch the YOLO models themselves (see the manual
smoke-test invocations in the project history for that), just the
deterministic matching/lookup/aggregation logic around them — so plain
unittest (no model load, no pytest dependency) is enough.

Run with: python -m unittest test_analysis_helpers -v
"""

import math
import unittest

from video_analyzer import (
    _bbox_iou,
    _match_pose_to_track,
    _pose_for_frame,
    _team_shape,
    _formation_lines,
)


class BboxIouTests(unittest.TestCase):
    def test_identical_boxes_have_iou_1(self):
        box = (10, 10, 50, 50)
        self.assertAlmostEqual(_bbox_iou(box, box), 1.0)

    def test_disjoint_boxes_have_iou_0(self):
        a = (0, 0, 10, 10)
        b = (100, 100, 110, 110)
        self.assertEqual(_bbox_iou(a, b), 0.0)

    def test_partial_overlap_computes_correct_fraction(self):
        a = (0, 0, 10, 10)  # area 100
        b = (5, 0, 15, 10)  # area 100, overlap is x in [5,10] -> 5*10=50
        # union = 100 + 100 - 50 = 150; iou = 50/150
        self.assertAlmostEqual(_bbox_iou(a, b), 50 / 150)

    def test_touching_edges_have_iou_0(self):
        a = (0, 0, 10, 10)
        b = (10, 0, 20, 10)
        self.assertEqual(_bbox_iou(a, b), 0.0)


class MatchPoseToTrackTests(unittest.TestCase):
    def test_matches_pose_to_overlapping_track(self):
        pose_detections = [{"bbox": (0, 0, 10, 10), "keypoints": {"nose": {"x": 5, "y": 5}}}]
        track_bboxes = {"t1": (0, 0, 10, 10), "t2": (100, 100, 110, 110)}
        matches = _match_pose_to_track(pose_detections, track_bboxes)
        self.assertEqual(set(matches.keys()), {"t1"})
        self.assertEqual(matches["t1"], {"nose": {"x": 5, "y": 5}})

    def test_below_threshold_iou_is_not_matched(self):
        # Barely overlapping boxes, IoU well under the default 0.3 threshold.
        pose_detections = [{"bbox": (0, 0, 10, 10), "keypoints": {}}]
        track_bboxes = {"t1": (9, 9, 30, 30)}
        matches = _match_pose_to_track(pose_detections, track_bboxes)
        self.assertEqual(matches, {})

    def test_greedy_highest_iou_wins_no_double_claim(self):
        # Two pose detections both overlap track t1, but det_a overlaps it
        # more; det_b should fall through to t2 rather than being dropped
        # or t1 being claimed twice.
        det_a = {"bbox": (0, 0, 10, 10), "keypoints": {"id": "a"}}
        det_b = {"bbox": (1, 1, 9, 9), "keypoints": {"id": "b"}}
        track_bboxes = {"t1": (0, 0, 10, 10), "t2": (1, 1, 9, 9)}
        matches = _match_pose_to_track([det_a, det_b], track_bboxes)
        self.assertEqual(matches["t1"], {"id": "a"})
        self.assertEqual(matches["t2"], {"id": "b"})

    def test_no_tracks_or_no_detections_yields_empty(self):
        self.assertEqual(_match_pose_to_track([], {"t1": (0, 0, 10, 10)}), {})
        self.assertEqual(_match_pose_to_track([{"bbox": (0, 0, 10, 10), "keypoints": {}}], {}), {})


class PoseForFrameTests(unittest.TestCase):
    def test_empty_samples_returns_empty_dict(self):
        self.assertEqual(_pose_for_frame([], 10), {})

    def test_exact_frame_match_returned_directly(self):
        samples = [(5, {"a": 1}), (10, {"b": 2}), (15, {"c": 3})]
        self.assertEqual(_pose_for_frame(samples, 10), {"b": 2})

    def test_nearest_sample_picked_when_no_exact_match(self):
        samples = [(0, {"a": 1}), (10, {"b": 2})]
        # frame 8 is closer to 10 than to 0
        self.assertEqual(_pose_for_frame(samples, 8), {"b": 2})
        # frame 2 is closer to 0 than to 10
        self.assertEqual(_pose_for_frame(samples, 2), {"a": 1})

    def test_gap_beyond_max_returns_empty_dict(self):
        samples = [(0, {"a": 1})]
        self.assertEqual(_pose_for_frame(samples, 100, max_gap=5), {})

    def test_gap_within_max_is_returned(self):
        samples = [(0, {"a": 1})]
        self.assertEqual(_pose_for_frame(samples, 5, max_gap=5), {"a": 1})


def _track(*, frame_position_pairs):
    """Build a minimal synthetic track dict (frames/positions only — the
    two fields _team_shape/_formation_lines actually read)."""
    return {
        "frames": [f for f, _ in frame_position_pairs],
        "positions": [{"x": x, "y": y} for _, (x, y) in frame_position_pairs],
    }


class TeamShapeTests(unittest.TestCase):
    def test_computes_width_depth_compactness_for_a_square(self):
        # Four players at the corners of a 10x10 square, all visible on
        # the same frame. Centroid is (5, 5); every corner is sqrt(50)
        # from it, so compactness has one exact expected value.
        tracks = {
            1: _track(frame_position_pairs=[(0, (0, 0))]),
            2: _track(frame_position_pairs=[(0, (10, 0))]),
            3: _track(frame_position_pairs=[(0, (10, 10))]),
            4: _track(frame_position_pairs=[(0, (0, 10))]),
        }
        result = _team_shape(tracks, [1, 2, 3, 4], px_per_meter=1.0)
        self.assertEqual(result["width"], 10.0)
        self.assertEqual(result["depth"], 10.0)
        self.assertAlmostEqual(result["compactness"], round(math.sqrt(50), 2))
        self.assertEqual(result["sampledFrames"], 1)

    def test_px_per_meter_scales_all_three_metrics(self):
        tracks = {
            1: _track(frame_position_pairs=[(0, (0, 0))]),
            2: _track(frame_position_pairs=[(0, (10, 0))]),
            3: _track(frame_position_pairs=[(0, (10, 10))]),
            4: _track(frame_position_pairs=[(0, (0, 10))]),
        }
        result = _team_shape(tracks, [1, 2, 3, 4], px_per_meter=2.0)
        self.assertEqual(result["width"], 5.0)
        self.assertEqual(result["depth"], 5.0)
        self.assertAlmostEqual(result["compactness"], round(math.sqrt(50) / 2, 2))

    def test_frame_with_too_few_visible_players_is_excluded(self):
        # Only 2 of the "team" are visible on frame 0 (MIN_PLAYERS_FOR_SHAPE
        # is 3), so there's no frame to average over at all.
        tracks = {
            1: _track(frame_position_pairs=[(0, (0, 0))]),
            2: _track(frame_position_pairs=[(0, (10, 0))]),
        }
        result = _team_shape(tracks, [1, 2], px_per_meter=1.0)
        self.assertIsNone(result)

    def test_averages_across_multiple_qualifying_frames(self):
        # Same square shape repeated on two frames should average to the
        # same per-frame values, with sampledFrames reflecting both.
        tracks = {
            1: _track(frame_position_pairs=[(0, (0, 0)), (1, (0, 0))]),
            2: _track(frame_position_pairs=[(0, (10, 0)), (1, (10, 0))]),
            3: _track(frame_position_pairs=[(0, (10, 10)), (1, (10, 10))]),
        }
        result = _team_shape(tracks, [1, 2, 3], px_per_meter=1.0)
        self.assertEqual(result["sampledFrames"], 2)
        self.assertEqual(result["width"], 10.0)


class FormationLinesTests(unittest.TestCase):
    def test_two_clearly_separated_bands_form_two_lines(self):
        # Four players clustered near y=0-3, four near y=50-53 — a gap of
        # 47 vs. the 4.0m threshold is unambiguous.
        ys = [0, 1, 2, 3, 50, 51, 52, 53]
        tracks = {i: _track(frame_position_pairs=[(0, (0, y))]) for i, y in enumerate(ys)}
        result = _formation_lines(tracks, list(tracks.keys()), px_per_meter=1.0)
        self.assertEqual(result["lineCount"], 2)
        self.assertEqual(result["lineup"], [4, 4])

    def test_all_players_within_threshold_form_one_line(self):
        ys = [0, 1, 2, 3]
        tracks = {i: _track(frame_position_pairs=[(0, (0, y))]) for i, y in enumerate(ys)}
        result = _formation_lines(tracks, list(tracks.keys()), px_per_meter=1.0)
        self.assertEqual(result["lineCount"], 1)
        self.assertEqual(result["lineup"], [4])

    def test_gap_threshold_scales_with_px_per_meter(self):
        # Same 47px gap as the two-band test, but a much larger
        # px_per_meter shrinks 4.0m to well under 47px, so it should no
        # longer separate the bands.
        ys = [0, 1, 2, 3, 50, 51, 52, 53]
        tracks = {i: _track(frame_position_pairs=[(0, (0, y))]) for i, y in enumerate(ys)}
        result = _formation_lines(tracks, list(tracks.keys()), px_per_meter=20.0)
        self.assertEqual(result["lineCount"], 1)

    def test_no_positional_data_returns_none(self):
        tracks = {1: {"frames": [], "positions": []}}
        result = _formation_lines(tracks, [1], px_per_meter=1.0)
        self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main()
