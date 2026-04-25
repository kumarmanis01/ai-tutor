<!--
FILE OBJECTIVE:
- Zero-impact analytics instrumentation strategy: async batching, client-side
  delivery patterns, and backpressure guidelines for Spinzy AI Tutor.

This file has moved. See [docs/v2/analytics/analytics_performance.md](analytics/analytics_performance.md).

EDIT LOG:
 - 2026-04-21T00:00:00Z | copilot | created performance strategy doc
 - 2026-04-22T00:00:00Z | claude  | add FILE OBJECTIVE header per doc standards
-->

# Analytics Performance & Zero-Impact Instrumentation Strategy

Goal

- Ensure instrumentation has zero customer-perceived impact by removing analytics work from critical request paths and running all writes/forwarding asynchronously, batched, and rate-controlled.

Principles

- Non-blocking: do not perform synchronous DB or forwarding writes on request paths.
- Asynchronous batching: buffer events and write in bulk from dedicated workers.
- Client-first: use low-priority delivery (sendBeacon / requestIdleCallback / service worker background sync).
- Backpressure & graceful degradation: bounded queues, sampling, and controlled dropping of low-priority events under load.
- Privacy-first payloads: minimize metadata, use `prompt_hash` only, and strip PII before any external transmission.

Client-side patterns (web/mobile)

- Buffer & batch: keep an in-memory buffer; flush every N seconds (configurable, e.g. 5s) or when buffer size reaches threshold (e.g. 20 events).
- Background delivery: use `navigator.sendBeacon()` for page unload/visibilitychange; fallback to `fetch(..., { keepalive: true })` for single-event delivery.
- Idle delivery: call `requestIdleCallback()` for non-urgent events and fallback to a deferred `setTimeout` on browsers without support.
- SW / Background Sync: implement service-worker based delivery for PWAs to handle offline/retry without blocking UI.
- Debounce & dedupe: debounce rapid UI events (e.g., `subject_selected`) and dedupe unchanged sequential values.
- Sampling: sample very high-volume events (e.g., `page_view`) at a configurable rate.

Server-side patterns

- Fast-path ingestion: `POST /api/analytics/event` performs minimal validation and enqueues events to BullMQ/Redis; return HTTP 2xx immediately. Do not await DB writes.
- Post-response enqueue: where available (PM2 web server), prefer `res.on('finish')` to perform enqueue operations after response is sent.
- Durable queue fallback: if the queue is unavailable, record drop metrics and optionally persist to a small local ring buffer for later replay.
- Worker bulk writes: workers should use `prisma.createMany()` with configurable batch sizes (e.g., 500) and checkpoint progress to avoid duplicates.
- Table partitioning: partition `AnalyticsEvent` by day to keep insert and purge operations efficient.

Aggregator & Forwarder

- Separate processes: run aggregator and forwarder in separate PM2 worker processes with bounded concurrency.
- Forwarder rules: forward only sanitized or aggregated payloads, use idempotency keys, retries/backoff, and a circuit breaker.

Backpressure & drop policy

- Define operational thresholds (`QUEUE_MAX_DEPTH`, `DB_CPU_THRESHOLD`) to trigger sampling/dropping of low-priority events.
- Prioritise events: `admin_action`/`purchase`/`ai_call` > `diagnostic_*` > `page_view` (sampled).
- Expose `events_dropped` metric and alert on increased drop rates.

Monitoring & SLOs

- Instrument metrics: `events_received`, `events_queued`, `events_dropped`, `ingest_latency_ms_p50/p95/p99`, `queue_depth`, `worker_batch_latency_ms`, `forwarder_errors`.
- SLO: 99% of client-facing API responses should be returned before any instrumentation blocking path; operational target: instrumentation design adds no measurable client latency (response returned before instrumentation enqueues).
- Benchmarks: run load tests (k6/artillery) with instrumentation enabled vs disabled and assert no regression beyond configurable thresholds.

Testing & Acceptance

- Integration test: client -> ingestion endpoint -> event eventually present in DB after worker runs (use mocked queue in tests).
- Performance test: load test representative endpoints and ensure response-time delta < 1ms median and no adverse p99 increase.

Implementation steps (summary)

1. Add client instrumentation library (buffer, sendBeacon, idle callback, SW) and integrate for `subject_selected` and page-views.
2. Update `/api/analytics/event` to enqueue events and return immediately.
3. Configure BullMQ/Redis queue and worker for batched DB writes and rollups.
4. Add sampling/drop policy, monitoring metrics, and alerts.
5. Run performance benchmarks and tune until acceptance criteria met.

Decision: 2026-04-21T10:40:00Z | copilot | Performance strategy created and approved for the analytics pipeline. This is the canonical approach for ensuring zero customer-perceived impact from instrumentation.
