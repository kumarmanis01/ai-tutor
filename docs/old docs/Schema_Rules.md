# SCHEMA RULES — DO NOT VIOLATE

This project uses a STRICTLY GUARDED academic + AI content schema.

## IMMUTABLE PRINCIPLES

1. AI jobs are ATOMIC
   - No per-job pause/resume
   - Retry always creates a new attempt
   - Jobs never mutate content directly

2. Approval is MANDATORY
   - No content is auto-approved
   - Status transitions must be explicit
   - All transitions are audited

3. Versioning is SACRED
   - Never overwrite approved content
   - New content = new version
   - Rollback restores previous version

4. Soft deletes ONLY
   - Never hard-delete academic data
   - Use lifecycle = deleted

5. ENUMS ARE FINAL
   - Never replace enums with strings
   - Never introduce new status values casually

## ENUM SAFETY RULE

- Prisma enums MUST NOT accept raw strings
- All external inputs MUST be normalized
- Casting (as LanguageCode) is FORBIDDEN
- Use normalizeLanguage / normalizeDifficulty utilities

### Enum Rule

- Any field with a fixed domain MUST be a Prisma enum
- Strings with comments like "easy | medium | hard" are forbidden
- Enums must be imported from `@prisma/client`
- Local enum redefinitions are not allowed


## ENTITY RULES

### Board / Class / Subject
- Created once
- Never deleted
- Seeded idempotently

### Chapter / Topic
- Versioned
- Approval-controlled
- Rollback via parentId

### Notes / Tests
- Read-only after generation
- Edited only via regeneration
- Teacher edits create new version

### Jobs
- Status flow:
  pending → running → completed | failed | cancelled
- No skipping states
- No mutation after completion

## AUDIT REQUIREMENTS

- Every approve/reject/rollback:
  - MUST create ApprovalAudit record
  - MUST include actorId if available

## WHAT COPILOT MUST NEVER DO

- Add pause/resume to jobs
- Auto-approve AI content
- Overwrite approved records
- Remove versioning
- Hard delete academic entities

### Enum + Where Clause Rule

- Normalizers may return `Enum | null`
- `null` MUST NEVER be passed to Prisma `where`
- Use conditional spread to omit fields
- Local enum redefinitions are forbidden

## Content Generation Rules

- Topics and chapters MUST be created only via AI jobs.
- UI MUST NOT allow manual topic creation.
- Notes, tests, and questions MUST reference an existing TopicDef.
- If no topics exist for a subject, UI must prompt to run SYLLABUS job.
- Generation jobs are atomic and non-editable.
- All generated entities start in DRAFT status.