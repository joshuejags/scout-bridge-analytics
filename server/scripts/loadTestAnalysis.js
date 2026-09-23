#!/usr/bin/env node

/**
 * Repeatable load test for POST /api/analysis/:videoId/process.
 *
 * Usage:
 *   BASE_URL=http://localhost:5000/api \
 *   AUTH_TOKEN='<jwt>' \
 *   VIDEO_IDS='id1,id2,id3,...' \
 *   TOTAL_REQUESTS=100 CONCURRENCY=25 \
 *   node server/scripts/loadTestAnalysis.js
 *
 * Important:
 * - Use one unique uploaded video ID per intended analysis submission.
 * - Reusing one VIDEO_ID measures idempotency/duplicate protection, not worker
 *   throughput, because the API intentionally returns 202 for an already
 *   queued/processing video.
 * - This script measures API admission latency only. It does not wait for
 *   Python CV analysis to finish.
 */

const axios = require('axios');

const BASE_URL = (process.env.BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const AUTH_TOKEN = process.env.AUTH_TOKEN;
const VIDEO_IDS = (process.env.VIDEO_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

const TOTAL_REQUESTS = Math.max(1, Number(process.env.TOTAL_REQUESTS || 50));
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY || 10));
const TIMEOUT_MS = Math.max(1000, Number(process.env.TIMEOUT_MS || 30000));

if (!AUTH_TOKEN) {
  console.error('Missing AUTH_TOKEN.');
  process.exit(1);
}

if (!VIDEO_IDS.length) {
  console.error('Missing VIDEO_IDS. Provide comma-separated uploaded video IDs.');
  process.exit(1);
}

const percentile = (values, p) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
};

const run = async () => {
  const results = [];
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= TOTAL_REQUESTS) return;

      const videoId = VIDEO_IDS[index % VIDEO_IDS.length];
      const started = process.hrtime.bigint();

      try {
        const response = await axios.post(
          `${BASE_URL}/analysis/${videoId}/process`,
          {},
          {
            timeout: TIMEOUT_MS,
            headers: {
              Authorization: `Bearer ${AUTH_TOKEN}`,
            },
            validateStatus: () => true,
          }
        );

        const latencyMs = Number(process.hrtime.bigint() - started) / 1e6;
        results.push({
          status: response.status,
          latencyMs,
          code: response.data?.code || null,
        });
      } catch (error) {
        const latencyMs = Number(process.hrtime.bigint() - started) / 1e6;
        results.push({
          status: 0,
          latencyMs,
          code: error.code || 'REQUEST_ERROR',
        });
      }
    }
  };

  const workerCount = Math.min(CONCURRENCY, TOTAL_REQUESTS);
  await Promise.all(Array.from({ length: workerCount }, worker));

  const latencies = results.map((r) => r.latencyMs);
  const statusCounts = results.reduce((acc, result) => {
    const key = String(result.status);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const codeCounts = results.reduce((acc, result) => {
    if (result.code) acc[result.code] = (acc[result.code] || 0) + 1;
    return acc;
  }, {});

  console.log('\nScout Bridge analysis API load test');
  console.log('-----------------------------------');
  console.log(`Base URL:        ${BASE_URL}`);
  console.log(`Requests:        ${results.length}`);
  console.log(`Concurrency:     ${workerCount}`);
  console.log(`Video IDs:       ${VIDEO_IDS.length}`);
  console.log(`Unique-ID mode:  ${VIDEO_IDS.length >= TOTAL_REQUESTS ? 'yes' : 'no'}`);
  console.log('');
  console.log('HTTP status counts:', statusCounts);
  console.log('Application codes:', codeCounts);
  console.log(`Latency p50:      ${percentile(latencies, 50).toFixed(1)} ms`);
  console.log(`Latency p95:      ${percentile(latencies, 95).toFixed(1)} ms`);
  console.log(`Latency p99:      ${percentile(latencies, 99).toFixed(1)} ms`);
  console.log(`Latency max:      ${Math.max(...latencies).toFixed(1)} ms`);

  const accepted = results.filter((r) => r.status === 202).length;
  const throttled = results.filter((r) => r.status === 429).length;
  const errors = results.filter((r) => r.status >= 500 || r.status === 0).length;

  console.log('');
  console.log(`Accepted (202):   ${accepted}`);
  console.log(`Throttled (429):  ${throttled}`);
  console.log(`Server/errors:    ${errors}`);

  if (VIDEO_IDS.length < TOTAL_REQUESTS) {
    console.log(
      '\nNOTE: fewer video IDs than requests means duplicate protection may dominate the results. ' +
        'Use unique uploaded video IDs to measure queue admission under load.'
    );
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
