<!--
FILE OBJECTIVE:
- Document how to run the curriculum ingestion CLI, seed CBSE Grade 10 Math+Science, and retry failed chunk embeddings.

LINKED UNIT TEST:
- tests/unit/scripts/ingest-curriculum.test.ts

COPILOT INSTRUCTIONS FOLLOWED:
- .github/copilot-instructions.md
- /docs/COPILOT_GUARDRAILS.md

EDIT LOG:
- 2026-04-17T00:00:00Z | copilot | created ingestion + DB seed documentation
-->

**Purpose**

This document explains how to run the ingestion and seeding tooling that populates `CurriculumChunk` rows and generates embeddings. It covers local PDF ingestion, NCERT scraping for CBSE Grade 10, and how to retry failed chunk embeddings by `ingestRunLog` run id.

**Prerequisites**

- **Node**: >= 20
- **Install deps**: run `npm ci` to install runtime and dev deps.
- **Env**: set `DATABASE_URL` (required) and `OPENAI_API_KEY` (for embedding calls). If running embedding-free checks, `OPENAI_API_KEY` may be omitted but embedding steps will fail.
- **Optional**: `pdf-parse` is used for robust PDF extraction. The scraper and parse CLI dynamically import it; if missing, parsing falls back to a naive extraction.

**Key files**

- `scripts/scrape-ncert.ts` — NCERT-grade scraper and ingestion pipeline.
- `scripts/ingest-curriculum.ts` — generic re-embed/ingest script (now supports `--retry-failed --run-id`).
- `scripts/parse-pdf-cli.ts` — local PDF parsing CLI to upsert `CurriculumChunk` rows.
- `ingest.js` — lightweight CLI wrapper for convenience.
- `scripts/seed-cbse-grade10.ts` — convenience runner to seed CBSE Grade 10 Math + Science.
- API trigger: [app/api/admin/content/ingest-ncert/route.ts](app/api/admin/content/ingest-ncert/route.ts) — creates an `IngestRunLog` and spawns the scraper.

Use these file links in the repo to review code and behaviour.

**Commands & Examples**

Install dependencies:

```bash
npm ci
```

Run the NCERT scraper for a single grade (uses `tsx` via the wrapper):

```bash
node ingest.js --subject mathematics --grade 10 --lang en --board CBSE
```

Parse and ingest a local PDF file into `CurriculumChunk` rows:

```bash
node ingest.js --file ./path/to/ncert_math10.pdf --board CBSE --subject mathematics --grade 10 --lang en
```

Retry failed chunk embeddings from a previous ingest run (provide the `IngestRunLog` id):

```bash
node ingest.js --retry-failed --run-id <INGEST_RUN_ID>
```

Seed CBSE Grade 10 Math + Science (runs scraper for both subjects):

```bash
npx tsx scripts/seed-cbse-grade10.ts
# or
npm run ingest:seed-cbse-grade10
```

Notes:
- When invoking via npm script and you need to pass extra flags, use `--` after the script name. For example: `npm run ingest:cli -- --file ./book.pdf`.

**What the retry does**

- The `--retry-failed --run-id` mode inspects the specified `IngestRunLog` record's `errorDetails` for failed chunk ids and reprocesses those specific `CurriculumChunk` rows. This forces re-embedding attempts even if the `contentHash` hasn't changed.

**Verification queries**

After a successful run, verify in the DB (example queries):

```sql
-- recent ingest runs
SELECT id, runAt, fileSource, chunksCreated, embeddingsGenerated, errors
FROM "IngestRunLog" ORDER BY runAt DESC LIMIT 10;

-- count curriculum chunks for CBSE Grade 10 mathematics
SELECT COUNT(*) FROM "CurriculumChunk" WHERE board = 'CBSE' AND subject = 'mathematics' AND grade = '10';

-- view failed chunk ids recorded in a run (if any)
SELECT errorDetails FROM "IngestRunLog" WHERE id = '<INGEST_RUN_ID>';
```

**Observability & logs**

- Ingest runs write rows to `IngestRunLog` and an `analytics.events` entry with `eventType = 'ingest_run'` so you can track runs in the Neon console.
- Worker logs and stderr will contain embedding failures. The CLI returns a non-zero exit code when embed errors occurred (so CI can detect failures).

**POSIX executable tips**

- `ingest.js` includes a shebang and can be made executable on POSIX systems:

```bash
chmod +x ingest.js
./ingest.js --subject mathematics --grade 10
```

On Windows use `node ingest.js ...` instead.

**Safety & production notes**

- Never run the seeding against the production database without confirming feature flags and backups. The scripts are idempotent by content hash but will write rows and may trigger embedding API calls.
- Ensure `OPENAI_API_KEY` points to a test or paid key depending on expected usage costs. Monitor `analytics.events` for cost metrics.

**Troubleshooting**

- If embeddings repeatedly fail: inspect `IngestRunLog.errorDetails` for chunk ids and errors; try `node ingest.js --retry-failed --run-id <id>` after fixing API/key/network issues.
- If `pdf-parse` import fails, install it: `npm ci` (it is already a dependency in this repo). The parser falls back to naive extraction if unavailable but that reduces chunk quality.

---

If you want, I can add a small integration test that runs `scripts/parse-pdf-cli.ts` against a tiny sample PDF in tests/fixtures and asserts `CurriculumChunk` upsert behaviour — should I add that next?
