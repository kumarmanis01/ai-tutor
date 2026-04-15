SELECT id, checksum, migration_name, started_at, finished_at, applied_steps_count, logs
FROM _prisma_migrations
ORDER BY started_at DESC
LIMIT 20;
