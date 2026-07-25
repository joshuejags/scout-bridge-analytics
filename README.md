# Scout Bridge Analytics

[![CI](https://github.com/joshuejags/scout-bridge-analytics/actions/workflows/ci.yml/badge.svg)](https://github.com/joshuejags/scout-bridge-analytics/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](#license)

**Turn match footage into scouting data.**

Upload a match video and get automatic player tracking, jersey identification, ball tracking, heatmaps, and performance statistics — with a human-in-the-loop verification step for the identities computer vision can't resolve on its own. Built for coaches, scouts, and analysts at clubs that don't have access to broadcast-grade tracking systems and don't want to tag footage by hand.

## Screenshot

> _Add a screenshot or demo video/GIF of the Analysis report page here before launch._

## Features

- 📹 **Video Upload** — MP4, AVI, MOV, MKV, FLV, with a chunked-upload mode for large files that resumes after a dropped connection
- 🏅 **Multi-Sport** — soccer, basketball, hockey, and rugby presets calibrate distance/speed accuracy and ball detection to each sport's real-world field size and ball color
- 👥 **Player Tracking** — detection and multi-object tracking via YOLOv8 + TrackTrack (appearance ReID)
- 🕺 **Pose Estimation** — YOLOv8-pose keypoints per tracked player, sampled and matched back to existing tracks
- ⚽ **Ball Tracking** — color-based detection with possession analysis
- 🔢 **Jersey OCR** — automatic jersey-number reading and shirt-color classification, with a manual verification UI to fill the gaps OCR can't reach
- 🧭 **Tactical Shape** — heuristic team width/depth/compactness and formation-line grouping from tracked positions
- 🏷️ **Teams & Players** — roster management: teams, player profiles, positions, jersey numbers
- 🔐 **Accounts** — JWT auth with role-based access (admin/scout), email verification, and password reset
- 📊 **Performance Analytics** — distance covered, speed, sprint counts, per-player heatmaps
- ⚖️ **Player Comparison** — side-by-side cross-match stat comparison for two or more players
- 🎯 **Action Detection** — shots, passes, tackles, and interceptions, inferred from ball-possession transfers
- ⚡ **Live Progress** — analysis progress streams over WebSocket instead of polling
- ☁️ **Pluggable Storage** — local disk by default, or S3 / any S3-compatible provider (MinIO, Cloudflare R2, DigitalOcean Spaces)

## Tech Stack

**Backend** — Express.js (Node), MongoDB/Mongoose, Multer, Socket.IO, JWT auth

**Frontend** — React 18, React Router v6, Axios, Chart.js

**Computer vision** — YOLOv8n (Ultralytics) for detection, TrackTrack (appearance ReID) for tracking, YOLOv8n-pose for keypoints, EasyOCR for jersey numbers. Runs CPU-only by design (no CUDA device is requested anywhere in the pipeline) — see [Getting Started](#getting-started) for the CPU-only PyTorch install.

**Storage** — local disk by default; AWS S3 or any S3-compatible object store as a drop-in alternative

## Getting Started

### Prerequisites

- Node.js 20 (matches the Docker images and CI)
- MongoDB 6.0+, local or [Atlas](https://www.mongodb.com/cloud/atlas)
- Python 3.13 for the CV pipeline (developed and CI-tested on 3.13; 3.8+ should work but is unverified)

### Installation

```bash
git clone https://github.com/joshuejags/scout-bridge-analytics.git
cd scout-bridge-analytics
npm install
npm install --prefix server
npm install --prefix client
```

Set up the Python CV environment. `easyocr` is installed as a **separate, second step with `--no-deps`** — its own dependency list pulls in `opencv-python-headless`, which shares files with `opencv-python` (already installed via `requirements.txt`) and corrupts the `cv2` install if both land together:

```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Optional but recommended: this project never requests a CUDA device, and
# pip's default resolver otherwise pulls torch's multi-GB CUDA build.
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

pip install -r server/requirements.txt
pip install --no-deps -r server/requirements-easyocr.txt
```

Configure environment variables:

```bash
cp .env.example .env
# edit .env — see Environment Variables below
```

Start MongoDB (skip if using Atlas or already running):

```bash
mongod
```

Run both apps in development mode:

```bash
npm run dev
# server: http://localhost:5000
# client: http://localhost:3000
```

Or individually: `npm run server` / `npm run client`. `npm run build` produces a production client build.

### Seeding Demo Data (optional)

```bash
cd server
node scripts/seedDemoData.js
```

Seeds a real match from [Metrica Sports' public sample tracking dataset](https://github.com/metrica-sports/sample-data) into MongoDB under a dedicated `demo@scoutbridge.local` account, and writes `client/src/data/sampleAnalysis.json`, which the signed-out landing page renders as a sample report. Safe to re-run — it clears its own previously-seeded records first.

## Environment Variables

Copy `.env.example` to `.env` and fill in the values below. Nothing here has a working default except where noted.

**Database & server**
```env
MONGODB_URI=mongodb://localhost:27017/scout-bridge-analytics
PORT=5000
NODE_ENV=development
JWT_SECRET=              # generate: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

**File upload**
```env
MAX_FILE_SIZE=500000000  # bytes (500MB)
UPLOAD_DIR=./uploads
```

**Storage backend** — `local` (default) needs nothing else below. Set `STORAGE_BACKEND=s3` to store videos on AWS S3 or a compatible provider instead:
```env
STORAGE_BACKEND=local
S3_BUCKET=
S3_REGION=us-east-1
S3_ENDPOINT=             # only for a non-AWS provider: MinIO, R2, Spaces
S3_ACCESS_KEY_ID=        # leave unset to use the AWS SDK's normal credential chain
S3_SECRET_ACCESS_KEY=
```

**Analysis pipeline**
```env
ANALYSIS_WORKER_POOL_SIZE=2   # concurrent analysis workers
ANALYZER_MAX_FRAMES=          # optional cap, useful for smoke tests
```

**Frontend**
```env
REACT_APP_API_URL=http://localhost:5000/api
CLIENT_URL=http://localhost:3000   # used to build password-reset/verify-email links
```

**Email** (password reset + verification) — see [Email](#email) below:
```env
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=Scout Bridge Analytics <no-reply@yourdomain.com>
```

**Error tracking** — see [Error Tracking & Monitoring](#error-tracking--monitoring) below:
```env
SENTRY_DSN=
REACT_APP_SENTRY_DSN=
```

**Backups** — see [Backups](#backups) below; only used by the scheduled GitHub Action, not the app itself:
```env
BACKUP_S3_BUCKET=
BACKUP_RETENTION_DAYS=30
```

## Usage

Register the first account (it's auto-promoted to `admin`), upload a video, and trigger analysis:

```bash
# 1. Register — first account on a fresh install becomes admin
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane Scout","email":"jane@example.com","password":"password123"}'
# → { "token": "...", "user": { ... } }

# 2. Upload a video
curl -X POST http://localhost:5000/api/videos/upload \
  -H "Authorization: Bearer <token>" \
  -F "video=@match.mp4" -F "sport=soccer"
# → { "_id": "<videoId>", "status": "uploaded", ... }

# 3. Queue analysis (returns immediately; runs in the background)
curl -X POST http://localhost:5000/api/analysis/<videoId>/process \
  -H "Authorization: Bearer <token>"

# 4. Fetch the result once status is "analyzed" (poll, or listen for the
#    analysis:complete Socket.IO event instead of polling)
curl http://localhost:5000/api/analysis/<videoId> -H "Authorization: Bearer <token>"
```

From there, the Analysis report page lets you review/verify player tracks, compare players across matches, and view heatmaps and tactical shape.

### API Reference

All routes except `/api/auth/register`, `/api/auth/login`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/verify-email`, and `/api/health` require `Authorization: Bearer <token>`. Routes marked **(admin)** additionally require `role: admin`.

**Auth**
- `POST /api/auth/register` — `{ name, email, password }` (password ≥ 8 chars) → `{ token, user }`
- `POST /api/auth/login` — `{ email, password }` → `{ token, user }`
- `GET /api/auth/me` — current authenticated user
- `GET /api/auth/users` **(admin)** — list all accounts
- `PATCH /api/auth/users/:id/role` **(admin)** — `{ role: 'admin' | 'scout' }`
- `POST /api/auth/verify-email` — `{ token }` (single-use, 24h expiry)
- `POST /api/auth/resend-verification` — requires auth
- `POST /api/auth/forgot-password` — `{ email }` → always `200` (no account-enumeration leak); rate-limited to 5/15min per IP+email
- `POST /api/auth/reset-password` — `{ token, password }` (single-use, 1h expiry)

**Videos**
- `GET /api/videos` / `GET /api/videos/:id`
- `POST /api/videos/upload` — single-request upload; accepts `sport` (`soccer` | `basketball` | `hockey` | `rugby`, default `soccer`)
- `POST /api/videos/upload/init` → `POST /api/videos/upload/:uploadId/chunk` → `POST /api/videos/upload/:uploadId/complete` — chunked upload for large files; `GET /api/videos/upload/:uploadId/status` supports resuming
- `DELETE /api/videos/:id` **(admin)** — also deletes the video's `Analysis` document and thumbnail directory, not just the video file/record

**Analysis**
- `GET /api/analysis/:videoId`
- `POST /api/analysis/:videoId/process` — queues analysis (`202`); progress streams over Socket.IO (`analysis:queued`/`started`/`progress`/`complete`/`failed`)
- `PATCH /api/analysis/:analysisId/tracks/:trackId` — manually set a track's jersey number / roster player / team color
- `POST /api/analysis/:analysisId/tracks/merge` — merge two tracks that are the same real player

**Teams** — `GET/POST /api/teams`, `GET/PUT /api/teams/:id`, `DELETE /api/teams/:id` **(admin)**

**Players** — `GET/POST /api/players`, `GET/PUT /api/players/:id`, `DELETE /api/players/:id` **(admin)**, `GET /api/players/compare?ids=id1,id2,...`

**Media** — `GET /uploads/*` — serves video files and verification thumbnails; requires the same Bearer token as the API, scoped to the requesting user's own videos (admins see all)

## How It Works

`POST /api/analysis/:videoId/process` queues a job on a persistent worker pool (`server/cv/worker.py` / `server/utils/analysisWorkerPool.js`), which keeps EasyOCR and the pose model warm across jobs instead of paying model-load cost per request. Video status moves `uploaded → queued → processing → analyzed` (or `failed`).

The queue itself is in-memory and capped at `ANALYSIS_QUEUE_MAX` (default 20) pending jobs — a server restart while a job was queued or running loses it, since there's nothing left to resume it. `analysisController.reconcileOrphanedJobs()` runs once at every server startup and marks any video still showing `queued`/`processing` from a previous run as `failed` (with `Video.lastError` explaining why), so it isn't stuck forever with a disabled Process button — it surfaces as a normal failure the user can retry, the same as any other failed analysis.

- **Detection & tracking** — YOLOv8n detects people per frame; TrackTrack (appearance ReID) links detections into per-player tracks. A single-camera match still commonly fragments into 40–70+ raw tracks (occlusion/re-entry produces new IDs) — this is a real limitation of motion-only tracking, addressed by the manual verification step below, not eliminated. If a result comes back with too few player tracks to be meaningful (poor footage, empty frame, wrong sport), `summary.qualityFlag` is set to `"no_detections"` and the report page shows a clear message instead of a silently empty table.
- **Jersey OCR & team color** — EasyOCR reads jersey numbers from torso crops when a player's back faces the camera; each track is also classified into a coarse shirt-color bucket. Tracks that agree on both a trusted number and color are merged automatically.
- **Manual verification** — every surviving track gets a thumbnail crop; the Analysis page's "Verify Players" panel lets a human assign a jersey number, link a roster player, or merge two tracks — closing the gap automatic OCR/tracking can't close on real footage.
- **Ball tracking** — color-based (HSV, per-sport range) detection; possession approximated by nearest tracked player.
- **Pose estimation** — YOLOv8n-pose runs as a second, throttled model pass, matched back to existing track IDs by bounding-box IoU rather than tracked independently.
- **Tactical shape** — pure arithmetic on already-tracked positions, grouped by the two largest shirt-color buckets: per-frame team width/depth/compactness, and a gap-based line-banding heuristic. Not a verified formation classifier — there's no attack-direction signal, so lines are reported top-to-bottom of frame rather than defense-to-attack.
- **Performance metrics** — distance (pixel movement converted via a per-sport pixels-per-meter figure derived from real-world field length, not camera-calibrated — directionally correct, not survey-precise), average speed, sprint counts, heatmap grid, and action detection (shot/pass/tackle/interception, inferred from ball-possession transfers).
- **Multi-sport** — soccer's calibration is the original, footage-tuned default; basketball/hockey/rugby presets are reasonable starting points not yet verified against real footage for those sports.

## Project Structure

```
scout-bridge-analytics/
├── server/                    # Express backend
│   ├── models/                 # Mongoose schemas
│   ├── controllers/            # Route controllers
│   ├── routes/                 # API routes
│   ├── middleware/             # Auth, validation, upload access
│   ├── utils/                  # Storage, email, sockets, worker pool
│   ├── cv/                     # Python CV pipeline (detection, tracking, OCR, pose, analysis)
│   ├── scripts/                # One-off scripts (demo data seeding)
│   ├── tests/                  # Jest + Supertest
│   └── server.js               # Entry point
├── client/                    # React frontend
│   ├── src/
│   │   ├── components/         # Reusable components
│   │   ├── pages/               # Route-level pages
│   │   ├── context/             # AuthContext
│   │   └── utils/                # Axios client, hooks
│   └── package.json
├── .github/workflows/ci.yml   # Tests + build on every push/PR
├── docker-compose.yml         # Local dev: Mongo + server + client
├── .env.example
└── README.md
```

## Testing

```bash
# Backend — Jest + Supertest, 115 tests
npm test --prefix server

# Frontend — React Testing Library, 75 tests
npm test --prefix client -- --watchAll=false

# Python CV pipeline — unittest, 21 tests (pure logic: IoU matching,
# nearest-frame pose lookup, team shape/formation math — no model load).
# Run with the project's venv active (see Getting Started).
cd server/cv && python -m unittest test_analysis_helpers -v
```

Backend tests run against a disposable `scout-bridge-analytics-test` database (dropped after each run) via `server/app.js` directly — no separately running server needed, just a reachable `mongod`. Frontend tests mock `axios`/`useAuth` and run standalone. CI (`.github/workflows/ci.yml`) runs all three on every push/PR, plus a production client build.

## Deployment

### Docker (local / self-hosted)

```bash
docker compose up --build
```

Brings up MongoDB, the Express server, and the CRA dev server. The server image bundles the full Python CV stack (ultralytics/torch/opencv/easyocr) alongside Node — expect a large first build (torch alone is 500+ MB). Set a real `JWT_SECRET` via a `.env` file in the project root before using this for anything beyond throwaway local testing; `docker-compose.yml`'s fallback placeholder only exists so `up` doesn't hard-crash with no config.

### Railway

Two services (server, client) pointing at this repo with different **Root Directory** values, plus a MongoDB database. `server/railway.json` / `client/railway.json` are already committed, so Railway picks up build config automatically once each service's root directory is set.

1. **Database** — add Railway's MongoDB plugin, or point at an external MongoDB Atlas cluster.
2. **Server** — Root Directory `server`. Railway detects `server/Dockerfile` (health check: `/api/health`). Add a **Volume** at `/app/uploads` so uploads survive a redeploy (or use `STORAGE_BACKEND=s3` instead — see Environment Variables). Set `NODE_ENV`, `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL`, and `ANALYSIS_WORKER_POOL_SIZE=1` (smaller Railway plans don't have headroom for 2+ concurrent torch/YOLO/EasyOCR workers).
3. **Client** — Root Directory `client`. Railway detects `client/railway.json`, which builds via `client/Dockerfile.railway` (production static build + `serve`, distinct from the dev-only `client/Dockerfile`). Set `REACT_APP_API_URL` as a **build variable** (CRA bakes it into the bundle at build time — deploy the server first to get its URL).
4. Once the client has a public URL, set the server's `CLIENT_URL` to it and redeploy the server.

## Troubleshooting

**MongoDB connection refused** — confirm `mongod` is running and `MONGODB_URI` in `.env` is correct, or switch to Atlas.

**YOLO model download** — models auto-download on first use; to pre-fetch: `python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"`.

**`npm ci` fails in the Docker image with "Missing: X from lock file"** — if your local npm major version differs from the image's (npm 10 in `node:20-bookworm-slim` as of writing), a locally-generated `package-lock.json` can be rejected by the image's older npm as incomplete. Compare `npm --version` locally vs. `docker run --rm node:20-bookworm-slim npm --version`; if they differ, regenerate the lockfile with the image's npm:
```bash
docker run --rm -v "$(pwd)/client:/app" -w /app node:20-bookworm-slim npm install
```
(swap `client` for `server` as needed), then use `npm ci` for further local installs against that lockfile.

**Port already in use** — change `PORT` in `.env`, or kill the process holding it (`lsof -ti:5000 | xargs kill -9` on macOS/Linux, `netstat -ano | findstr :5000` on Windows).

## Email

Password reset and email verification send through `server/utils/email.js`. With `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` set, it sends via that SMTP server (any provider — SES, SendGrid, Postmark, a self-hosted relay). With them unset, the email is logged to the server console instead of sent, so the flow stays fully testable without real email infrastructure. Configure real `SMTP_*` values before relying on this for real users.

## Error Tracking & Monitoring

Unexpected errors (the Express global error handler, unhandled promise rejections, and React `ErrorBoundary` crashes) report to [Sentry](https://sentry.io) via `server/utils/errorTracking.js` and `client/src/utils/errorTracking.js`, gated behind `SENTRY_DSN` / `REACT_APP_SENTRY_DSN` — same "safe no-op when unconfigured" pattern as Email above: nothing breaks with no DSN set, real reporting only once one is. Client-input errors (validation failures, bad uploads) are not reported — only genuine unexpected failures.

There is no uptime monitor wired up — `GET /api/health` exists for one to poll (Railway's own healthcheck already uses it), but pointing an external service (UptimeRobot, Better Uptime, Pingdom, etc.) at it needs to be set up separately; nothing in this repo does that on its own.

## Backups

`server/scripts/backupDatabase.js` runs `mongodump`, streams the gzipped archive straight into S3 (or a compatible provider), and prunes anything older than `BACKUP_RETENTION_DAYS` (default 30). `.github/workflows/backup.yml` runs it daily via a scheduled GitHub Action — it installs MongoDB's Database Tools on the runner itself, so no host setup is needed beyond configuring these **repo secrets**:

```
MONGODB_URI            # the real production connection string
BACKUP_S3_BUCKET        # destination bucket — deliberately separate from
                        # S3_BUCKET (video storage): a backup living in the
                        # same bucket as the data it's backing up is a
                        # weaker guarantee than one that doesn't
S3_REGION
S3_ACCESS_KEY_ID        # omit both to use the AWS SDK's normal credential
S3_SECRET_ACCESS_KEY    # chain (an IAM role) instead of static keys
S3_ENDPOINT             # only for a non-AWS provider (MinIO, R2, Spaces)
```

Without these, scheduled runs fail fast with a clear "not configured" error rather than silently doing nothing. Can also be triggered manually from the Actions tab (`workflow_dispatch`) to test the setup, or run locally with `mongodump` installed and the same variables in `.env`: `node scripts/backupDatabase.js`.

**Restoring** is the inverse, not currently scripted (deliberately — a restore is a rare, high-stakes, human-supervised operation, not something to automate the same way as a routine backup): download the archive from S3, then `mongorestore --uri="$MONGODB_URI" --archive=<file> --gzip`.

## Development Notes

- **Backend** — routes in `server/routes/`, controllers in `server/controllers/`, schemas in `server/models/`; validation lives in shared `middleware/validate.js` via `express-validator`.
- **Frontend** — components in `client/src/components/`, pages in `client/src/pages/`, API calls via the shared Axios client in `client/src/utils/`.
- **CV pipeline** — standalone modules in `server/cv/` (`player_detector.py`, `ball_tracker.py`, `jersey_reader.py`, `pose_estimator.py`), orchestrated by `video_analyzer.py`. Add logging via the existing `logging` setup rather than bare `print`.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for any behavior change and run the full suite (see [Testing](#testing))
4. Open a pull request

## License

MIT License — see [LICENSE](LICENSE) for the full text.

## Acknowledgments

- [YOLO](https://github.com/ultralytics/ultralytics) & TrackTrack by Ultralytics
- [EasyOCR](https://github.com/JaidedAI/EasyOCR) by JaidedAI
- Sample match data from [Metrica Sports](https://github.com/metrica-sports/sample-data)
