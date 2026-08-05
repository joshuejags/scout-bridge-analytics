# AUDIT_REPORT.md

Generated: 2026-08-05

Scope: Full codebase review and actionable roadmap for Scout Bridge Analytics. This report synthesizes architecture, product, ML, security, and performance findings (Phase 1), a gap-analysis table (Phase 2), a product vision (Phase 3), and a four-sprint implementation roadmap (Phase 4).

---

EXECUTIVE SUMMARY
- Current state: MERN web app + Python YOLOv8 ML assets scaffolding. Core flows (upload, ML scripts, analytics concepts) exist but end-to-end integration, robustness, security, testing, and production-readiness are incomplete.
- Highest risks: unreliable job orchestration for heavy video workloads, lack of ML model/version management, missing observability and security hardening, and potential DB/storage scaling issues.
- Primary recommendations: implement durable queue with retry/backoff, formal ML inference service with versioning, object storage for large assets, RBAC and token lifecycle management, integrated CI/CD, and end-to-end tests.

---

PHASE 1 — FULL CODEBASE REVIEW

1) ARCHITECTURE REVIEW

Frontend architecture
- Strengths: React-based SPA with expected pages (Upload, Dashboard). Uses socket events for progress in design.
- Weaknesses: No evidence of code-splitting, SSR/CSR strategy, or static-asset CDN plan. State management choice unclear (Redux/Zustand). No automated E2E tests or accessibility checks noted.
- Risks: Large bundle sizes and slow initial load; fragile real-time flows without reconnection/backoff.

Backend architecture
- Strengths: Express + Mongoose scaffold, job queue abstraction, storage adapter concept.
- Weaknesses: Worker orchestration unclear (Node vs Python orchestration mechanism). No explicit resilient orchestration (dead-letter, retries, idempotency). No autoscaling/workers pool plan.
- Risks: Long-running jobs may block or crash workers; job coordination can lose state on failure.

Database design
- Strengths: Logical models for User, Video, Player, Events, Tracks. Use of MongoDB fits flexible analytics outputs.
- Weaknesses: Per-frame detections stored as documents can bloat DB; no clear retention, partitioning, or aggregation strategy. Missing indexes for heavy query paths (e.g., video.status, player lookup, time-range).
- Risks: Storage blow-up, slow queries, high cost at scale.

API design
- Strengths: REST conventions and socket notifications outlined.
- Weaknesses: Missing OpenAPI/Swagger docs; no clear pagination, rate-limiting, or consistent error model. Unknown contract for ML results ingestion.
- Risks: Frontend/backlog mismatch; hard to integrate third-party tools.

Authentication
- Strengths: JWT-based flow described; refresh tokens considered.
- Weaknesses: No strong guidance on refresh storage (cookie vs localStorage), token rotation, or audit logging.
- Risks: Token theft, privilege escalation, insufficient logout semantics.

File storage
- Strengths: Storage adapter abstraction exists for local/S3.
- Weaknesses: No lifecycle policies, chunked upload for large videos, resumable upload (tus/Multipart), or streaming support.
- Risks: Upload failures, client timeouts, storage cost from duplicated copies.

Scalability
- Strengths: Decoupled ML workers conceptually separable from API.
- Weaknesses: No autoscaling rules, lack of GPU worker pool plan, no backpressure/capacity controls at API layer for job acceptance.
- Risks: API overloaded by consumer uploads; ML backlog grows unbounded.

Maintainability
- Strengths: Clear domain separation (api/models/services/worker).
- Weaknesses: Lacking tests, missing linting/format enforcement, sparse docs and runbooks.
- Risks: Onboarding friction and regressions.

2) PRODUCT REVIEW

Missing features
- Multi-camera matches and syncing.
- Player identity resolution across matches and seasons (persistent global IDs).
- Full roster/team management and match metadata editing UI.
- Advanced event types (xG, tactical phases) and manual annotation workflows.
- Resumable/large file upload and preview trimming.

Weak/fragile features
- Real-time job progress (no reconnection/backfill).
- ML outputs ingestion (no versioned schema or validation).
- Basic analytics (heatmaps) likely present but lacks filtering, export, and API-first access.

Broken user flows (likely)
- Upload of large files without resumable chunking.
- Retry/resubmit processed jobs — unclear UI/UX.
- Auth edge cases (expired refresh tokens, concurrent sessions).

UX issues
- No mobile-first guidance; visualization components (heatmap overlay) need clarity on legends, units, and coordinate transforms.
- Missing action affordances for manual corrections (reassign track, correct events).
- Analytics export and sharing flows absent.

3) FOOTBALL ANALYTICS COMPARISON

Benchmarked against Wyscout, Hudl, InStat, StatsBomb, Veo, SkillCorner.

Gaps vs leaders
- Event accuracy and standardization: no xG models, open-data schemas (StatsBomb), or standard event taxonomy.
- High-quality ball-tracking and multi-camera stitching (Veo/SkillCorner).
- Player identification at scale (SkillCorner's linking across broadcast variations).
- Analytics products (Wyscout/Hudl) include robust tagging, manual correction UIs, and collaboration/sharing features.

Opportunities
- Differentiators: Combine pose-based advanced metrics (biomechanics) with video clips for coaching insights.
- Roadmap: Build manual correction UI, event taxonomy compatibility (StatsBomb), and export pipelines for scouts/coaches.

4) AI/ML REVIEW

Computer vision pipeline
- Design: YOLOv8 detection + pose, tracking library inference, postprocessing -> analytics.
- Issues: No model versioning or registry; unclear GPU inference service; no benchmark metrics or evaluation pipeline.

Object detection
- Likely YOLOv8-based; recommend precision/recall evaluation by dataset split and per-class thresholds.
- Need: confidence calibration, NMS strategy, frame sampling policy.

Tracking
- Likely ByteTrack/DeepSORT concept. Needs ID switch mitigation, re-id features, and appearance embedding to reduce fragmentation.

Player identification
- Challenges: jersey number OCR, face re-id, team kit change, occlusions. Current pipeline likely relies on tracks only — insufficient for re-identification across cameras/matches.

Action recognition
- Status: heuristic or simple temporal classifier. Needs labeled dataset, architecture (3D CNNs, temporal transformers), and temporal localization for events with timestamps and confidence.

Highlight generation
- Requirements: clip extraction, context windowing, duplicate suppression, continuity across edits. Missing UI for clip review/export.

Data pipeline needs
- Ground truth labeling tools, training dataset management, experiment tracking (MLflow), and model governance.

5) SECURITY REVIEW

Authentication
- JWT used; implement access token short TTL + refresh token rotation and secure storage (HttpOnly cookie).

Authorization
- Implement RBAC and guard dangerous endpoints (requeue jobs, delete data).

API security
- Use rate-limiting, request size limits for uploads, strict CORS policy.

Secrets management
- Do not store secrets in repo; use secret managers (Azure Key Vault / AWS Secrets Manager / HashiCorp Vault). .env.example OK for dev only.

OWASP risks
- Unvalidated file uploads (malware risk), SSRF via storage, injection via unvalidated ML outputs, insecure direct object reference for videos, insufficient logging for audits.

6) PERFORMANCE REVIEW

Slow queries
- Potential on heavy aggregation over Tracks/Events; missing appropriate indexes and aggregation precomputation.

Large bundles
- Frontend may bundle heavy visualization libs; code-split and lazy-load heatmaps and 3D libraries.

Bottlenecks
- ML pipeline (GPU-bound), DB storage for per-frame detections, single-process worker model, insufficient queue back-pressure.

Memory leaks
- Long running Node processes handling large file streams need streaming APIs and memory profiling.

---

PHASE 2 — GAP ANALYSIS

| Current State | Missing Capability | Impact | Recommended Solution | Difficulty | Priority |
|---|---:|---|---|---:|---:|
| File uploads accept whole files | Resumable/chunked uploads & streaming | Upload failures, poor UX for large files | Implement tus or multipart chunked upload + server-side recomposition; support presigned S3 uploads | Medium | High |
| Queueing vaguely defined | Durable job queue, DLQ, idempotency, backpressure | Job loss, retries, overload | Adopt BullMQ (Redis) or RabbitMQ with DLQ, job TTL, retry/backoff; enforce idempotent job handlers | Medium | High |
| ML invoked ad-hoc | Versioned inference service with API & registry | Non-reproducible outputs, model drift | Deploy ML inference microservice (gRPC/HTTP), registry (MLflow), and CI for models | High | High |
| Per-frame detections stored raw | Aggregation & storage strategy | DB bloat, high costs, slow queries | Store raw frame outputs in compressed object storage (Parquet/NDJSON) and keep aggregated summaries in MongoDB | Medium | High |
| No E2E tests | Risk of regressions | Deploy instability | Add unit, integration, and E2E (Cypress) tests; CI gating | Medium | High |
| No observability | Hard to debug & monitor | Downtime, undetected failures | Add structured logging, Sentry, Prometheus metrics, and dashboards | Medium | High |
| Auth flow incomplete | Token rotation, RBAC, session management | Security exposure | Implement HttpOnly refresh cookies, rotate refresh tokens, and role-based access control | Medium | High |
| No model evaluation pipelines | Unknown model performance | Poor event accuracy | Labeling pipeline, validation sets, model metrics reporting | High | Medium |
| Frontend bundle heavy | Slow load | Bad UX | Code-splitting, lazy load visualizations, CDN | Low | Medium |
| Missing export & collaboration | Reduced product-market fit | Less adoption by coaches | Add clip export, share links, manual tagging & collaboration features | Medium | Medium |
| No secrets manager | Secret leakage risk | Security incidents | Use cloud secret manager and CI secret injection | Low | High |

---

PHASE 3 — PRODUCT VISION

Goal: Become a full-featured, coach-centric football analytics platform offering automated high-accuracy event detection, player-level biomechanical insights, and collaborative workflows competitive with Wyscout/Hudl/SkillCorner.

Key pillars
- Accuracy & Trust: model metrics, human-in-the-loop correction, model version transparency.
- Scalability & Reliability: elastic GPU worker pool, durable queues, and object storage.
- Coach-first UX: fast clip review, tagging, exportable playlists, simple collaboration (comments, shareable clips).
- Interoperability: support StatsBomb schema, CSV/JSON exports, API-first for third-party integrations.
- Insights: per-player physical metrics (distance, sprints), tactical metrics (pass networks), and advanced metrics (xG via dedicated models).
- Compliance: secure RBAC, data retention policies, privacy controls.

Monetization directions
- Tiered offering: Basic (upload + simple analytics), Pro (advanced metrics + API), Enterprise (team-level management + SLAs + custom models).

---

PHASE 4 — IMPLEMENTATION ROADMAP (Sprints 1-4)

Sprint planning assumptions
- Team: Backend engineer(s), Frontend engineer(s), ML engineer, DevOps, QA.
- Sprint length: 2 weeks.

Sprint 1 — Stabilize core infra (Foundations)
- Features
  - Implement durable queue (BullMQ + Redis), implement job status endpoints.
  - Add resumable upload support (presigned S3 multipart) or chunked server recomposition.
  - Add basic observability (structured logs, Sentry).
- APIs
  - POST /api/videos/upload (chunked/presigned)
  - GET /api/videos/:id/status
  - POST /api/jobs/:id/retry
- DB changes
  - Add JobLog collection, indexes on video.status and jobId.
- Frontend changes
  - Upload UI: chunked/presigned flow with progress + reconnection/resume.
  - Job status polling + socket fallback.
- Testing
  - Unit tests for queue producer/consumer stubs.
  - Integration test for upload -> enqueue -> job log.

Sprint 2 — Harden ML orchestration & storage
- Features
  - Implement ML inference service contract (HTTP/gRPC) and a Node worker that calls it.
  - Add artifact storage: S3/minio + lifecycle; move raw per-frame outputs to object storage (Parquet/NDJSON).
  - Implement DLQ and retry/backoff.
- APIs
  - POST /api/processing/ingest-callback (ML service posts results)
  - GET /api/videos/:id/artifacts
- DB changes
  - Add model_version field to Video and analytics records.
  - Migrate per-frame storage references to object storage paths.
- Frontend changes
  - Display artifact thumbnails and link to downloadable analytics JSON.
- Testing
  - End-to-end test: enqueue -> ML mock -> ingestion -> UI update.

Sprint 3 — Improve ML quality & human-in-the-loop
- Features
  - Implement manual correction UI: reassign tracks, correct events.
  - Add model evaluation pipeline and labeling primitives (simple labeling UI).
  - Implement player identity improvements (number OCR + simple re-id).
- APIs
  - POST /api/videos/:id/corrections
  - GET /api/players/:id/aggregated-stats
- DB changes
  - Correction records/audit trail schema.
  - Persistent player canonical IDs and aliases.
- Frontend changes
  - Correction workflow UI and review queue for processed videos.
  - Player page with aggregated metrics and per-match drill-down.
- Testing
  - UI acceptance tests for correction flows.
  - ML metrics reporting tests.

Sprint 4 — Product polish & exports
- Features
  - Exportable highlights (clip stitching + download/presigned URL).
  - Implement role-based access control and session management improvements (refresh cookie).
  - Performance tuning: index creation, server-side caching for heavy endpoints.
- APIs
  - POST /api/videos/:id/highlights (create highlight playlist)
  - GET /api/exports/:id (status + presigned URL)
- DB changes
  - Highlight metadata collection; retention policies for artifacts.
- Frontend changes
  - Playlist creation UI and sharable links.
  - Admin panel for job re-queue and system metrics.
- Testing
  - Load test scripts for concurrent uploads and job enqueueing.
  - Security tests: token expiry, RBAC enforcement.

Cross-sprint non-functional tasks (ongoing)
- CI/CD pipeline: build/test/deploy gating, containerization, ECR/ACR pipelines.
- Secrets management: integrate Vault or cloud secret manager.
- Monitoring: Prometheus metrics export from workers and backend; Grafana dashboards.
- Model registry & experiments (MLflow) and automated model deployment.

MILESTONES & METRICS
- End of Sprint 2: Reliable upload + durable queue + ML ingestion with model versioning.
- End of Sprint 3: Human-in-the-loop corrections and improved player identification.
- End of Sprint 4: Highlight exports, RBAC, and production-grade observability.
- KPIs: job success rate (>99%), median upload/resume success, model precision/recall targets per event (define per event).

---

APPENDIX — QUICK ACTION ITEMS (Immediate)
1. Add .env.example with required vars and ensure no secrets in repo.
2. Add unit and integration tests for backend upload/queue paths.
3. Configure Redis + BullMQ and add DLQ pattern.
4. Implement presigned S3 upload flow or chunked upload.
5. Add logging + Sentry and basic Prometheus metrics.

---

If you want, I can:
- Generate concrete API contract (OpenAPI spec) for the endpoints listed in the roadmap.
- Draft database migration scripts for moving per-frame outputs to object storage.
- Scaffold a minimal ML inference microservice interface and a mock worker for local testing.
