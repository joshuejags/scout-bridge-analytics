# Production Runbook — Scout Bridge Analytics

## Purpose

This document defines the production operating baseline for Scout Bridge Analytics: deployment, configuration, health checks, background analysis, storage, observability, backups, recovery, and release safety.

## Production topology

```
Internet
   |
   v
HTTPS reverse proxy / platform ingress
   |
   +--------------------+
   | Node/Express API   |----> MongoDB
   | + Socket.IO        |----> Redis
   +--------------------+         |
            |                     v
            |              BullMQ analysis queue
            |                     |
            v                     v
     Client static build   Python CV worker
            |
            v
       S3-compatible
       media/artifacts
```

The repository currently supports a combined Docker deployment as well as platform-specific deployment guidance. The application can serve the built React client from the Node process when a client build is present.

## Required production services

- Node.js/Express API
- React production build
- MongoDB 6+
- Redis
- Python CV runtime with CPU-compatible PyTorch, YOLO/OpenCV/EasyOCR dependencies
- FFmpeg and CV runtime dependencies
- Persistent object/media storage: S3-compatible storage is preferred for production
- HTTPS ingress/reverse proxy
- Optional Sentry
- Optional Resend/SMTP for email
- Optional Cloudflare Tunnel where documented

## Production configuration

Use `.env.example`, `ENV_CONFIGURATION.md`, and deployment-specific examples as the source of truth for environment variables.

Critical requirements:

- Set a strong, unique `JWT_SECRET`; production startup rejects a missing secret.
- Set `NODE_ENV=production`.
- Set `CLIENT_URL` to the canonical frontend HTTPS origin. Production startup rejects a missing or malformed value.
- Configure `MONGODB_URI` and Redis connection variables.
- Configure `STORAGE_BACKEND=s3` and S3-compatible credentials for durable production media when appropriate.
- Configure analysis controls: `ANALYSIS_WORKER_POOL_SIZE`, `ANALYSIS_JOB_TIMEOUT`, `ANALYSIS_JOB_MAX_ATTEMPTS`.
- Configure `RATE_LIMIT_IP_HEADER` only when the deployment's trusted reverse proxy supplies the client IP through that header.
- Never commit real secrets, API keys, tokens, or credentials.

## Release procedure

1. Open a branch for the release.
2. Run the full server test suite.
3. Run client tests and the production client build.
4. Validate Python syntax and CV dependencies.
5. Review schema/index migrations and backup requirements.
6. Deploy the immutable build/container.
7. Verify API health, authentication, database connectivity, Redis connectivity, storage connectivity, email connectivity where enabled, and Socket.IO connectivity.
8. Submit a controlled analysis job and confirm queued → processing → completed/failed state transitions.
9. Verify monitoring and logs.
10. Keep rollback artifacts available.

## Analysis production controls

BullMQ is the durable job queue for analysis. Defaults in code include:

- Analysis queue retries with exponential backoff.
- A separate `analysis-dead-letter` queue for exhausted jobs.
- Failed jobs retained for investigation.
- Bounded worker concurrency.
- A long-running job timeout.
- Video-level processing leases and heartbeats.
- Recovery of stale processing jobs.
- Atomic persistence of analysis results.

Operators should inspect the dead-letter queue before repeatedly retrying systemic failures.

## Database safety

The `Analysis.video` uniqueness requirement means older databases must be checked for duplicates before the unique index is enforced.

Before cleanup:

- Take a verified backup.
- Pause API/analysis writers if the migration requires it.
- Run `node server/scripts/dedupeAnalyses.js` in dry-run mode.
- Review the proposed deletions.
- Use `--apply` only after backup verification and change approval.

Database backup/restore procedures are documented separately in the existing backup strategy documentation and GitHub Actions backup workflow.

## Storage

Local disk storage is suitable for development and limited deployments. Production media should use durable object storage when horizontal scaling, instance replacement, or large media volumes are expected.

For S3-compatible storage:

- Verify bucket reachability at startup.
- Use least-privilege credentials.
- Keep media buckets private where possible.
- Prefer presigned access rather than exposing bucket credentials to browsers.
- Configure lifecycle cleanup for abandoned multipart uploads.
- Do not place local filesystem paths in client-visible dead-letter metadata.

## Observability

At minimum monitor:

- API availability and error rate
- Request latency
- MongoDB connection health
- Redis availability
- Analysis queue depth
- Analysis processing duration
- Failed/dead-letter job counts
- Worker CPU and memory
- Upload failures
- Storage errors
- Socket.IO connection failures
- Email delivery failures

Sentry is optional and should receive unexpected server/client exceptions, not routine client-input validation errors.

## Incident response

### API unavailable

Check platform/container health, startup logs, MongoDB connectivity, environment validation, and recent deployment changes.

### Analysis backlog

Check Redis, worker concurrency, CPU saturation, queue depth, Python process failures, and dead-letter growth.

### Stuck processing jobs

Inspect video processing lease timestamps and allow the stale-job recovery logic to requeue abandoned jobs. Do not manually duplicate analysis records.

### Database issue

Stop writes when needed, verify the latest backup, assess connection/index health, then follow the restore/upgrade runbook.

### Storage issue

Verify credentials, bucket reachability, endpoint/region configuration, and multipart cleanup. Avoid deleting media records until the storage state is understood.

## Rollback

Rollback to the last known-good application image/build when the release causes an application-level regression. For database changes, follow the migration's rollback strategy; do not assume application rollback alone reverses schema changes.

## Security baseline

Use HTTPS, secure cookies/tokens according to the application auth model, strong secrets, rate limiting, Helmet, validated input, role guards, least privilege, private media storage, audit logging, and regular dependency/security updates.

Production access should be restricted to required operators and service identities.
