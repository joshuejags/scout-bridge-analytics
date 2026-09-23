# API Reference

This document inventories the routes mounted by the current Express application. It intentionally lists paths and access boundaries rather than promising response examples that can drift from the controllers. For request fields, validation, and response details, see the route and controller source linked below.

Base path: `/api`

## Authentication

Unless noted as public, endpoints require a valid bearer token:

```http
Authorization: Bearer <token>
```

The first registered account is promoted to admin. Admin-only routes also require the authenticated account to have the `admin` role. See [auth middleware](server/middleware/auth.js).

## Health

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/health` | Public | API, MongoDB, Redis, and queue health summary |

The health route returns HTTP 200 when database and Redis connectivity checks pass, otherwise HTTP 503. Implementation: [server/app.js](server/app.js).

## Auth

| Method | Path | Access |
|---|---|---|
| POST | `/auth/register` | Public |
| POST | `/auth/login` | Public |
| GET | `/auth/me` | Authenticated |
| GET | `/auth/users` | Admin |
| PATCH | `/auth/users/:id/role` | Admin |
| POST | `/auth/verify-email` | Public |
| POST | `/auth/resend-verification` | Authenticated |
| POST | `/auth/forgot-password` | Public |
| POST | `/auth/reset-password` | Public |

Source: [server/routes/authRoutes.js](server/routes/authRoutes.js).

## Videos

| Method | Path | Access |
|---|---|---|
| POST | `/videos/upload` | Authenticated |
| POST | `/videos/import-url` | Authenticated |
| POST | `/videos/upload/init` | Authenticated |
| POST | `/videos/upload/:uploadId/chunk` | Authenticated |
| GET | `/videos/upload/:uploadId/status` | Authenticated |
| POST | `/videos/upload/:uploadId/complete` | Authenticated |
| POST | `/videos/upload/presign-multipart/init` | Authenticated |
| POST | `/videos/upload/presign-multipart/complete` | Authenticated |
| POST | `/videos/upload/presign-multipart/:uploadId/abort` | Authenticated |
| GET | `/videos` | Authenticated |
| GET | `/videos/:id` | Authenticated |
| DELETE | `/videos/:id` | Admin |

The upload routes support ordinary upload, resumable chunk upload, optional S3 multipart upload, and URL import. Exact file limits and accepted fields are enforced by the route and controller. Source: [server/routes/videoRoutes.js](server/routes/videoRoutes.js).

## Analysis

| Method | Path | Access |
|---|---|---|
| POST | `/analysis/:videoId/process` | Authenticated; video owner or admin |
| GET | `/analysis/:videoId/status` | Authenticated; video owner or admin |
| GET | `/analysis/:videoId` | Authenticated; video owner or admin |
| PATCH | `/analysis/:analysisId/tracks/:trackId` | Authenticated; analysis access checked by controller |
| POST | `/analysis/:analysisId/tracks/merge` | Authenticated; analysis access checked by controller |

Analysis requests are queued and return an accepted response; use the status route or Socket.IO events for progress. Track routes support identity corrections and merging. Source: [server/routes/analysisRoutes.js](server/routes/analysisRoutes.js).

## Players and teams

| Method | Path | Access |
|---|---|---|
| GET, POST | `/players` | Authenticated |
| GET | `/players/overview` | Authenticated |
| GET | `/players/compare` | Authenticated |
| GET | `/players/:id` | Authenticated |
| GET | `/players/:id/profile` | Authenticated |
| PUT | `/players/:id` | Authenticated |
| DELETE | `/players/:id` | Admin |
| GET, POST | `/teams` | Authenticated |
| GET | `/teams/overview` | Authenticated |
| GET, PUT | `/teams/:id` | Authenticated |
| DELETE | `/teams/:id` | Admin |

Sources: [player routes](server/routes/playerRoutes.js), [team routes](server/routes/teamRoutes.js).

## Scouting, reports, and saved filters

| Method | Path | Access |
|---|---|---|
| GET | `/scouting/board` | Admin or scout |
| POST | `/scouting/targets` | Admin or scout |
| PATCH | `/scouting/targets/:id` | Admin or scout |
| DELETE | `/scouting/targets/:id` | Admin or scout |
| GET | `/reports/saved` | Authenticated |
| POST | `/reports/saved` | Authenticated |
| PATCH | `/reports/saved/:id` | Authenticated |
| GET | `/reports/saved/:id/export` | Authenticated |
| DELETE | `/reports/saved/:id` | Authenticated |
| GET, POST | `/filter-presets` | Authenticated |
| PATCH, DELETE | `/filter-presets/:id` | Authenticated |

Sources: [scouting routes](server/routes/scoutingRoutes.js), [report routes](server/routes/reportRoutes.js), [filter preset routes](server/routes/filterPresetRoutes.js).

## Admin operations

All routes require the admin role.

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/summary` | Platform summary |
| GET | `/admin/jobs?state=queued` | List video jobs, optionally filtered by state |
| POST | `/admin/jobs/:id/retry` | Requeue a failed video |
| GET | `/admin/dead-letter-jobs?limit=50&offset=0` | Paginated summary of exhausted BullMQ jobs |

Dead-letter summaries include the related video ID, original queue job identifiers, attempt count, failure reason, and failure timestamp. They omit the original payload and local video path. The dead-letter endpoint returns HTTP 503 when Redis is unavailable.

Source: [server/routes/adminRoutes.js](server/routes/adminRoutes.js).

## Other mounted route groups

These authenticated route groups are mounted by [server/app.js](server/app.js). Follow the linked route file for validation and controller behavior.

- Organizations: `/organizations` — [routes](server/routes/organizationRoutes.js)
- Notifications: `/notifications` — [routes](server/routes/notificationRoutes.js)
- Subscription and billing: `/subscription` — [routes](server/routes/subscriptionRoutes.js)
- Audit: `/audit` — [routes](server/routes/auditRoutes.js)
- Exports: `/exports` — [routes](server/routes/exportRoutes.js)
- Monitoring: `/monitoring` — [routes](server/routes/monitoringRoutes.js)

## Route source of truth

Route lists can change with the implementation. The Express mounts are in [server/app.js](server/app.js); route-level validation and access controls are in [server/routes](server/routes/), and request handling is in [server/controllers](server/controllers/).
