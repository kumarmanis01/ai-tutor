# QA Snippets Validator

Small utility to run DB SQL snippets and simple API checks embedded in QA CSVs.

Requirements
- Node 18+ (global `fetch` expected)
- `@prisma/client` present and `DATABASE_URL` set in environment
- A running dev API at `API_BASE_URL` (defaults to `http://localhost:3000`)

Usage

1. Provide runtime variables (placeholders) either via `--vars-file` or env `QA_VARS`.

Example vars file: `scripts/qa/sample-vars.json`

Run the validator against a CSV:

```bash
# basic
node scripts/qa/validate_snippets.js --file docs/QA/STUDENT_TEST_CASES.csv --vars-file scripts/qa/sample-vars.json

# specify API base and limit rows
API_BASE_URL=http://localhost:3000 node scripts/qa/validate_snippets.js --file docs/QA/ADMIN_TEST_CASES.csv --vars-file scripts/qa/sample-vars.json --limit 20
```

Notes
- CSV parser is purposely lightweight; it supports quoted fields and doubled quotes.
- DB snippets are executed via Prisma's `$queryRawUnsafe` — ensure `DATABASE_URL` points to a safe dev DB.
- API snippets are heuristically parsed for `GET|POST|PATCH|PUT|DELETE /api/...` patterns. If a snippet cannot be parsed, the check is skipped and marked in the report.
- The script writes a JSON report to `tmp/qa_validation_report_<timestamp>.json`.

Security
- This tool runs raw SQL and HTTP requests against your environment. Use only against safe dev or staging databases. Do NOT run against production.
