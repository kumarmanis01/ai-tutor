-- F-ADM-002 AC-03: ConceptHistory tracks admin edits to IRT parameters and prerequisites.

CREATE TABLE IF NOT EXISTS "ConceptHistory" (
  "id"                 TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "conceptId"          TEXT        NOT NULL,
  "adminId"            TEXT        NOT NULL,
  "reason"             TEXT        NOT NULL,
  "previousIrtB"       DOUBLE PRECISION,
  "newIrtB"            DOUBLE PRECISION,
  "previousPrereqIds"  TEXT[]      NOT NULL DEFAULT '{}',
  "newPrereqIds"       TEXT[]      NOT NULL DEFAULT '{}',
  "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ConceptHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ConceptHistory_conceptId_fkey"
    FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_concepthistory_conceptid ON "ConceptHistory" ("conceptId");
CREATE INDEX IF NOT EXISTS idx_concepthistory_createdat ON "ConceptHistory" ("createdAt");
