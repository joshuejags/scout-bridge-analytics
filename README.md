# Scout Bridge Analytics

[![CI](https://github.com/joshuejags/scout-bridge-analytics/actions/workflows/ci.yml/badge.svg)](https://github.com/joshuejags/scout-bridge-analytics/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Turn match footage into scouting data.**

Scout Bridge Analytics is a sports video analysis and scouting platform for coaches, scouts, and analysts. Users upload match footage or import a video URL, run computer-vision analysis, verify uncertain player identities, and review player, team, and recruitment insights.

## What it does

- Ingests match videos through regular or resumable chunked upload, and imports supported social/video URLs through yt-dlp.
- Runs sport-aware player detection and tracking, pose estimation, ball tracking, jersey OCR, and tactical shape analysis using the Python CV pipeline.
- Provides a human review flow for correcting player identity and jersey-number results.
- Presents player statistics, heatmaps, comparisons, detected actions, match reports, and recruitment insights.
- Supports teams, player profiles, scouting targets/watchlists, saved reports, reusable filter presets, and role-specific admin, scout, team, and player workspaces.
- Invalidates previously issued JWT sessions after a successful password reset.
- Streams import and analysis progress through Socket.IO.
- Stores media on local disk by default, with S3-compatible storage support.

## Technology

- **Web client:** React 18, React Router, Axios, Chart.js
- **API:** Node.js, Express, MongoDB/Mongoose, Socket.IO, JWT
- **Analysis:** Python, Ultralytics YOLO, TrackTrack, EasyOCR, OpenCV, yt-dlp
- **Background processing:** BullMQ and Redis; the analysis daemon coordinates video records and queued analysis work
- **Operations:** Docker, GitHub Actions, optional Sentry, Resend/SMTP email, optional S3-compatible object storage

The CV pipeline is configured for CPU execution. See [Getting started](#getting-started) for the CPU-only PyTorch installation sequence.

## Project structure

```text
.
├── .github/workflows/       # CI and scheduled database backup workflows
├── client/
│   ├── public/              # Static client assets
│   └── src/
│       ├── components/      # Shared UI and workspace shell
│       ├── config/          # Client configuration and navigation
│       ├── context/         # Auth and upload state
│       ├── hooks/           # Shared React hooks
│       ├── pages/           # Product pages and role portals
│       ├── utils/           # API client and client helpers
│       └── __tests__/       # Client tests
├── server/
│   ├── controllers/         # Request handlers by product domain
│   ├── cv/                  # Python analysis pipeline and worker
│   ├── docs/                # Operational, migration, and compliance notes
│   ├── middleware/          # Authentication, validation, and request middleware
│   ├── models/              # Mongoose data models
│   ├── routes/              # Express API routes
│   ├── scripts/             # Daemon, backup, seed, migration, and maintenance tools
│   ├── services/            # Export, monitoring, notifications, audit, billing
│   ├── tests/               # Server tests
│   └── utils/               # Queue, storage, sockets, validation, and shared services
├── API_REFERENCE.md         # Expanded endpoint reference
├── AWS_FREE_PLAN_DEPLOYMENT.md # AWS EC2 and Cloudflare Tunnel deployment
├── MONGODB_UPGRADE_RUNBOOK.md # Staged MongoDB 6.0 to 8.0 upgrade procedure
├── DEPLOYMENT_GUIDE.md      # General deployment guidance
├── ENV_CONFIGURATION.md    # Environment configuration reference
├── compose.aws.yml          # Production app, worker, MongoDB, Redis, and tunnel
├── docker-compose.yml       # Multi-service local/container setup
├── Dockerfile               # Root image with API, CV pipeline, and client build
├── .env.aws.example         # AWS deployment variables (no secrets)
├── .env.tunnel.example      # Cloudflare Tunnel variable (no token)
└── README.md
```

Key entry points:

- [client/src/App.jsx](client/src/App.jsx) defines client routing and authenticated workspace surfaces.
- [server/app.js](server/app.js) configures Express middleware and routes; [server/server.js](server/server.js) starts the API and its runtime dependencies.
- [server/scripts/analysisDaemon.js](server/scripts/analysisDaemon.js) coordinates queued video analysis.
- [server/utils/bullmqQueue.js](server/utils/bullmqQueue.js) configures analysis processing, retries, and the dead-letter queue.
- [server/cv/](server/cv/) contains the Python analysis implementation.
- [server/scripts/dedupeAnalyses.js](server/scripts/dedupeAnalyses.js) audits and optionally removes duplicate analysis records before the unique index is enforced.

## Getting started

### Requirements

- Node.js 20 (the version used by the project containers and CI)
- MongoDB 6+
- Redis for BullMQ-backed analysis
- Python 3.13 for the computer-vision pipeline
- FFmpeg and the tools required by the configured CV dependencies

### Install

```bash
git clone https://github.com/joshuejags/scout-bridge-analytics.git
cd scout-bridge-analytics
npm install
npm install --prefix server
npm install --prefix client
```

Create a virtual environment and install the CV dependencies. Installing EasyOCR separately with `--no-deps` avoids installing a second OpenCV distribution over the one from the main requirements file.

```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\\Scripts\\activate
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
pip install -r server/requirements.txt
pip install --no-deps -r server/requirements-easyocr.txt
```

Copy `.env.example` to `.env`, configure the services below, then start MongoDB and Redis. Run the API and client together:

```bash
npm run dev
```

The default development URLs are `http://localhost:5000` for the API and `http://localhost:3000` for the client. You can also run them individually with `npm run server` and `npm run client`. Build the client with `npm run build`.

An optional demo-data command is available at `node server/scripts/seedDemoData.js`.

## Configuration

The authoritative list of supported variables and deployment-specific notes is in [.env.example](.env.example) and [ENV_CONFIGURATION.md](ENV_CONFIGURATION.md). Common settings include:

- `MONGODB_URI`, `PORT`, and `JWT_SECRET` for the API and database. `JWT_SECRET` must be set in production; startup exits with an error if it is missing. The local development fallback is not suitable for deployed environments.
- Redis connection settings (`REDIS_HOST`, `REDIS_PORT`, `REDIS_DB`, and optional `REDIS_PASSWORD`) for background analysis.
- `RATE_LIMIT_IP_HEADER` when a reverse proxy provides the client IP in a trusted header. Production defaults to Railway's `X-Real-IP`; configure this variable for other proxy deployments.
- `ANALYSIS_WORKER_POOL_SIZE`, `ANALYSIS_JOB_TIMEOUT`, and `ANALYSIS_JOB_MAX_ATTEMPTS` for analysis processing.
- `STORAGE_BACKEND`, upload settings, and optional S3 credentials/endpoint for media storage.
- `REACT_APP_API_URL` and `CLIENT_URL` for client/API URLs. `CLIENT_URL` must be set to the frontend HTTPS origin in production; startup rejects a missing or malformed value and uses it for CORS and email links.
- Optional email, Sentry, and backup settings for deployment integrations.

Do not commit production secrets. See [Deployment](DEPLOYMENT_GUIDE.md), [AWS Free plan deployment](AWS_FREE_PLAN_DEPLOYMENT.md), and [Environment configuration](ENV_CONFIGURATION.md) before deploying.

## Analysis reliability and operations

The analysis pipeline has been hardened to avoid duplicate persisted results and to retain exhausted work for investigation:

1. Analysis jobs run through BullMQ with configurable retry attempts and exponential backoff.
2. When a job exhausts its retries, the worker copies its identifying metadata and failure details to the `analysis-dead-letter` queue. A deterministic dead-letter job ID prevents duplicate copies if the final failure event repeats.
3. The admin API exposes a paginated summary at `GET /api/admin/dead-letter-jobs?limit=50&offset=0`. The response includes the related video ID, job IDs, attempts, failure reason, and timestamp; it omits the original job payload and local video paths. Access is admin-only.
4. A unique index on `Analysis.video` enforces one persisted analysis per video. Before deploying that index to a database that may contain older duplicate records, run the duplicate audit and review its output:
   ```bash
   cd server
   node scripts/dedupeAnalyses.js
   ```
   The default mode is dry-run. To apply the cleanup, first take a verified backup and pause API/analysis writers, then rerun with `--apply`. The script keeps the newest record for each video and removes older duplicates.
5. Admins can inspect video jobs and request a retry of a failed video through the existing admin job controls. The daemon reprocesses the video through the normal pipeline.

Queue settings and migration details are documented in [server/docs/JOB_QUEUE_MIGRATION.md](server/docs/JOB_QUEUE_MIGRATION.md). Database backup and restore guidance is in [server/docs/BACKUP_STRATEGY.md](server/docs/BACKUP_STRATEGY.md).

## CI and project documentation

GitHub Actions runs the repository checks for server tests, client tests and build, and Python syntax validation. The workflow is [ci.yml](.github/workflows/ci.yml). Local commands are defined in the root, server, and client package manifests.

Additional references:

- [API reference](API_REFERENCE.md)
- [Testing and QA guide](TESTING_QA_GUIDE.md)
- [Deployment guide](DEPLOYMENT_GUIDE.md)
- [AWS Free plan deployment](AWS_FREE_PLAN_DEPLOYMENT.md)

## License

MIT. See [LICENSE](LICENSE).
