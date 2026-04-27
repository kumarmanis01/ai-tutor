# Retention Runbook — Analytics Events (Safe Run)

Purpose
- Safely prune raw `AnalyticsEvent` rows older than a configured threshold.
- Ensure no accidental removal of signals, suggestions, or audit logs.

Prerequisites
- Fresh DB snapshot taken immediately before any pruning.
- Staging run verified first.
- Ensure `lib/jobs/retention.pruneOldAnalyticsEvents` is available.

Dry-run steps (recommended)
1. Connect to staging DB snapshot and run a SELECT to preview rows that would be deleted:

```sql
SELECT COUNT(*) FROM "AnalyticsEvent" WHERE "createdAt" < now() - interval '90 days';
```

2. Spot-check a few rows:

```sql
SELECT id, createdAt, payload FROM "AnalyticsEvent" WHERE "createdAt" < now() - interval '90 days' LIMIT 10;
```

3. If counts look sane, run the pruning function in dry-run mode (if implemented) or run inside a transaction and roll back to confirm affected rows.

Safe deletion steps
1. Back up DB snapshot.
2. Run pruning with a small window first (e.g., `days=365` to exercise logic):

```js
// example node script
const { pruneOldAnalyticsEvents } = require('./lib/jobs/retention')
pruneOldAnalyticsEvents(365).then(r => console.log(r)).catch(console.error)
```

3. Verify counts and audit logs.
4. Gradually lower threshold to 90 days after confirmation.

Rollbacks
- Restore from DB snapshot if any accidental data loss occurs.

Notes
- Do NOT run automatic retention on production without running this exact process in staging first.
- Retention only removes `AnalyticsEvent` raw rows; other tables are untouched.
