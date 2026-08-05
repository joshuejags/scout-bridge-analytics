# PROJECT_IMPROVEMENT_PLAN.md

Generated: 2026-08-05

Purpose: Ranked, actionable improvement plan to transform ScoutBridge Analytics into a production-grade football scouting platform. Each improvement is ranked P0/P1/P2 and includes concise Description, Business Impact, Technical Impact, Dependencies, Effort Estimate, Risk Level, and Expected ROI. Recommended implementation order follows.

---

SUMMARY PRIORITIZATION
- P0 = Critical (deliver immediately / first 2 sprints)
- P1 = Important (deliver in subsequent sprints)
- P2 = Future (long-term strategic)

---

IMPROVEMENTS

1) Resumable / Multipart Uploads (P0)
- Description: Implement client-side resumable uploads via S3 multipart + presigned URLs or tus protocol with server support.
- Business Impact: Prevents failed uploads for large match files; improves user conversion and UX for clubs/academies.
- Technical Impact: Reliable large-file ingestion; reduces duplicate storage and admin support.
- Dependencies: S3 (or MinIO), frontend upload component, backend presign endpoints, env config.
- Effort Estimate: Medium (2–3 dev-weeks)
- Risk Level: Low
- Expected ROI: High (reduced failed uploads, lower support cost)

2) Durable Job Queue & Orchestration with DLQ (P0)
- Description: Adopt BullMQ (Redis) or RabbitMQ with DLQ, idempotency keys, TTLs, metrics and admin endpoints.
- Business Impact: Reliable processing pipeline, predictable SLA for customers.
- Technical Impact: Prevents lost jobs, enables autoscaling and backpressure.
- Dependencies: Redis or RabbitMQ infra, worker refactor, monitoring.
- Effort Estimate: Medium (2–3 dev-weeks)
- Risk Level: Medium
- Expected ROI: High (stability, throughput)

3) ML Inference Service + Model Versioning & Registry (P0)
- Description: Create a versioned ML inference microservice (HTTP/gRPC) + model registry (MLflow or artifact store). Store model_version with analytics.
- Business Impact: Reproducibility and trust; supports A/B and rollback; required by clubs for auditability.
- Technical Impact: Decouples API from heavy ML; enables GPU worker autoscaling.
- Dependencies: Containerized Python inference, MLflow or object storage, CI pipeline for models.
- Effort Estimate: Large (4–6 dev-weeks + ML work)
- Risk Level: High (infra + GPU complexity)
- Expected ROI: High (enterprise readiness, client trust)

4) Event Schema & Output Validation (StatsBomb/Wyscout-compatible) (P0)
- Description: Define and enforce a standard event schema; validate ML outputs; produce StatsBomb/Wyscout exports.
- Business Impact: Interoperability with club tools and easier buyer evaluation.
- Technical Impact: Requires contract testing and ingestion validation; reduces downstream errors.
- Dependencies: Schema design, validators, ingestion pipeline changes, frontend mapping.
- Effort Estimate: Medium (2–3 dev-weeks)
- Risk Level: Low
- Expected ROI: High (sales enablement, integrations)

5) Human-in-the-loop Correction UI & Audit Trail (P0)
- Description: UI for manual correction of tracks/events with delta storage, versioning and audit logging.
- Business Impact: Enables customers to trust automated output and improve models with labeled corrections.
- Technical Impact: Adds operational workflow and data feedback loop for ML.
- Dependencies: Frontend editor, API endpoints for corrections, DB schema (corrections/audit), auth controls.
- Effort Estimate: Large (4–6 dev-weeks)
- Risk Level: Medium
- Expected ROI: High (retention, upsell for manual credit features)

6) Secure Authentication & RBAC (P0)
- Description: Implement secure refresh tokens via HttpOnly cookies, refresh rotation, RBAC middleware and token revocation.
- Business Impact: Enterprise security compliance; reduces account/session risk for clients.
- Technical Impact: Changes auth flows; impacts frontend token storage and API middleware.
- Dependencies: Auth service changes, cookie handling on client, migration plan for existing sessions.
- Effort Estimate: Medium (2–3 dev-weeks)
- Risk Level: Medium
- Expected ROI: High (enterprise trust)

7) Artifact Storage Strategy & Per-frame Offload (P0)
- Description: Store raw per-frame detections and large ML artifacts in object storage (Parquet/NDJSON), keep aggregated summaries in MongoDB.
- Business Impact: Scales storage cost-effectively and enables analytics performance.
- Technical Impact: Migration of existing outputs; new ingestion/storage paths and lifecycle policies.
- Dependencies: S3/MinIO, ingestion service, migration script.
- Effort Estimate: Medium (3–4 dev-weeks)
- Risk Level: Medium
- Expected ROI: High (cost control, query performance)

8) Clip / Highlight Generation & Export (P1)
- Description: Service to stitch clips, deduplicate, generate playlists and presigned download links; UI for playlist creation and sharing.
- Business Impact: Core scout & coach use-case — fast clip delivery for recruitment and review.
- Technical Impact: Video processing worker, storage and bandwidth considerations.
- Dependencies: Resumable uploads, S3, worker queue, frontend playlist UI.
- Effort Estimate: Medium (3–4 dev-weeks)
- Risk Level: Medium
- Expected ROI: High (monetizable feature)

9) Player Re-identification (P1)
- Description: Improve identity across matches using jersey-number OCR, appearance embeddings, and temporal heuristics.
- Business Impact: Crucial for longitudinal player scouting and aggregated metrics.
- Technical Impact: Additional ML components, labeled data, evaluation processes.
- Dependencies: ML dataset, ML infra (inference service), human-in-loop corrections for labeling.
- Effort Estimate: Large (6–10 dev-weeks + data)
- Risk Level: High
- Expected ROI: High (differentiator vs competitors)

10) Observability & Monitoring (P1)
- Description: Add Prometheus metrics, Grafana dashboards, structured logging, and Sentry error tracking for backend and workers.
- Business Impact: Faster incident detection & lower MTTR; SLA monitoring.
- Technical Impact: Instrumentation across services and dashboards; alerting.
- Dependencies: Monitoring stack (Prometheus/Grafana/Sentry), code instrumentation.
- Effort Estimate: Small–Medium (2–3 dev-weeks)
- Risk Level: Low
- Expected ROI: Medium (operational efficiency)

11) Automated Tests & CI/CD (P1)
- Description: Add unit, integration, E2E tests (Cypress), and CI pipelines for backend, frontend, and model deployments.
- Business Impact: Decreases regressions and accelerates delivery with confidence.
- Technical Impact: Requires test harnesses, fixtures, and coverage targets.
- Dependencies: CI provider (GitHub Actions), test frameworks, staging infra.
- Effort Estimate: Medium (3–4 dev-weeks)
- Risk Level: Low
- Expected ROI: High (development velocity)

12) Collaboration Features: Shares, Comments, Teams (P1)
- Description: Shareable playlists, comments on clips, team/org management and role controls.
- Business Impact: Improves product stickiness for clubs/coaches.
- Technical Impact: New UI patterns and backend permissioning.
- Dependencies: Auth/RBAC, clip export service, frontend work.
- Effort Estimate: Medium (3–4 dev-weeks)
- Risk Level: Medium
- Expected ROI: Medium–High (retention & upsell)

13) Aggregation & Query Performance (P1)
- Description: Precompute aggregated stats, add DB indexes, materialized views and caching for heavy queries.
- Business Impact: Faster analytics and better UX for large datasets.
- Technical Impact: DB schema updates and periodic jobs to populate aggregates.
- Dependencies: Artifact storage, job queue, DB admin access.
- Effort Estimate: Medium (2–3 dev-weeks)
- Risk Level: Low
- Expected ROI: Medium (user satisfaction)

14) Model Evaluation Pipeline & Labeling Tools (P1)
- Description: Build QA pipelines, evaluation dashboards, and light labeling tooling to collect ground truth from corrections.
- Business Impact: Drives model improvements and measurable quality for customers.
- Technical Impact: Data pipelines, storage for evaluations, integration with MLflow.
- Dependencies: Human correction UI, ML infra.
- Effort Estimate: Medium–Large (4–6 dev-weeks)
- Risk Level: Medium
- Expected ROI: High (accuracy increases => product value)

15) Secrets Management & Secure Deployment (P1)
- Description: Move secrets to Vault/AWS/Azure secret manager and inject via CI; enforce least privilege.
- Business Impact: Security posture required for enterprise customers.
- Technical Impact: CI/CD changes; credential rotation processes.
- Dependencies: Cloud provider secrets service, ops access.
- Effort Estimate: Small (1–2 dev-weeks)
- Risk Level: Low
- Expected ROI: Medium (security compliance)

16) Advanced Analytics (xG, Tactical Phases, Pass Networks) (P2)
- Description: Develop advanced models and visualizations (xG, possession phases, pass networks).
- Business Impact: High differentiation for analyst teams and commercial licensing.
- Technical Impact: New model research, heavy feature engineering, new UI components.
- Dependencies: Labeled datasets, ML infra, evaluation pipelines.
- Effort Estimate: Very Large (3–6+ months)
- Risk Level: High
- Expected ROI: High (enterprise sales & data licensing)

17) Multi-camera Stitching & Sync (P2)
- Description: Support multi-camera capture, sync and reconstruction to improve tracking accuracy.
- Business Impact: Broadens market to pro clubs and broadcasters; improves accuracy.
- Technical Impact: Complex video sync, multi-view geometry, time alignment.
- Dependencies: Hardware partners or capture protocol, ML research.
- Effort Estimate: Very Large (6+ months)
- Risk Level: Very High
- Expected ROI: High (enterprise & hardware revenue)

18) Mobile-first Native Review Apps (P2)
- Description: Native mobile apps for coaches to review clips offline and annotate.
- Business Impact: Increased adoption by coaches and academies.
- Technical Impact: New platforms, offline storage sync and auth flows.
- Dependencies: Clip export, share features, mobile engineers.
- Effort Estimate: Large (3–4 months)
- Risk Level: Medium
- Expected ROI: Medium (adoption growth)

---

RECOMMENDED IMPLEMENTATION ORDER (phased)

Phase A — Foundations (Weeks 0–8)
1. Resumable / Multipart Uploads (P0)
2. Durable Job Queue & Orchestration with DLQ (P0)
3. Artifact Storage Strategy & Per-frame Offload (P0)
4. Secure Authentication & RBAC (P0)
5. Observability & Monitoring (P1)
6. Secrets Management & Secure Deployment (P1)

Phase B — ML & Product Trust (Weeks 8–18)
7. ML Inference Service + Model Registry (P0)
8. Event Schema & Output Validation (P0)
9. Human-in-the-loop Correction UI & Audit Trail (P0)
10. Automated Tests & CI/CD (P1)
11. Model Evaluation Pipeline & Labeling Tools (P1)

Phase C — Productization (Weeks 18–32)
12. Clip / Highlight Generation & Export (P1)
13. Collaboration Features: Shares, Comments, Teams (P1)
14. Aggregation & Query Performance (P1)
15. Player Re-identification (P1)

Phase D — Strategic Differentiation (Months 8+)
16. Advanced Analytics (xG, Tactical Phases) (P2)
17. Multi-camera Stitching & Sync (P2)
18. Mobile-first Native Review Apps (P2)

Notes:
- Parallelize work where possible (e.g., Observability + Secrets + Queue infra).
- ML Inference Service needs concurrent ML engineer effort; begin model registry and infra early in Phase A to enable Phase B.
- Human-in-loop UI should be iterated early to collect labeled corrections feeding model improvements.

---

RISK MITIGATION & GOVERNANCE
- Start with a staging environment and data retention policy for test uploads.
- Add job quotas and admission control to avoid overload during rollout.
- Use feature flags to gate ML model changes and new features to subsets of users.
- Track KPIs: job success rate, median processing time, model precision/recall per event, upload success rate, and customer NPS.

---

EXPECTED ROI SUMMARY (high level)
- P0 bundle (uploads + queue + ML service + schema + corrections + auth) → Enterprise-readiness, immediate reduction in failure/support, core functionality for clubs/scouts. ROI: Very High within 3–6 months.
- P1 bundle (clips, re-id, observability, CI) → Productization and monetizable features. ROI: High within 6–12 months.
- P2 bundle (advanced analytics, multi-camera, mobile) → Differentiation and large enterprise/new market revenue. ROI: High but long lead time (12–24 months).

---

NEXT STEPS (immediate)
- Approve Phase A budget & staffing (backend, frontend, ML, DevOps, QA).
- Create sprint-level backlog with acceptance criteria and owners for the top 6 P0 items.
- Stand up staging infra (S3, Redis, MLflow) and instrument basic metrics.

```// filepath: c:\Users\Adeolu\Documents\scout-bridge-analytics\PROJECT_IMPROVEMENT_PLAN.md

# PROJECT_IMPROVEMENT_PLAN.md

Generated: 2026-08-05

Purpose: Ranked, actionable improvement plan to transform ScoutBridge Analytics into a production-grade football scouting platform. Each improvement is ranked P0/P1/P2 and includes concise Description, Business Impact, Technical Impact, Dependencies, Effort Estimate, Risk Level, and Expected ROI. Recommended implementation order follows.

---

SUMMARY PRIORITIZATION
- P0 = Critical (deliver immediately / first 2 sprints)
- P1 = Important (deliver in subsequent sprints)
- P2 = Future (long-term strategic)

---

IMPROVEMENTS

1) Resumable / Multipart Uploads (P0)
- Description: Implement client-side resumable uploads via S3 multipart + presigned URLs or tus protocol with server support.
- Business Impact: Prevents failed uploads for large match files; improves user conversion and UX for clubs/academies.
- Technical Impact: Reliable large-file ingestion; reduces duplicate storage and admin support.
- Dependencies: S3 (or MinIO), frontend upload component, backend presign endpoints, env config.
- Effort Estimate: Medium (2–3 dev-weeks)
- Risk Level: Low
- Expected ROI: High (reduced failed uploads, lower support cost)

2) Durable Job Queue & Orchestration with DLQ (P0)
- Description: Adopt BullMQ (Redis) or RabbitMQ with DLQ, idempotency keys, TTLs, metrics and admin endpoints.
- Business Impact: Reliable processing pipeline, predictable SLA for customers.
- Technical Impact: Prevents lost jobs, enables autoscaling and backpressure.
- Dependencies: Redis or RabbitMQ infra, worker refactor, monitoring.
- Effort Estimate: Medium (2–3 dev-weeks)
- Risk Level: Medium
- Expected ROI: High (stability, throughput)

3) ML Inference Service + Model Versioning & Registry (P0)
- Description: Create a versioned ML inference microservice (HTTP/gRPC) + model registry (MLflow or artifact store). Store model_version with analytics.
- Business Impact: Reproducibility and trust; supports A/B and rollback; required by clubs for auditability.
- Technical Impact: Decouples API from heavy ML; enables GPU worker autoscaling.
- Dependencies: Containerized Python inference, MLflow or object storage, CI pipeline for models.
- Effort Estimate: Large (4–6 dev-weeks + ML work)
- Risk Level: High (infra + GPU complexity)
- Expected ROI: High (enterprise readiness, client trust)

4) Event Schema & Output Validation (StatsBomb/Wyscout-compatible) (P0)
- Description: Define and enforce a standard event schema; validate ML outputs; produce StatsBomb/Wyscout exports.
- Business Impact: Interoperability with club tools and easier buyer evaluation.
- Technical Impact: Requires contract testing and ingestion validation; reduces downstream errors.
- Dependencies: Schema design, validators, ingestion pipeline changes, frontend mapping.
- Effort Estimate: Medium (2–3 dev-weeks)
- Risk Level: Low
- Expected ROI: High (sales enablement, integrations)

5) Human-in-the-loop Correction UI & Audit Trail (P0)
- Description: UI for manual correction of tracks/events with delta storage, versioning and audit logging.
- Business Impact: Enables customers to trust automated output and improve models with labeled corrections.
- Technical Impact: Adds operational workflow and data feedback loop for ML.
- Dependencies: Frontend editor, API endpoints for corrections, DB schema (corrections/audit), auth controls.
- Effort Estimate: Large (4–6 dev-weeks)
- Risk Level: Medium
- Expected ROI: High (retention, upsell for manual credit features)

6) Secure Authentication & RBAC (P0)
- Description: Implement secure refresh tokens via HttpOnly cookies, refresh rotation, RBAC middleware and token revocation.
- Business Impact: Enterprise security compliance; reduces account/session risk for clients.
- Technical Impact: Changes auth flows; impacts frontend token storage and API middleware.
- Dependencies: Auth service changes, cookie handling on client, migration plan for existing sessions.
- Effort Estimate: Medium (2–3 dev-weeks)
- Risk Level: Medium
- Expected ROI: High (enterprise trust)

7) Artifact Storage Strategy & Per-frame Offload (P0)
- Description: Store raw per-frame detections and large ML artifacts in object storage (Parquet/NDJSON), keep aggregated summaries in MongoDB.
- Business Impact: Scales storage cost-effectively and enables analytics performance.
- Technical Impact: Migration of existing outputs; new ingestion/storage paths and lifecycle policies.
- Dependencies: S3/MinIO, ingestion service, migration script.
- Effort Estimate: Medium (3–4 dev-weeks)
- Risk Level: Medium
- Expected ROI: High (cost control, query performance)

8) Clip / Highlight Generation & Export (P1)
- Description: Service to stitch clips, deduplicate, generate playlists and presigned download links; UI for playlist creation and sharing.
- Business Impact: Core scout & coach use-case — fast clip delivery for recruitment and review.
- Technical Impact: Video processing worker, storage and bandwidth considerations.
- Dependencies: Resumable uploads, S3, worker queue, frontend playlist UI.
- Effort Estimate: Medium (3–4 dev-weeks)
- Risk Level: Medium
- Expected ROI: High (monetizable feature)

9) Player Re-identification (P1)
- Description: Improve identity across matches using jersey-number OCR, appearance embeddings, and temporal heuristics.
- Business Impact: Crucial for longitudinal player scouting and aggregated metrics.
- Technical Impact: Additional ML components, labeled data, evaluation processes.
- Dependencies: ML dataset, ML infra (inference service), human-in-loop corrections for labeling.
- Effort Estimate: Large (6–10 dev-weeks + data)
- Risk Level: High
- Expected ROI: High (differentiator vs competitors)

10) Observability & Monitoring (P1)
- Description: Add Prometheus metrics, Grafana dashboards, structured logging, and Sentry error tracking for backend and workers.
- Business Impact: Faster incident detection & lower MTTR; SLA monitoring.
- Technical Impact: Instrumentation across services and dashboards; alerting.
- Dependencies: Monitoring stack (Prometheus/Grafana/Sentry), code instrumentation.
- Effort Estimate: Small–Medium (2–3 dev-weeks)
- Risk Level: Low
- Expected ROI: Medium (operational efficiency)

11) Automated Tests & CI/CD (P1)
- Description: Add unit, integration, E2E tests (Cypress), and CI pipelines for backend, frontend, and model deployments.
- Business Impact: Decreases regressions and accelerates delivery with confidence.
- Technical Impact: Requires test harnesses, fixtures, and coverage targets.
- Dependencies: CI provider (GitHub Actions), test frameworks, staging infra.
- Effort Estimate: Medium (3–4 dev-weeks)
- Risk Level: Low
- Expected ROI: High (development velocity)

12) Collaboration Features: Shares, Comments, Teams (P1)
- Description: Shareable playlists, comments on clips, team/org management and role controls.
- Business Impact: Improves product stickiness for clubs/coaches.
- Technical Impact: New UI patterns and backend permissioning.
- Dependencies: Auth/RBAC, clip export service, frontend work.
- Effort Estimate: Medium (3–4 dev-weeks)
- Risk Level: Medium
- Expected ROI: Medium–High (retention & upsell)

13) Aggregation & Query Performance (P1)
- Description: Precompute aggregated stats, add DB indexes, materialized views and caching for heavy queries.
- Business Impact: Faster analytics and better UX for large datasets.
- Technical Impact: DB schema updates and periodic jobs to populate aggregates.
- Dependencies: Artifact storage, job queue, DB admin access.
- Effort Estimate: Medium (2–3 dev-weeks)
- Risk Level: Low
- Expected ROI: Medium (user satisfaction)

14) Model Evaluation Pipeline & Labeling Tools (P1)
- Description: Build QA pipelines, evaluation dashboards, and light labeling tooling to collect ground truth from corrections.
- Business Impact: Drives model improvements and measurable quality for customers.
- Technical Impact: Data pipelines, storage for evaluations, integration with MLflow.
- Dependencies: Human correction UI, ML infra.
- Effort Estimate: Medium–Large (4–6 dev-weeks)
- Risk Level: Medium
- Expected ROI: High (accuracy increases => product value)

15) Secrets Management & Secure Deployment (P1)
- Description: Move secrets to Vault/AWS/Azure secret manager and inject via CI; enforce least privilege.
- Business Impact: Security posture required for enterprise customers.
- Technical Impact: CI/CD changes; credential rotation processes.
- Dependencies: Cloud provider secrets service, ops access.
- Effort Estimate: Small (1–2 dev-weeks)
- Risk Level: Low
- Expected ROI: Medium (security compliance)

16) Advanced Analytics (xG, Tactical Phases, Pass Networks) (P2)
- Description: Develop advanced models and visualizations (xG, possession phases, pass networks).
- Business Impact: High differentiation for analyst teams and commercial licensing.
- Technical Impact: New model research, heavy feature engineering, new UI components.
- Dependencies: Labeled datasets, ML infra, evaluation pipelines.
- Effort Estimate: Very Large (3–6+ months)
- Risk Level: High
- Expected ROI: High (enterprise sales & data licensing)

17) Multi-camera Stitching & Sync (P2)
- Description: Support multi-camera capture, sync and reconstruction to improve tracking accuracy.
- Business Impact: Broadens market to pro clubs and broadcasters; improves accuracy.
- Technical Impact: Complex video sync, multi-view geometry, time alignment.
- Dependencies: Hardware partners or capture protocol, ML research.
- Effort Estimate: Very Large (6+ months)
- Risk Level: Very High
- Expected ROI: High (enterprise & hardware revenue)

18) Mobile-first Native Review Apps (P2)
- Description: Native mobile apps for coaches to review clips offline and annotate.
- Business Impact: Increased adoption by coaches and academies.
- Technical Impact: New platforms, offline storage sync and auth flows.
- Dependencies: Clip export, share features, mobile engineers.
- Effort Estimate: Large (3–4 months)
- Risk Level: Medium
- Expected ROI: Medium (adoption growth)

---

RECOMMENDED IMPLEMENTATION ORDER (phased)

Phase A — Foundations (Weeks 0–8)
1. Resumable / Multipart Uploads (P0)
2. Durable Job Queue & Orchestration with DLQ (P0)
3. Artifact Storage Strategy & Per-frame Offload (P0)
4. Secure Authentication & RBAC (P0)
5. Observability & Monitoring (P1)
6. Secrets Management & Secure Deployment (P1)

Phase B — ML & Product Trust (Weeks 8–18)
7. ML Inference Service + Model Registry (P0)
8. Event Schema & Output Validation (P0)
9. Human-in-the-loop Correction UI & Audit Trail (P0)
10. Automated Tests & CI/CD (P1)
11. Model Evaluation Pipeline & Labeling Tools (P1)

Phase C — Productization (Weeks 18–32)
12. Clip / Highlight Generation & Export (P1)
13. Collaboration Features: Shares, Comments, Teams (P1)
14. Aggregation & Query Performance (P1)
15. Player Re-identification (P1)

Phase D — Strategic Differentiation (Months 8+)
16. Advanced Analytics (xG, Tactical Phases) (P2)
17. Multi-camera Stitching & Sync (P2)
18. Mobile-first Native Review Apps (P2)

Notes:
- Parallelize work where possible (e.g., Observability + Secrets + Queue infra).
- ML Inference Service needs concurrent ML engineer effort; begin model registry and infra early in Phase A to enable Phase B.
- Human-in-loop UI should be iterated early to collect labeled corrections feeding model improvements.

---

RISK MITIGATION & GOVERNANCE
- Start with a staging environment and data retention policy for test uploads.
- Add job quotas and admission control to avoid overload during rollout.
- Use feature flags to gate ML model changes and new features to subsets of users.
- Track KPIs: job success rate, median processing time, model precision/recall per event, upload success rate, and customer NPS.

---

EXPECTED ROI SUMMARY (high level)
- P0 bundle (uploads + queue + ML service + schema + corrections + auth) → Enterprise-readiness, immediate reduction in failure/support, core functionality for clubs/scouts. ROI: Very High within 3–6 months.
- P1 bundle (clips, re-id, observability, CI) → Productization and monetizable features. ROI: High within 6–12 months.
- P2 bundle (advanced analytics, multi-camera, mobile) → Differentiation and large enterprise/new market revenue. ROI: High but long lead time (12–24 months).

---

NEXT STEPS (immediate)
- Approve Phase A budget & staffing (backend, frontend, ML, DevOps, QA).
- Create sprint-level backlog with acceptance criteria and owners for the top 6 P0 items.
- Stand up staging infra (S3, Redis, MLflow) and instrument basic metrics.
