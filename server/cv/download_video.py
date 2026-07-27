"""
One-shot CLI wrapper around yt-dlp, invoked as a subprocess from
server/utils/videoUrlImport.js to pull a video down from a URL (YouTube,
Instagram, TikTok, Facebook, X/Twitter, Vimeo, and other yt-dlp-supported
platforms) instead of requiring a local file upload.

`allowed_extractors` is set to `['default']` rather than left unset. Left
unset, yt-dlp falls back to its GenericIE for any URL that doesn't match a
named site extractor, which fetches whatever the URL points at directly.
That fallback is what makes an "analyze this URL" endpoint dangerous: a
caller could hand it an internal or private-network address and have the
server fetch it. Restricting to the default set of named extractors means
only actual, vetted platform integrations run, and an unrecognized URL
fails with "no extractor found" instead of being fetched blindly.

Prints its result as a single line prefixed with RESULT_MARKER, e.g.
`RESULT_JSON:{"ok": true, ...}` on success or `RESULT_JSON:{"ok": false,
"error": "..."}` on failure (also a non-zero exit code). A marker prefix is
used, rather than treating the last line of stdout as the result, because
yt-dlp's progress meter writes to stdout too - "quiet"/"no_warnings" only
suppress its log messages, not the `\r`-updated progress line, which
otherwise lands on the same unterminated line as the JSON that follows it.

Note: `allowed_extractors=['default']` is NOT enough on its own to exclude
GenericIE (verified against yt-dlp's own source - GenericIE's `_ENABLED`
flag, which is what 'default' filters on, defaults to True same as every
other extractor). Excluding it requires naming the platforms actually
supported instead, which is what ALLOWED_EXTRACTOR_PATTERNS below does.
"""

import json
import os
import sys

from yt_dlp import YoutubeDL

MAX_DURATION_SECONDS = int(os.environ.get("URL_IMPORT_MAX_DURATION_SECONDS", 3600))
MAX_FILE_SIZE_BYTES = int(os.environ.get("MAX_FILE_SIZE", 500_000_000))
RESULT_MARKER = "RESULT_JSON:"

# Matched case-insensitively, full-string, against every extractor's IE_NAME
# (see yt-dlp's YoutubeDL.add_default_info_extractors) - e.g. 'youtube'
# matches the 'Youtube' extractor, 'youtube:tab' (channel/playlist listing),
# etc. Deliberately excludes 'generic': without a name match here, an
# unrecognized URL fails with "no suitable extractor found" instead of
# GenericIE fetching whatever the URL points at directly, which is what
# would make this endpoint an open fetch-any-URL proxy.
ALLOWED_EXTRACTOR_PATTERNS = [
    ".*youtube.*",
    ".*twitter.*",
    ".*instagram.*",
    ".*tiktok.*",
    ".*facebook.*",
    ".*vimeo.*",
    ".*dailymotion.*",
    ".*twitch.*",
]


def _match_filter(info, *, incomplete=False):
    duration = info.get("duration")
    if duration and duration > MAX_DURATION_SECONDS:
        return f"video is {int(duration)}s long, over the {MAX_DURATION_SECONDS}s limit"

    size = info.get("filesize") or info.get("filesize_approx")
    if size and size > MAX_FILE_SIZE_BYTES:
        return f"video is {size} bytes, over the {MAX_FILE_SIZE_BYTES} byte limit"

    return None


def download(url, output_template):
    ydl_opts = {
        "outtmpl": output_template,
        "format": "best[ext=mp4][height<=1080]/best[height<=1080]/best",
        "allowed_extractors": ALLOWED_EXTRACTOR_PATTERNS,
        "match_filter": _match_filter,
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "restrictfilenames": True,
        "max_filesize": MAX_FILE_SIZE_BYTES,
    }

    with YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        file_path = ydl.prepare_filename(info)

    return {
        "filePath": file_path,
        "title": info.get("title") or url,
        "duration": info.get("duration"),
        "width": info.get("width"),
        "height": info.get("height"),
        "extractor": info.get("extractor"),
    }


def main():
    if len(sys.argv) != 3:
        print(RESULT_MARKER + json.dumps({"ok": False, "error": "usage: download_video.py <url> <output_template>"}))
        sys.exit(1)

    url, output_template = sys.argv[1], sys.argv[2]
    try:
        result = download(url, output_template)
        print(RESULT_MARKER + json.dumps({"ok": True, **result}))
    except Exception as exc:  # yt-dlp raises its own DownloadError plus assorted others
        print(RESULT_MARKER + json.dumps({"ok": False, "error": str(exc)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
