# Agent Instructions — Scout Bridge Analytics

## Mission

Scout Bridge Analytics converts match footage into scouting and performance data. Code changes must preserve correctness across the React client, Express API, MongoDB persistence, Redis/BullMQ processing, Python computer-vision pipeline, media storage, and real-time Socket.IO updates.

## Repository map

- `client/`: React 18 application and role-based workspace UI.
- `server/app.js`: Express middleware and route composition.
- `server/server.js`: runtime startup, MongoDB, Socket.IO, storage/email checks, graceful shutdown.
- `server/controllers/`: product-domain request handlers.
- `server/routes/`: HTTP route definitions.
- `server/models/`: Mongoose schemas and persistence constraints.
- `server/services/`: audit, export, monitoring, notifications, billing.
- `server/utils/`: queues, storage, sockets, upload helpers, validation, event detection.
- `server/cv/`: Python computer-vision implementation.
- `server/scripts/analysisDaemon.js`: queued-video orchestration and stale lease recovery.
- `server/tests/` and `client/src/__tests__/`: automated tests.
- `.github/workflows/`: CI and scheduled backup workflows.

## Technology rules

### Client

Use React 18 and existing React Router patterns. Prefer existing shared components, hooks, contexts, guards, and utilities before introducing new abstractions.

Use route-level lazy loading for large pages. Keep authenticated pages behind `ProtectedRoute` and role-restricted surfaces behind `RoleGuard`.

### API

Keep Express route modules thin. Put domain logic in controllers/services/utils rather than creating large route handlers.

Validate and normalize external input. Preserve existing status-code semantics, especially upload validation and authentication errors.

Use the existing authentication, role guard, rate limit, Helmet, error tracking, audit, and storage helpers.

### Data

Use existing Mongoose models and indexes. Before changing a schema/index:

1. Identify existing reads/writes.
2. Check migration and duplicate-data implications.
3. Consider backward compatibility.
4. Add/update tests.

Never bypass the unique-analysis-per-video invariant.

### Analysis pipeline

Analysis is asynchronous. Treat the queue as the source of processing work and MongoDB video state/leases as the persistence boundary.

Do not make the HTTP request wait for expensive CV work unless the feature explicitly requires it.

Preserve:

- BullMQ retries/backoff
- dead-letter behavior
- bounded worker concurrency
- job timeout
- processing lease/heartbeat
- stale-job recovery
- graceful worker shutdown
- Socket.IO progress events

Prefer idempotent operations because jobs may be retried.

### Python/CV

Do not silently change model/runtime assumptions. The current production baseline is CPU-oriented.

When changing CV output:

- update result validation
- add regression fixtures/tests where practical
- preserve output compatibility
- document any model/dependency changes
- avoid unbounded memory use on long videos

### Storage

Use the existing storage abstraction rather than hard-coding filesystem or S3 calls in controllers.

Treat uploaded media as untrusted input. Validate type/size, avoid path traversal, and never expose service credentials to the browser.

### Real-time events

Use the existing Socket.IO event helper. Event names and payload shapes are application contracts; update client consumers and tests together.

## Coding standards

- Prefer small, focused functions.
- Reuse existing utilities.
- Avoid speculative abstractions.
- Handle errors explicitly.
- Avoid swallowing errors unless the failure is intentionally best-effort and logged/observable.
- Do not log secrets, JWTs, passwords, raw credentials, or unnecessary personal data.
- Keep comments focused on non-obvious invariants and operational behavior.

## Security rules

Never commit secrets.

For authentication, authorization, uploads, exports, billing, admin operations, or organization data, assume the caller is untrusted.

Check role/ownership boundaries server-side; client guards are not security controls.

Treat exports and reports as potentially sensitive.

## Testing requirements

For a bug fix, add a regression test when practical.

At minimum, run the relevant targeted suite. Before merging a broad change, run:

```bash
npm run test --prefix server
npm test --prefix client -- --watchAll=false
npm run build --prefix client
```

Also run the repository CI checks and Python syntax validation when CV code changes.

For analysis changes, consider the existing analysis/load-test scripts and worker-pool tests.

## Change workflow

1. Read the relevant implementation and tests.
2. State the invariant the change must preserve.
3. Make the smallest coherent change.
4. Add/update tests.
5. Run targeted checks.
6. Review the diff for security, data integrity, and backward compatibility.
7. Update documentation when behavior/configuration changes.

## Do not

- Do not rewrite the architecture merely to introduce a new pattern.
- Do not add a second queue system.
- Do not duplicate storage implementations.
- Do not create ad-hoc auth checks when existing middleware/guards cover the requirement.
- Do not make analysis processing synchronous in API request handlers.
- Do not remove failed-job diagnostics or dead-letter retention without an operational replacement.
- Do not weaken production startup validation.

## Definition of done

A change is ready when the implementation is tested, relevant CI checks pass, security/data-integrity implications are addressed, and documentation/configuration is updated when needed.
