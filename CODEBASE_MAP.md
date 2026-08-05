# CODEBASE_MAP.md

Generated: 2026-08-05

Purpose: high-level map of the Scout Bridge Analytics codebase, architecture, data model, workflows, and notes on open work / risks. This document was produced from repository conventions and the project's setup notes. Confirm paths and filenames in your workspace and update specifics where implementation diverges.

---

## 1. Project Overview
Scout Bridge Analytics is a sports analytics platform built with a MERN stack backend + React frontend and integrated Computer Vision pipelines (YOLOv8, YOLOv8-pose) for video-based player/ball detection, tracking, action detection, and analytics (heatmaps, stats). Key capabilities: video upload, asynchronous processing, tracking, analytics generation and streaming progress updates to clients.

Primary runtimes:
- Node.js (Express) backend
- React frontend (client)
- Python (YOLOv8, pose, training/eval) for CV/ML pipelines
- MongoDB for primary data storage
- Redis/RabbitMQ/BullMQ likely used for job queues (inferred)
- Optional cloud storage (S3-compatible) for video/assets

---

## 2. Folder Structure (typical / recommended mapping)
Note: adjust names/paths to match your repository. Common folders:

- /backend or /server
  - package.json, src/, config/, controllers/, routes/, models/, services/, workers/, utils/
- /client or /frontend
  - package.json, src/, public/, src/components/, pages/, services/, hooks/, store/
- /ml or /cv
  - yolov8_scripts/, models/, weights/, notebooks/, requirements.txt, src/
- /scripts
  - deploy/, ci/, setup scripts
- /docker
  - Dockerfile(s), docker-compose.yml, k8s/ manifests (if present)
- /docs
  - design docs, runbooks
- /data or /storage (gitignored)
  - uploaded_videos/, processed_outputs/
- /.github
  - workflows (CI/CD)
- .env.example, README.md, CODEBASE_MAP.md

---

## 3. Frontend Architecture
Core responsibilities:
- UI for uploading videos, viewing processing progress, visualizing analytics (heatmaps, charts), player pages, match summaries.
- Communicates with backend via REST APIs and WebSockets for real-time progress/status.

Typical folders/files:
- client/src/index.tsx / App.tsx — app bootstrap and router
- client/src/pages/* — pages (Upload, Dashboard, Match, Player, Analytics)
- client/src/components/* — UI components (VideoPlayer, HeatmapOverlay, ProgressBar)
- client/src/services/api.ts — HTTP client wrapper (axios/fetch) with auth token injection
- client/src/services/socket.ts — websocket wrapper (socket.io-client)
- client/src/store/* — global state (Redux/Context/Zustand)
- client/package.json — frontend dependencies (react, react-router, redux, recharts, deck.gl or mapbox, socket.io-client)

Dependencies:
- React, React Router, State management (Redux/Zustand), visualization libs (Chart.js, D3, Deck.GL), socket.io-client, axios.

Connections:
- Calls backend REST endpoints (e.g., /api/videos, /api/auth)
- Subscribes to socket channels for processing progress and events
- Fetches processed analytics (tracks, events, heatmaps) from backend

---

## 4. Backend Architecture
Core responsibilities:
- REST API to manage users, videos, processing jobs, analytics.
- Job ingestion and orchestration to hand off video processing to Python ML workers.
- Authentication, authorization, and resource management.
- Stores metadata and analytics in MongoDB; uses queue and caching for job orchestration.

Typical folders/files:
- server/src/index.js or server/src/app.ts — Express app entry
- server/src/routes/*.ts — route definitions (auth, videos, analytics, players)
- server/src/controllers/*.ts — request handlers
- server/src/models/*.ts — Mongoose models (User, Video, Match, Player, Event, Track)
- server/src/services/storage.ts — local/remote (S3) storage adapter
- server/src/services/queue.ts — job enqueue (BullMQ or RabbitMQ)
- server/src/workers/* — Node workers or bridge scripts that call Python workers
- server/src/middleware/auth.ts — auth middleware (JWT)
- server/package.json — backend dependencies (express, mongoose, bullmq, socket.io, aws-sdk)

Dependencies:
- Node, Express, Mongoose, Bull/BullMQ or amqplib, socket.io or ws, AWS SDK (if S3), multer (for multipart upload), helmet/cors/rate-limit.

Connections:
- Enqueues processing jobs to queue
- Emits socket events to client
- Reads/writes to MongoDB and object storage
- Calls Python ML components (via CLI, RPC, gRPC, or HTTP) to process videos

---

## 5. Database Schema (recommended Mongoose models)
Common collections/models and fields:

- User
  - _id, email, passwordHash, role (admin/analyst/viewer), profile, createdAt, refreshedTokens
- Video
  - _id, uploaderId, filename, originalPath, storageUrl, duration, resolution, status (uploaded/queued/processing/done/failed), jobId, uploadedAt, processedAt, metadata
- Match (optional)
  - _id, teams, date, location, videoIds[], summaryStats
- Player
  - _id, name, jersey, team, positions[], metadata, aggregatedStats
- Track / Detection
  - videoId, frame, objectId, category (player/ball), bbox, confidence, keypoints (pose), timestamp
- Event
  - videoId, type (pass, shot, goal, tackle), players[], frame, timestamp, metadata
- Heatmap
  - videoId, resolution, aggregatedGrid / geojson
- Audit / JobLog
  - jobId, type, status, logs, startedAt, finishedAt

Indexes: video.status, user.email(unique), createdAt timestamps, video.uploaderId, player.team

---

## 6. Authentication & Authorization Flow
Typical flow:
- Registration/Login -> server validates credentials -> issues JWT access token (short-lived) and optional refresh token (HTTP-only cookie or DB persisted).
- Frontend stores access token in memory (or secure storage) and sends it in Authorization header.
- Protected routes use auth middleware to validate JWT and attach user to request.
- Role-based authorization: middleware checks user.role against endpoint permissions.
- Refresh flow: /api/auth/refresh -> uses refresh token to issue new access token.
- Logout: invalidates refresh token (removes from DB or blacklist).

Security notes:
- Use HTTPS, HttpOnly secure cookies for refresh tokens, rotate secrets, rate-limit auth endpoints, store password hashes with bcrypt/argon2.

---

## 7. API Structure
Base: /api

Common endpoints:
- /api/auth
  - POST /register
  - POST /login
  - POST /refresh
  - POST /logout
- /api/users
  - GET /me, PATCH /me
- /api/videos
  - POST /upload — receives multipart, returns video record + job queued
  - GET /:id — metadata, status, urls
  - GET /:id/analytics — processed analytics payload
  - GET / — list videos with filters
  - DELETE /:id
- /api/processing
  - GET /jobs/:id/status
  - POST /jobs/:id/retry
- /api/players
  - CRUD player data, aggregated stats
- /api/analytics
  - GET /matches/:id/summary, /heatmap, /events
- Socket endpoints
  - namespace /processing or /videos for progress events: job:start, job:progress, job:complete, job:error

Design notes:
- Use pagination on list endpoints
- Use authenticated endpoints for uploads and analytics retrieval

---

## 8. Video Upload & Processing Workflow
High-level flow:
1. Client uploads video via /api/videos/upload (multipart/form-data). Backend saves file to local disk or object storage and creates Video DB record with status=uploaded.
2. Backend enqueues a processing job (BullMQ/RabbitMQ) with video metadata and storage path.
3. Worker (Node or Python orchestrator) picks job and invokes Python CV pipeline (CLI call, Celery task, gRPC, or HTTP microservice).
4. Python pipeline runs YOLOv8 detection, tracking, pose estimation; outputs detections, tracks, events, heatmaps, thumbnails, and derived stats (JSON + images).
5. Worker saves artifacts to storage, writes analytics to MongoDB, updates Video status to done/failed, and stores job logs.
6. Backend emits socket events to clients for progress and final result; frontend polls as a fallback.

Components:
- Upload handler (multer/express-fileupload)
- Queue producer (enqueue job)
- Worker consumer (invoke ML)
- Storage adapter (S3/local)
- Result ingestor (parse ML JSON -> DB)
- Notification (socket.io)

---

## 9. AI/ML Pipeline
Core steps:
- Detection: YOLOv8 object detection model to detect players/ball per frame.
- Tracking: ByteTrack/DeepSORT/Bytetrack for maintaining identities across frames.
- Pose Estimation: YOLOv8-pose for keypoints when pose-based analysis required.
- Action Detection / Event Classification: heuristic or small classifier models over pose + track features (temporal models such as LSTM/1D-CNN/transformer).
- Postprocessing: smoothing, deduplication, stable track IDs, interpolate missing frames.
- Analytics Generation: heatmap generation (aggregate positions to grid), summary stats (distance covered, sprints, passes), event extraction.
- Storage: save outputs as JSON (per-frame detections), Parquet/NDJSON aggregated data, images (thumbnails, annotated frames), and vector data (GeoJSON-like).
- Training / Experiments: in ml/ folder with notebooks, dataset utils, and training scripts. Requirements pinned in requirements.txt (ultralytics, torch, opencv-python, numpy, pandas).

Runtime:
- Python 3.9+ virtualenv or conda; GPU-enabled nodes recommended for inference training.

---

## 10. External Integrations
Possible integrations (confirm in repo):
- Cloud storage: AWS S3 / MinIO (for storing videos, artifacts)
- MongoDB (local or Atlas)
- Redis (for queues / caching)
- Message queue: BullMQ (Redis-backed) or RabbitMQ (for job orchestration)
- socket.io (real-time events)
- Monitoring / logging: Sentry, Prometheus, Grafana (if present)
- CI/CD: GitHub Actions workflows in .github/workflows

---

## 11. Deployment Architecture
Typical deployments:
- Development: docker-compose with services: mongo, redis, backend, frontend, ml-worker (optional GPU not present in compose).
- Production: Kubernetes with separate deployments:
  - frontend (static files served via CDN or nginx)
  - backend (scalable replicas behind load balancer)
  - worker(s) for processing (GPU nodes for ML)
  - object storage (S3) or mounted persistent volumes
  - MongoDB (managed Atlas or statefulset)
  - Redis (cache/queue)
  - Ingress controller, TLS termination, CI/CD pipelines.

Docker:
- Dockerfile for backend and frontend; docker-compose.yml to wire dependencies for local dev.

---

## 12. Environment Variables (common)
- MONGODB_URI
- PORT (backend), CLIENT_PORT (frontend)
- JWT_SECRET, JWT_EXPIRES_IN
- REFRESH_TOKEN_SECRET
- REDIS_URL
- QUEUE_NAME or RABBITMQ_URL
- STORAGE_PROVIDER (local|s3)
- S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY, S3_REGION, S3_ENDPOINT
- PYTHON_WORKER_CMD or ML_SERVICE_URL
- NODE_ENV
- LOG_LEVEL
- CORS_ORIGINS
- STRIPE_API_KEY (if payments used)
- GOOGLE_MAPS_API_KEY (if map visualizations)

Check .env.example in repo for exact names.

---

## 13. Current Features (per .github/copilot-instructions.md)
- Tech stack decided (MERN) — done
- Project requirements clarified — done
- Basic scaffolding started (partially)
- Expected features implemented in various degrees:
  - Video upload endpoint
  - Player tracking and ball detection pipelines (ML scripts)
  - Analytics generation (heatmaps / summary stats)
  - Real-time streaming/progress (socket events)

---

## 14. Incomplete Features (from repo notes)
- Backend configuration fully hardened and production-ready
- Frontend polish and complete routes
- CV/ML pipeline integration end-to-end (queuing, ingestion, result persistence)
- Automated deployments and CI/CD completion
- Documentation and developer runbooks
- Tests: unit/integration tests coverage

---

## 15. Technical Debt
Likely areas to address:
- Missing tests for backend and frontend
- Single-threaded processing worker may be a bottleneck; need scalable worker pool with GPU support
- Incomplete error handling & retry policies for long-running ML jobs
- Hardcoded paths / environment assumptions in ML scripts
- Weak role-based access checks if roles are minimal
- No schema migrations/versioning for analytics outputs
- Lack of observability (metrics, traces) and centralized logs

---

## 16. Potential Bottlenecks & Risks
- Video processing is CPU/GPU heavy — ensure worker autoscaling and resource isolation
- Large video storage requires scalable object storage and CDN for downloads/streaming
- Real-time updates require robust socket management and scaling
- Long-running jobs require durable queue and retry/backoff strategy
- MongoDB can grow quickly with per-frame detections; consider compressed formats or time-series DB for high-volume telemetry
- ML model versioning and reproducibility if weights/params not tracked

---

## Folder / Major File-by-File Mapping (recommended inspect & adapt)
Below are canonical entries you should confirm against your repo. Replace with exact file names where they differ.

- /server or /backend
  - src/index.ts / src/app.ts
    - Purpose: Start Express server, connect DB, initialize queues and socket servers.
    - Dependencies: express, mongoose, socket.io, queue client.
    - Connects: Bootstraps app, loads routes and middleware.
  - src/routes/auth.ts
    - Purpose: auth endpoints
    - Dependencies: controllers/auth, jwt utilities
    - Connects: used by client for login/refresh
  - src/controllers/videoController.ts
    - Purpose: upload, metadata, listing, triggering processing
    - Dependencies: storage adapter, queue producer, Video model
    - Connects: enqueues processing job, returns video record
  - src/models/User.ts, Video.ts, Player.ts, Event.ts
    - Purpose: domain models persisted in MongoDB
    - Dependencies: mongoose
    - Connects: used across controllers and worker ingestion
  - src/services/queue.ts
    - Purpose: enqueue / interface with job queue
    - Dependencies: bullmq/redis or amqplib
    - Connects: used by controllers and workers
  - src/services/storage.ts
    - Purpose: abstract local vs S3 storage
    - Dependencies: aws-sdk or fs
    - Connects: used by upload handler and result ingestor
  - src/workers/ingestWorker.ts
    - Purpose: consume queue messages and orchestrate ML processing
    - Dependencies: child_process (spawn), python RPC client, storage, DB models
    - Connects: invokes ML pipelines; persists results; emits socket events

- /client or /frontend
  - src/App.tsx
    - Purpose: routes and global providers
    - Dependencies: react-router, state provider
    - Connects: entry point for UI
  - src/pages/Upload.tsx
    - Purpose: upload UI, shows progress
    - Dependencies: api service, socket
    - Connects: calls /api/videos/upload, listens for job progress
  - src/components/HeatmapOverlay.tsx
    - Purpose: render heatmap over video/court
    - Dependencies: deck.gl or map lib, d3
    - Connects: consumes analytics payloads
  - src/services/api.ts
    - Purpose: centralized HTTP client, auth token handling
    - Dependencies: axios or fetch
    - Connects: used by all data access components

- /ml or /python
  - requirements.txt
    - Purpose: Python dependencies (ultralytics, torch, opencv-python, numpy, pandas)
  - src/process_video.py or pipeline/*.py
    - Purpose: executes detection, tracking, pose estimation, event extraction
    - Dependencies: ultralytics YOLOv8, PyTorch, OpenCV, track libs
    - Connects: invoked by worker (CLI or service) and writes outputs to storage/DB

- docker-compose.yml
  - Purpose: local dev orchestration for mongo, redis, backend, frontend
  - Connects: wires services for local dev

- .github/workflows/*
  - Purpose: CI/CD (lint, build, test, deploy)
  - Connects: used by GitHub Actions for automated tasks

---

## Recommended Immediate Actions
- Run repository scanner to confirm actual paths and update this file with exact filenames.
- Add unit and integration tests for critical backend controllers and ML ingestion worker.
- Add a schema/version field to ML outputs to support backwards compatibility.
- Add monitoring (Sentry + Prometheus) and basic alerting.
- Implement durable queue with retry/backoff and persistent logs for job troubleshooting.

---

If you want, I can:
- Generate a repository-specific CODEBASE_MAP.md by reading your workspace and enumerating exact files and brief descriptions.
- Produce a runbook for local dev (docker-compose + env var list).
- Scaffold missing tests or CI workflows.

```// filepath: c:\Users\Adeolu\Documents\scout-bridge-analytics\CODEBASE_MAP.md

# CODEBASE_MAP.md

Generated: 2026-08-05

Purpose: high-level map of the Scout Bridge Analytics codebase, architecture, data model, workflows, and notes on open work / risks. This document was produced from repository conventions and the project's setup notes. Confirm paths and filenames in your workspace and update specifics where implementation diverges.

---

## 1. Project Overview
Scout Bridge Analytics is a sports analytics platform built with a MERN stack backend + React frontend and integrated Computer Vision pipelines (YOLOv8, YOLOv8-pose) for video-based player/ball detection, tracking, action detection, and analytics (heatmaps, stats). Key capabilities: video upload, asynchronous processing, tracking, analytics generation and streaming progress updates to clients.

Primary runtimes:
- Node.js (Express) backend
- React frontend (client)
- Python (YOLOv8, pose, training/eval) for CV/ML pipelines
- MongoDB for primary data storage
- Redis/RabbitMQ/BullMQ likely used for job queues (inferred)
- Optional cloud storage (S3-compatible) for video/assets

---

## 2. Folder Structure (typical / recommended mapping)
Note: adjust names/paths to match your repository. Common folders:

- /backend or /server
  - package.json, src/, config/, controllers/, routes/, models/, services/, workers/, utils/
- /client or /frontend
  - package.json, src/, public/, src/components/, pages/, services/, hooks/, store/
- /ml or /cv
  - yolov8_scripts/, models/, weights/, notebooks/, requirements.txt, src/
- /scripts
  - deploy/, ci/, setup scripts
- /docker
  - Dockerfile(s), docker-compose.yml, k8s/ manifests (if present)
- /docs
  - design docs, runbooks
- /data or /storage (gitignored)
  - uploaded_videos/, processed_outputs/
- /.github
  - workflows (CI/CD)
- .env.example, README.md, CODEBASE_MAP.md

---

## 3. Frontend Architecture
Core responsibilities:
- UI for uploading videos, viewing processing progress, visualizing analytics (heatmaps, charts), player pages, match summaries.
- Communicates with backend via REST APIs and WebSockets for real-time progress/status.

Typical folders/files:
- client/src/index.tsx / App.tsx — app bootstrap and router
- client/src/pages/* — pages (Upload, Dashboard, Match, Player, Analytics)
- client/src/components/* — UI components (VideoPlayer, HeatmapOverlay, ProgressBar)
- client/src/services/api.ts — HTTP client wrapper (axios/fetch) with auth token injection
- client/src/services/socket.ts — websocket wrapper (socket.io-client)
- client/src/store/* — global state (Redux/Context/Zustand)
- client/package.json — frontend dependencies (react, react-router, redux, recharts, deck.gl or mapbox, socket.io-client)

Dependencies:
- React, React Router, State management (Redux/Zustand), visualization libs (Chart.js, D3, Deck.GL), socket.io-client, axios.

Connections:
- Calls backend REST endpoints (e.g., /api/videos, /api/auth)
- Subscribes to socket channels for processing progress and events
- Fetches processed analytics (tracks, events, heatmaps) from backend

---

## 4. Backend Architecture
Core responsibilities:
- REST API to manage users, videos, processing jobs, analytics.
- Job ingestion and orchestration to hand off video processing to Python ML workers.
- Authentication, authorization, and resource management.
- Stores metadata and analytics in MongoDB; uses queue and caching for job orchestration.

Typical folders/files:
- server/src/index.js or server/src/app.ts — Express app entry
- server/src/routes/*.ts — route definitions (auth, videos, analytics, players)
- server/src/controllers/*.ts — request handlers
- server/src/models/*.ts — Mongoose models (User, Video, Match, Player, Event, Track)
- server/src/services/storage.ts — local/remote (S3) storage adapter
- server/src/services/queue.ts — job enqueue (BullMQ or RabbitMQ)
- server/src/workers/* — Node workers or bridge scripts that call Python workers
- server/src/middleware/auth.ts — auth middleware (JWT)
- server/package.json — backend dependencies (express, mongoose, bullmq, socket.io, aws-sdk)

Dependencies:
- Node, Express, Mongoose, Bull/BullMQ or amqplib, socket.io or ws, AWS SDK (if S3), multer (for multipart upload), helmet/cors/rate-limit.

Connections:
- Enqueues processing jobs to queue
- Emits socket events to client
- Reads/writes to MongoDB and object storage
- Calls Python ML components (via CLI, RPC, gRPC, or HTTP) to process videos

---

## 5. Database Schema (recommended Mongoose models)
Common collections/models and fields:

- User
  - _id, email, passwordHash, role (admin/analyst/viewer), profile, createdAt, refreshedTokens
- Video
  - _id, uploaderId, filename, originalPath, storageUrl, duration, resolution, status (uploaded/queued/processing/done/failed), jobId, uploadedAt, processedAt, metadata
- Match (optional)
  - _id, teams, date, location, videoIds[], summaryStats
- Player
  - _id, name, jersey, team, positions[], metadata, aggregatedStats
- Track / Detection
  - videoId, frame, objectId, category (player/ball), bbox, confidence, keypoints (pose), timestamp
- Event
  - videoId, type (pass, shot, goal, tackle), players[], frame, timestamp, metadata
- Heatmap
  - videoId, resolution, aggregatedGrid / geojson
- Audit / JobLog
  - jobId, type, status, logs, startedAt, finishedAt

Indexes: video.status, user.email(unique), createdAt timestamps, video.uploaderId, player.team

---

## 6. Authentication & Authorization Flow
Typical flow:
- Registration/Login -> server validates credentials -> issues JWT access token (short-lived) and optional refresh token (HTTP-only cookie or DB persisted).
- Frontend stores access token in memory (or secure storage) and sends it in Authorization header.
- Protected routes use auth middleware to validate JWT and attach user to request.
- Role-based authorization: middleware checks user.role against endpoint permissions.
- Refresh flow: /api/auth/refresh -> uses refresh token to issue new access token.
- Logout: invalidates refresh token (removes from DB or blacklist).

Security notes:
- Use HTTPS, HttpOnly secure cookies for refresh tokens, rotate secrets, rate-limit auth endpoints, store password hashes with bcrypt/argon2.

---

## 7. API Structure
Base: /api

Common endpoints:
- /api/auth
  - POST /register
  - POST /login
  - POST /refresh
  - POST /logout
- /api/users
  - GET /me, PATCH /me
- /api/videos
  - POST /upload — receives multipart, returns video record + job queued
  - GET /:id — metadata, status, urls
  - GET /:id/analytics — processed analytics payload
  - GET / — list videos with filters
  - DELETE /:id
- /api/processing
  - GET /jobs/:id/status
  - POST /jobs/:id/retry
- /api/players
  - CRUD player data, aggregated stats
- /api/analytics
  - GET /matches/:id/summary, /heatmap, /events
- Socket endpoints
  - namespace /processing or /videos for progress events: job:start, job:progress, job:complete, job:error

Design notes:
- Use pagination on list endpoints
- Use authenticated endpoints for uploads and analytics retrieval

---

## 8. Video Upload & Processing Workflow
High-level flow:
1. Client uploads video via /api/videos/upload (multipart/form-data). Backend saves file to local disk or object storage and creates Video DB record with status=uploaded.
2. Backend enqueues a processing job (BullMQ/RabbitMQ) with video metadata and storage path.
3. Worker (Node or Python orchestrator) picks job and invokes Python CV pipeline (CLI call, Celery task, gRPC, or HTTP microservice).
4. Python pipeline runs YOLOv8 detection, tracking, pose estimation; outputs detections, tracks, events, heatmaps, thumbnails, and derived stats (JSON + images).
5. Worker saves artifacts to storage, writes analytics to MongoDB, updates Video status to done/failed, and stores job logs.
6. Backend emits socket events to clients for progress and final result; frontend polls as a fallback.

Components:
- Upload handler (multer/express-fileupload)
- Queue producer (enqueue job)
- Worker consumer (invoke ML)
- Storage adapter (S3/local)
- Result ingestor (parse ML JSON -> DB)
- Notification (socket.io)

---

## 9. AI/ML Pipeline
Core steps:
- Detection: YOLOv8 object detection model to detect players/ball per frame.
- Tracking: ByteTrack/DeepSORT/Bytetrack for maintaining identities across frames.
- Pose Estimation: YOLOv8-pose for keypoints when pose-based analysis required.
- Action Detection / Event Classification: heuristic or small classifier models over pose + track features (temporal models such as LSTM/1D-CNN/transformer).
- Postprocessing: smoothing, deduplication, stable track IDs, interpolate missing frames.
- Analytics Generation: heatmap generation (aggregate positions to grid), summary stats (distance covered, sprints, passes), event extraction.
- Storage: save outputs as JSON (per-frame detections), Parquet/NDJSON aggregated data, images (thumbnails, annotated frames), and vector data (GeoJSON-like).
- Training / Experiments: in ml/ folder with notebooks, dataset utils, and training scripts. Requirements pinned in requirements.txt (ultralytics, torch, opencv-python, numpy, pandas).

Runtime:
- Python 3.9+ virtualenv or conda; GPU-enabled nodes recommended for inference training.

---

## 10. External Integrations
Possible integrations (confirm in repo):
- Cloud storage: AWS S3 / MinIO (for storing videos, artifacts)
- MongoDB (local or Atlas)
- Redis (for queues / caching)
- Message queue: BullMQ (Redis-backed) or RabbitMQ (for job orchestration)
- socket.io (real-time events)
- Monitoring / logging: Sentry, Prometheus, Grafana (if present)
- CI/CD: GitHub Actions workflows in .github/workflows

---

## 11. Deployment Architecture
Typical deployments:
- Development: docker-compose with services: mongo, redis, backend, frontend, ml-worker (optional GPU not present in compose).
- Production: Kubernetes with separate deployments:
  - frontend (static files served via CDN or nginx)
  - backend (scalable replicas behind load balancer)
  - worker(s) for processing (GPU nodes for ML)
  - object storage (S3) or mounted persistent volumes
  - MongoDB (managed Atlas or statefulset)
  - Redis (cache/queue)
  - Ingress controller, TLS termination, CI/CD pipelines.

Docker:
- Dockerfile for backend and frontend; docker-compose.yml to wire dependencies for local dev.

---

## 12. Environment Variables (common)
- MONGODB_URI
- PORT (backend), CLIENT_PORT (frontend)
- JWT_SECRET, JWT_EXPIRES_IN
- REFRESH_TOKEN_SECRET
- REDIS_URL
- QUEUE_NAME or RABBITMQ_URL
- STORAGE_PROVIDER (local|s3)
- S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY, S3_REGION, S3_ENDPOINT
- PYTHON_WORKER_CMD or ML_SERVICE_URL
- NODE_ENV
- LOG_LEVEL
- CORS_ORIGINS
- STRIPE_API_KEY (if payments used)
- GOOGLE_MAPS_API_KEY (if map visualizations)

Check .env.example in repo for exact names.

---

## 13. Current Features (per .github/copilot-instructions.md)
- Tech stack decided (MERN) — done
- Project requirements clarified — done
- Basic scaffolding started (partially)
- Expected features implemented in various degrees:
  - Video upload endpoint
  - Player tracking and ball detection pipelines (ML scripts)
  - Analytics generation (heatmaps / summary stats)
  - Real-time streaming/progress (socket events)

---

## 14. Incomplete Features (from repo notes)
- Backend configuration fully hardened and production-ready
- Frontend polish and complete routes
- CV/ML pipeline integration end-to-end (queuing, ingestion, result persistence)
- Automated deployments and CI/CD completion
- Documentation and developer runbooks
- Tests: unit/integration tests coverage

---

## 15. Technical Debt
Likely areas to address:
- Missing tests for backend and frontend
- Single-threaded processing worker may be a bottleneck; need scalable worker pool with GPU support
- Incomplete error handling & retry policies for long-running ML jobs
- Hardcoded paths / environment assumptions in ML scripts
- Weak role-based access checks if roles are minimal
- No schema migrations/versioning for analytics outputs
- Lack of observability (metrics, traces) and centralized logs

---

## 16. Potential Bottlenecks & Risks
- Video processing is CPU/GPU heavy — ensure worker autoscaling and resource isolation
- Large video storage requires scalable object storage and CDN for downloads/streaming
- Real-time updates require robust socket management and scaling
- Long-running jobs require durable queue and retry/backoff strategy
- MongoDB can grow quickly with per-frame detections; consider compressed formats or time-series DB for high-volume telemetry
- ML model versioning and reproducibility if weights/params not tracked

---

## Folder / Major File-by-File Mapping (recommended inspect & adapt)
Below are canonical entries you should confirm against your repo. Replace with exact file names where they differ.

- /server or /backend
  - src/index.ts / src/app.ts
    - Purpose: Start Express server, connect DB, initialize queues and socket servers.
    - Dependencies: express, mongoose, socket.io, queue client.
    - Connects: Bootstraps app, loads routes and middleware.
  - src/routes/auth.ts
    - Purpose: auth endpoints
    - Dependencies: controllers/auth, jwt utilities
    - Connects: used by client for login/refresh
  - src/controllers/videoController.ts
    - Purpose: upload, metadata, listing, triggering processing
    - Dependencies: storage adapter, queue producer, Video model
    - Connects: enqueues processing job, returns video record
  - src/models/User.ts, Video.ts, Player.ts, Event.ts
    - Purpose: domain models persisted in MongoDB
    - Dependencies: mongoose
    - Connects: used across controllers and worker ingestion
  - src/services/queue.ts
    - Purpose: enqueue / interface with job queue
    - Dependencies: bullmq/redis or amqplib
    - Connects: used by controllers and workers
  - src/services/storage.ts
    - Purpose: abstract local vs S3 storage
    - Dependencies: aws-sdk or fs
    - Connects: used by upload handler and result ingestor
  - src/workers/ingestWorker.ts
    - Purpose: consume queue messages and orchestrate ML processing
    - Dependencies: child_process (spawn), python RPC client, storage, DB models
    - Connects: invokes ML pipelines; persists results; emits socket events

- /client or /frontend
  - src/App.tsx
    - Purpose: routes and global providers
    - Dependencies: react-router, state provider
    - Connects: entry point for UI
  - src/pages/Upload.tsx
    - Purpose: upload UI, shows progress
    - Dependencies: api service, socket
    - Connects: calls /api/videos/upload, listens for job progress
  - src/components/HeatmapOverlay.tsx
    - Purpose: render heatmap over video/court
    - Dependencies: deck.gl or map lib, d3
    - Connects: consumes analytics payloads
  - src/services/api.ts
    - Purpose: centralized HTTP client, auth token handling
    - Dependencies: axios or fetch
    - Connects: used by all data access components

- /ml or /python
  - requirements.txt
    - Purpose: Python dependencies (ultralytics, torch, opencv-python, numpy, pandas)
  - src/process_video.py or pipeline/*.py
    - Purpose: executes detection, tracking, pose estimation, event extraction
    - Dependencies: ultralytics YOLOv8, PyTorch, OpenCV, track libs
    - Connects: invoked by worker (CLI or service) and writes outputs to storage/DB

- docker-compose.yml
  - Purpose: local dev orchestration for mongo, redis, backend, frontend
  - Connects: wires services for local dev

- .github/workflows/*
  - Purpose: CI/CD (lint, build, test, deploy)
  - Connects: used by GitHub Actions for automated tasks

---

## Recommended Immediate Actions
- Run repository scanner to confirm actual paths and update this file with exact filenames.
- Add unit and integration tests for critical backend controllers and ML ingestion worker.
- Add a schema/version field to ML outputs to support backwards compatibility.
- Add monitoring (Sentry + Prometheus) and basic alerting.
- Implement durable queue with retry/backoff and persistent logs for job troubleshooting.

---

If you want, I can:
- Generate a repository-specific CODEBASE_MAP.md by reading your workspace and enumerating exact files and brief descriptions.
- Produce a runbook for local dev (docker-compose + env var list).
- Scaffold missing tests or CI workflows.
