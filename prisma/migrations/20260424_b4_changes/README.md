<!--
FILE OBJECTIVE:
- Document that this directory is not a valid Prisma migration artifact and must not remain under `prisma/migrations/` as a placeholder.

LINKED UNIT TEST:
- N/A

COPILOT INSTRUCTIONS FOLLOWED:
- /docs/COPILOT_GUARDRAILS.md
- .github/copilot-instructions.md

EDIT LOG:
- 2026-04-24T00:00:00Z | copilot | replaced placeholder migration instructions with explicit invalid-state notice
-->

# Invalid placeholder migration directory

This directory is **not** a valid Prisma migration and must not remain under
`prisma/migrations/` in a deployable state.

A README placeholder does **not** prevent `prisma migrate deploy` from treating the
folder as part of the migrations tree. To make deploy behavior deterministic, do one
of the following:

1. **Delete or move this directory out of `prisma/migrations/`** if it is only a stub.
2. **Replace this directory with an actual Prisma-generated migration** created from a
   developer machine using a valid `DATABASE_URL`, including the generated
   `migration.sql` artifact.

Until one of those actions is completed, this folder should be treated as invalid for
production and CI deployment.
