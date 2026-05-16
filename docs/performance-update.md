<!--
FILE OBJECTIVE:
- Summarise investigation, findings, and remediation work for high-latency auth/profile DB hotpaths.

LINKED UNIT TEST:
- tests/unit/docs/performance-update.spec.ts

COPILOT INSTRUCTIONS FOLLOWED:
- .github/copilot-instructions.md
- /docs/ENGINEERING_PRACTICES.md

EDIT LOG:
- 2026-05-16T00:00:00Z | copilot | created performance update with findings and implementation steps
-->

# Performance update: auth / profile latency investigation

Date: 2026-05-16

Summary
-------
- This document captures the investigative steps, findings, and remediation implemented to address repeated high-latency requests observed on session/profile endpoints during local dev runs. The work focused on tightening Prisma selects, adding a short-lived Redis cache for session→user lookups, invalidating the cache on profile/onboarding changes, and adding observability (Prometheus counters and timing logs).

Findings
--------
- Multiple high-traffic endpoints repeatedly executed broad `prisma.user.findUnique` queries that returned large user rows. This increased DB CPU, transfer size, and response time.
- NextAuth JWT callback performed user DB fetches on every invocation, causing repeated DB load on session checks.
- The `GET /api/auth/session` and related flows (NextAuth route) lacked granular per-stage timing instrumentation, making root-cause attribution difficult.
- There were no short-lived session->user caches to absorb bursts of repeated session validation calls.

Implemented fixes (ordered)
---------------------------
1) Select-tightening on hotspots
   - Replaced broad `findUnique` / `findFirst` usages with minimal `select` shapes in high-traffic handlers so only required fields are fetched.
   - Files updated include:
     - [app/api/user/profile/route.ts](app/api/user/profile/route.ts)
     - [app/api/user/onboarding/route.ts](app/api/user/onboarding/route.ts)
     - [app/api/user/language/route.ts](app/api/user/language/route.ts)
     - [app/(public)/dev-login/route.ts](app/(public)/dev-login/route.ts)
     - [app/api/free-questions/route.ts](app/api/free-questions/route.ts)
     - reduced selects in `lib/auth.ts` (`maybeSendWelcomeEmail`)

2) Short-lived Redis cache for JWT callback
   - Instrumented the NextAuth `jwt` callback in `lib/auth.ts` to:
     - attempt a Redis read for `session:user:<lowercased-email>` and populate token fields on hit,
     - on miss, perform a tight `prisma.user.findUnique({ select: { id, role, accountStatus, ... }})`, set a short TTL (30s) cache, and proceed.
   - Added logging events: `jwt.cache.hit`, `jwt.cache.set`, `jwt.db.fetch`, `jwt.timing`.
   - File updated: [lib/auth.ts](lib/auth.ts)

3) Cache invalidation on writes (onboarding/profile/language)
   - After successful profile updates or onboarding saves, perform a best-effort `redis.del('session:user:<email>')` so the JWT callback reloads fresh profile state immediately.
   - Implemented as non-blocking best-effort with warnings on failure.
   - Files updated:
     - [app/api/user/profile/route.ts](app/api/user/profile/route.ts)
     - [app/api/user/onboarding/route.ts](app/api/user/onboarding/route.ts)
     - [app/api/user/language/route.ts](app/api/user/language/route.ts)

4) Observability: Prometheus counters for jwt cache
   - Added counters `auth_jwt_cache_hits_total` and `auth_jwt_cache_misses_total` in the central metrics module and wired increments from the JWT callback.
   - File updated: [lib/metrics.ts](lib/metrics.ts)

Other small improvements
----------------------
- Tightened `select` usage in developer-only helper [app/(public)/dev-login/route.ts](app/(public)/dev-login/route.ts) to reduce accidental heavy queries in dev runs.
- Reduced DB fields requested in `maybeSendWelcomeEmail` (in `lib/auth.ts`) to only the flag needed.

Files changed (summary)
-----------------------
- app/api/user/profile/route.ts — narrowed `select` and added Redis invalidation on PATCH
- app/api/user/onboarding/route.ts — narrowed `select`, included `email` in selects, and added Redis invalidation after onboarding updates
- app/api/user/language/route.ts — select-tightening and cache invalidation on POST
- app/api/free-questions/route.ts — narrowed `select` for `todaysFreeQuestionsCount`
- app/(public)/dev-login/route.ts — narrowed `select` for dev-login user lookup
- lib/auth.ts — added Redis lookup/set in `jwt` callback, added jwt timing logs, tightened `maybeSendWelcomeEmail` select, wired metric increments
- lib/metrics.ts — added `auth_jwt_cache_hits_total` and `auth_jwt_cache_misses_total` counters and exported increment functions

Testing & verification
----------------------
- Local dev repro steps used during changes:
  1. Start dev server:

     ```powershell
     npm run dev
     ```

  2. Reproduce requests used in investigation:
     - `GET /api/auth/session`
     - `GET /api/user/profile`

  3. Observe logs (console) for new log lines: `jwt.cache.set`, `jwt.cache.hit`, `jwt.db.fetch`, `jwt.timing`, and `session.cache.invalidated` after profile/onboarding updates.

- Prometheus metrics endpoint (project has shared metrics server scripts). To run local metrics server:

  ```powershell
  npm run metrics:server
  ```

  Then inspect counters `auth_jwt_cache_hits_total` and `auth_jwt_cache_misses_total` via Prometheus or the metrics endpoint.

Notes on safety & behaviour
--------------------------
- Cache TTL chosen: 30 seconds — balances immediate read-after-write consistency (invalidation performed on writes) and DB load reduction for bursty session checks.
- Cache invalidation is best-effort and non-blocking; if Redis is unavailable the system falls back to DB fetches and logs a warning.
- All DB select changes aim to request only fields required by the handler; if a future handler needs additional fields, extend the `select` explicitly rather than reverting to broad row fetches.

Next recommended steps (prioritised)
----------------------------------
1. Expand select-tightening to all remaining `prisma.user.findUnique` occurrences across the repo, prioritising API endpoints used by the client (dashboard, recommendations, topbar-stats, subscription flows).
2. Add unit/integration tests covering cache invalidation behaviour (happy path + Redis unavailable) and metric increments. Update linked tests under `tests/unit/` to assert `incJwtCacheHit`/`incJwtCacheMiss` invocations.
3. Instrument Prometheus-backed dashboards/alerts for auth_jwt_cache_misses_total / high jwt.db.fetch duration to detect regressions.
4. Run a controlled load test hitting `/api/auth/session` and `/api/user/profile` to measure reduction in DB QPS and latency.

Appendix — useful links
----------------------
- Auth flow: [lib/auth.ts](lib/auth.ts)
- Profile endpoint: [app/api/user/profile/route.ts](app/api/user/profile/route.ts)
- Onboarding endpoint: [app/api/user/onboarding/route.ts](app/api/user/onboarding/route.ts)
- Metrics centre: [lib/metrics.ts](lib/metrics.ts)

If you want, I can:
- continue tightening the remaining `prisma.user.findUnique` calls across the repo (I can run a grep and PR changes), or
- run the dev server here and exercise endpoints to capture before/after latency screenshots and metric samples.

-- End of report
