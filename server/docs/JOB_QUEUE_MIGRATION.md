# Analysis Queue Operations

## How analysis is processed

The analysis daemon claims videos whose MongoDB status is `queued`. It submits each claimed video to the shared worker-pool interface, which uses BullMQ and Redis when Redis is available. BullMQ workers run the Python CV worker, and the daemon persists the result through `persistAnalysis()`.

The worker-pool wrapper selects its in-memory fallback during initialization only, when Redis/BullMQ cannot be reached. It is enabled outside production unless `DISABLE_FALLBACK_MODE=true`; in production, fallback is disabled by default, so unavailable Redis causes initialization to fail and the daemon marks the video failed. Once BullMQ is active, submission or runtime errors are surfaced to the caller instead of starting a second in-memory run, because the Redis job may already be queued or running. The in-memory fallback does not provide Redis durability or retry guarantees.

Relevant implementation:

- [Analysis daemon](../scripts/analysisDaemon.js)
- [Worker-pool wrapper](../utils/analysisWorkerPool.js)
- [BullMQ queue and worker](../utils/bullmqQueue.js)
- [Analysis persistence](../controllers/analysisController.js)

## Job lifecycle and retries

BullMQ queue defaults are configured in `server/utils/bullmqQueue.js`:

- Queue name: `analysis`
- Worker concurrency: `ANALYSIS_WORKER_POOL_SIZE` (default 2)
- Attempts: `ANALYSIS_JOB_MAX_ATTEMPTS` (default 3)
- Retry backoff: exponential, starting at 2 seconds
- Job timeout: `ANALYSIS_JOB_TIMEOUT` (default 30 minutes)
- Successful analysis jobs are retained for one hour; failed analysis jobs remain in the source queue for inspection.

When an analysis job exhausts its attempts, the worker copies a failure record into the separate `analysis-dead-letter` queue. The record includes the original queue/job identifiers, video ID when available, original job name, attempts made, failure reason, timestamp, and the job data needed to investigate the failure. The admin API deliberately returns a summary only and does not expose the payload or local video path.

The dead-letter copy uses a deterministic ID derived from the original job ID, so repeated final-failure events do not create multiple copies. Dead-letter entries are added in the waiting state. The code does not currently provide a dead-letter replay or purge endpoint; do not retry the raw BullMQ job directly.

## Admin inspection and retry

Admins can inspect summaries through:

```http
GET /api/admin/dead-letter-jobs?limit=50&offset=0
Authorization: Bearer <admin-token>
```

The response includes the related video ID, original job identifiers, attempts, failure reason, timestamp, page size, offset, and total count. `limit` is 1–100; `offset` must be a non-negative integer. If Redis is unavailable, the route returns HTTP 503.

To retry a failed video, use the existing admin video-job endpoint:

```http
POST /api/admin/jobs/:videoId/retry
Authorization: Bearer <admin-token>
```

This marks the video record `queued` and clears its last error. The analysis daemon then claims it and creates a new analysis job through the normal path. The old dead-letter entry remains as an investigation record. A video already marked `processing` cannot be retried.

## Configuration

| Variable | Default | Purpose |
|---|---:|---|
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_DB` | `0` | Redis database |
| `REDIS_PASSWORD` | unset | Optional Redis password |
| `DISABLE_FALLBACK_MODE` | `false` | Set to `true` to reject in-memory fallback in development too; production already disables fallback by default |
| `ANALYSIS_WORKER_POOL_SIZE` | `2` | Concurrent analysis workers |
| `ANALYSIS_JOB_MAX_ATTEMPTS` | `3` | BullMQ attempts before dead-letter copy |
| `ANALYSIS_JOB_TIMEOUT` | `1800000` | Maximum execution time after a Python worker starts a job; the worker is stopped and BullMQ can retry it (milliseconds) |
| `ANALYSIS_QUEUE_MAX` | `20` | In-memory fallback queue limit |

Production deployments should provide a reachable Redis service. The queue's local defaults are for development; they are not a managed production Redis configuration.

## Monitoring and recovery

- `GET /api/health` checks MongoDB and Redis and includes queue counts when Redis is available.
- The worker and queue emit progress and failure details to application logs. A running Python process is terminated when it exceeds `ANALYSIS_JOB_TIMEOUT`; the error is handled as a failed BullMQ attempt and follows normal retry/backoff behavior.
- `GET /api/admin/summary` and `GET /api/admin/jobs` provide existing admin views of system and video-job state.
- `GET /api/admin/dead-letter-jobs` lists terminal analysis failures without returning local file paths.
- Recover work by retrying the associated failed video through the admin endpoint. If no video ID is present (for older jobs), use the source job ID and service logs to investigate before taking action.

## Operational notes

- Preserve Redis data during routine deploys; it holds waiting, active, and delayed jobs.
- Keep Redis access restricted to the application and trusted operators.
- Analysis results are protected by a unique `Analysis.video` index. See the [duplicate analysis cleanup instructions](../../README.md#analysis-reliability-and-operations) before deploying that index to an older database with potential duplicate records.
- See [backup strategy](BACKUP_STRATEGY.md) for MongoDB backup and restore procedures.
