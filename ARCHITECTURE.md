# Scout Bridge Analytics Architecture

## 1. System overview

Scout Bridge Analytics is a modular web application with a React client, Express API, MongoDB persistence, Redis/BullMQ asynchronous processing, and a Python computer-vision pipeline.

It is best described as a modular monolith with asynchronous worker processing and clear subsystem boundaries. The repository is not a collection of independently deployed microservices today.

## 2. High-level architecture

```
                           +----------------------+
                           |      Browser         |
                           | React 18 + Router    |
                           +----------+-----------+
                                      |
                              HTTPS / API / WS
                                      |
               +----------------------+----------------------+
               |                                             |
      +--------v---------+                         +---------v---------+
      | Express API      |                         | Socket.IO         |
      | Auth/REST        |                         | progress/events   |
      +---+----------+---+                         +-------------------+
          |          |
          |          +--------------------+
          |                               |
   +------v------+                  +-----v------+
   | MongoDB     |                  | Redis      |
   | domain data |                  | BullMQ     |
   +-------------+                  +-----+------+
                                        |
                                  +-----v------+
                                  | Analysis    |
                                  | worker pool |
                                  +-----+------+
                                        |
                                  +-----v------+
                                  | Python CV   |
                                  | YOLO/OpenCV |
                                  +-----+------+
                                        |
                                  +-----v------+
                                  | Media       |
                                  | local/S3    |
                                  +-------------+
```

## 3. Client layer

The React application is responsible for:

- routing and page composition
- authentication/session state
- role-aware navigation
- upload UX
- report/player/team visualization
- real-time analysis progress presentation
- client-side API consumption

The root app uses route-level lazy loading and shared workspace components.

Important boundaries:

- The client must not contain service credentials.
- Authorization decisions must be enforced on the server.
- Client state should not become the system of record for analysis results.

## 4. API layer

Express is the application boundary for HTTP operations.

Responsibilities include:

- authentication and password reset
- authorization and role enforcement
- upload/import orchestration
- player/team/scouting/report operations
- subscription/billing operations
- admin operations
- exports
- monitoring
- audit logging
- notification/email orchestration

Controllers own request-level orchestration; reusable domain logic belongs in services/utils.

## 5. Data layer

MongoDB is the persistent system of record for application entities such as users, teams, players, videos, analyses, reports, scouting data, subscriptions, notifications, and audit information.

Mongoose models define validation and indexes.

Important invariant:

> A video should not accumulate multiple persisted Analysis records. The repository enforces a uniqueness constraint around the analysed video and provides a deduplication script for legacy data.

## 6. Asynchronous processing

Analysis is intentionally separated from synchronous HTTP request processing.

Typical flow:

1. User uploads/imports a video.
2. API persists the video record and exposes analysis state.
3. A queue/daemon claims analysis work.
4. BullMQ coordinates retries and background execution.
5. The Node worker spawns the Python CV worker.
6. Python processes video frames and produces structured results/artifacts.
7. The server validates/persists the result.
8. Socket.IO emits lifecycle/progress events.
9. Client refreshes or updates the analysis UI.

The processing path includes retries, exponential backoff, timeout handling, dead-letter retention, leases/heartbeats, and stale-job recovery.

## 7. Analysis subsystem

The Python pipeline covers sport-aware computer vision including player detection/tracking, pose estimation, ball tracking, jersey OCR, tactical analysis, and action/event extraction.

Node coordinates job execution; Python performs the computationally intensive CV work.

Keep the CV boundary explicit so model/runtime changes do not leak into HTTP route code.

## 8. Queue and worker design

Redis stores the BullMQ-backed analysis queues.

Current concepts:

- `analysis`: active processing queue
- `analysis-dead-letter`: exhausted analysis jobs for operator inspection
- bounded worker concurrency
- configurable retry attempts
- exponential retry backoff
- job timeout
- queue event logging
- deterministic dead-letter IDs
- worker graceful shutdown

The analysis daemon also uses MongoDB processing leases to prevent abandoned work from remaining permanently stuck.

## 9. Storage architecture

The storage abstraction supports:

- local filesystem for development/simple deployments
- S3-compatible object storage for durable production media

Application code should interact through the storage abstraction rather than directly coupling domain logic to one backend.

Large-upload flows support resumable/chunked or multipart behavior. Abandoned multipart uploads require lifecycle/cleanup handling.

## 10. Real-time architecture

Socket.IO runs alongside Express on the Node HTTP server.

The server emits analysis lifecycle events such as:

- `analysis:queued`
- `analysis:started`
- `analysis:progress`
- `analysis:complete`
- `analysis:failed`

Event contracts should be versioned/changed carefully because the React client depends on them.

## 11. Security architecture

Security controls are layered:

- JWT-based authentication
- password hashing
- role guards
- request validation
- Helmet
- CORS configuration
- rate limiting
- protected admin routes
- audit service
- production secret validation
- private/durable media storage
- controlled exports
- error tracking without routine client-input noise

Do not treat React route guards as authorization. The API remains authoritative.

## 12. Deployment architecture

The repository includes Docker and deployment guidance for AWS/platform-style deployments.

A deployment may combine:

- API + client build
- analysis worker capability
- MongoDB
- Redis
- object storage
- HTTPS ingress/tunnel

At scale, the first natural separation is the resource-heavy analysis worker from the interactive API. This should be done only when queue depth, CPU utilization, deployment cadence, or reliability requirements justify it.

## 13. Scaling strategy

### Vertical scale

Increase CPU/RAM where the CV workload is the limiting resource.

### Horizontal API scale

The HTTP API can be scaled independently when the deployment keeps session/auth state and media outside a single process.

Requirements include shared Redis, shared durable storage, and careful Socket.IO scaling strategy.

### Worker scale

Increase analysis worker replicas/concurrency while keeping CPU saturation and Python process memory within safe limits.

Do not scale concurrency blindly; CV workloads are CPU/memory intensive.

### Database scale

Tune indexes and query patterns first. Consider replica/read scaling only after measured workload evidence.

## 14. Failure modes

### MongoDB unavailable

API persistence and analysis result writes fail. Startup/connectivity checks and monitoring should surface the condition.

### Redis unavailable

Queued analysis cannot operate normally. Interactive API functions may still partially work depending on route behavior.

### Worker crash

The lease expires and stale-job recovery can return the video to queued state. BullMQ retry/dead-letter behavior should preserve diagnostic information.

### Python model/runtime failure

The job should fail explicitly, retain the reason, and be observable through logs/dead-letter inspection.

### Object storage failure

Upload/import and artifact access may fail while unrelated database operations remain available.

## 15. Architectural rules

1. Keep the API, client, queue, CV pipeline, and storage boundaries explicit.
2. Prefer asynchronous processing for expensive video analysis.
3. Preserve idempotency and retry safety.
4. Keep security enforcement server-side.
5. Avoid duplicating shared infrastructure implementations.
6. Introduce new services only for a measurable scaling, reliability, ownership, or deployment boundary.
7. Treat data contracts, API responses, Socket.IO events, and analysis result schemas as compatibility surfaces.

## 16. Evolution path

The architecture can evolve toward independently deployable services without a rewrite.

A reasonable extraction order is:

1. Analysis workers
2. Media ingestion/transcoding
3. Notifications/email
4. Reporting/export workloads
5. Other high-load domains only when operational evidence supports extraction

Until then, keep the modular-monolith boundary strong: clear modules, explicit interfaces, queues for long work, and centralized cross-cutting controls.
