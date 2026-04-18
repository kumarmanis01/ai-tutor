-- Inspect migration record
SELECT id, migration_name, started_at, finished_at, rolled_back_at, applied_steps_count, logs
FROM _prisma_migrations
WHERE migration_name='20260416000000_add_student_concept_state'
ORDER BY started_at DESC
LIMIT 1;

-- Table existence
SELECT to_regclass('public."StudentConceptState"') AS regclass;

-- Foreign key constraints
SELECT conname, conrelid::regclass AS table, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conname IN ('StudentConceptState_studentId_fkey','StudentConceptState_conceptId_fkey');

-- Indexes
SELECT idx.relname AS indexname, pg_get_indexdef(idx.oid) AS indexdef
FROM pg_class idx
JOIN pg_index i ON idx.oid = i.indexrelid
JOIN pg_class tbl ON i.indrelid = tbl.oid
WHERE tbl.relname = 'StudentConceptState';
