"""
Persistent analysis worker.

Spawning a fresh `python video_analyzer.py` per analysis request pays a
real, measured cold-start tax every single time: ~1.6-1.9s to import
torch/ultralytics/opencv/easyocr (Python caches imports per-process, not
across processes) plus ~2.8-3s to construct EasyOCR's Reader. For a short
clip that itself only takes a few seconds to actually process, that
cold-start tax was routinely *larger* than the real work.

This worker pays that cost once at startup, then reads newline-delimited
JSON job requests from stdin and writes newline-delimited JSON
progress/result/error messages to stdout, reusing the same EasyOCR reader
across every job (safe: JerseyReader.read_number() is a pure per-crop call
with no cross-video state). A fresh PlayerDetector/BallTracker is still
built per job — cheap once the import cost is already paid, and necessary
since YOLO's tracker keeps cross-frame identity state that must not bleed
between different videos.

Node's analysisWorkerPool.js spawns a small pool of these and dispatches
jobs to whichever is free, giving both effects the "job queue" gap
actually needed: bounded concurrency (only as many YOLO inferences run in
parallel as there are workers) and no repeated cold start per job.
"""

import json
import sys
import traceback

from video_analyzer import analyze, DEFAULT_SPORT


def _emit(message):
    sys.stdout.write(json.dumps(message) + "\n")
    sys.stdout.flush()


def main():
    jersey_reader = None
    try:
        from jersey_reader import JerseyReader

        jersey_reader = JerseyReader()
    except Exception as e:  # pragma: no cover - environment-dependent
        _emit({"type": "workerLog", "message": f"Jersey OCR unavailable: {e}"})

    _emit({"type": "ready"})

    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue
        try:
            job = json.loads(line)
        except json.JSONDecodeError:
            continue

        job_id = job.get("jobId")

        def on_progress(frame, total, _job_id=job_id):
            _emit({"jobId": _job_id, "type": "progress", "frame": frame, "total": total})

        try:
            result = analyze(
                job["videoPath"],
                max_frames=job.get("maxFrames"),
                enable_jersey_ocr=job.get("enableJerseyOcr", True),
                thumbnail_dir=job.get("thumbnailDir"),
                sport=job.get("sport", DEFAULT_SPORT),
                jersey_reader=jersey_reader,
                progress_callback=on_progress,
            )
            _emit({"jobId": job_id, "type": "result", "data": result})
        except Exception as e:
            _emit(
                {
                    "jobId": job_id,
                    "type": "error",
                    "message": str(e),
                    "traceback": traceback.format_exc(),
                }
            )


if __name__ == "__main__":
    main()
