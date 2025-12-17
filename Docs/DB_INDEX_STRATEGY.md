# DB Index Strategy — ExecutionJob

Summary
-------
This document explains the index choices for the `ExecutionJob` table which powers the admin Jobs API and cursor pagination.

Goals
-----
- Make admin queries (filters + cursor pagination) fast and predictable.
- Minimize accidental full-table scans.
- Keep indexing focused and explained so DBAs and future contributors can reason about tradeoffs.

Indexes Added
-------------
- `@@index([createdAt])` (SQL: `ExecutionJob_createdAt_idx`)
  - Purpose: cursor pagination and range queries (createdAfter / createdBefore).
  - Rationale: Cursor uses `createdAt` as the primary ordering dimension for stable descending pagination.

- `@@index([status, createdAt])` (SQL: `ExecutionJob_status_createdAt_idx`)
  - Purpose: efficient filtering by `status` while ordering by `createdAt`.
  - Rationale: Admins commonly filter by job status (failed/pending) and sort newest-first.

- `@@index([jobType, createdAt])` (SQL: `ExecutionJob_jobType_createdAt_idx`)
  - Purpose: filter by `jobType` and sort by `createdAt`.

- `@@index([entityType, createdAt])` (SQL: `ExecutionJob_entityType_createdAt_idx`)
  - Purpose: filter by `entityType` (BOARD/CLASS/SUBJECT/TOPIC) with createdAt ordering.

- `@@index([entityId])` (SQL: `ExecutionJob_entityId_idx`)
  - Purpose: direct lookups by `entityId` (search by entity id).

- Optional composite: `@@index([status, jobType, createdAt])` (SQL: `ExecutionJob_status_jobType_createdAt_idx`)
  - Purpose: support high-volume queries that filter by both status and jobType. Create only if query telemetry justifies it.

Why createdAt is required for cursor pagination
--------------------------------------------
Cursor pagination depends on a stable sort key. Using `createdAt` (with a tie-breaker on `id`) ensures consistent ordering even when new rows are inserted. Indexing `createdAt` makes range scans (e.g., all jobs before a given timestamp) efficient and reduces IO for pagination.

Why we index filter dimensions (status, jobType, entityType)
-----------------------------------------------------------
Admin UIs frequently filter by these dimensions. Indexing them (often combined with `createdAt`) enables the database to filter and then read the most recent results without scanning the full table.

Why payload JSON is intentionally excluded
-----------------------------------------
- JSON path queries (e.g., payload->>'topicId') are expressive but often slow and non-indexed by default.
- Adding JSON-path indexes is DB-specific and can complicate the data model and migrations.
- We prefer denormalization: if admins need to search on `payload.topicId` frequently, add a dedicated column (e.g., `entitySubId` or `topicId`) and index it. That keeps queries simple and performant.

When to denormalize payload fields
----------------------------------
Denormalize when all the following are true:
- The field is frequently queried (e.g., search by topicId > 1% of queries).
- The field is stable (doesn't change often) or updates are acceptable.
- There's a clear mapping from payload to a typed column (e.g., `topicId`, `chapterId`).

Recommended next steps after deploying indexes
---------------------------------------------
1. Monitor query patterns and slow queries for `/api/admin/content-engine/jobs`.
2. If searches for `topicId` appear frequently, add `entitySubId` or `topicId` as a first-class column and index it.
3. Consider creating a small `admin_meta` endpoint that returns valid `jobType` and `entityType` values for UI dropdowns.

Notes about the migration
-------------------------
- Migration SQL was added at `prisma/migrations/20251217_add_executionjob_indexes/migration.sql`.
- This migration uses `CREATE INDEX IF NOT EXISTS` to be idempotent on Postgres.
- Do NOT add indexes until you have run the migration in the target environment and validated briefly in staging.
