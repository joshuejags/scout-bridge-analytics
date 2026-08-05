# Analysis Daemon

This repository includes `server/scripts/analysisDaemon.js`, a small durable
queue worker that claims `Video` documents with `status: 'queued'` from
MongoDB and runs the analysis job via the existing in-process
`analysisWorkerPool` (which manages Python child processes). It ensures
jobs survive server restarts because the queued state is persisted in
MongoDB rather than kept in memory.

Run locally:

```bash
npm run analysis-daemon
```

The daemon exports `processNextJob()` for unit tests.
