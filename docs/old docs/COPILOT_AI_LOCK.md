# AI Pipeline — Copilot Lock

## Non-Negotiable Rules

### Hydrators
- Only enqueue jobs
- Never call LLMs
- Must be idempotent
- Must not mutate content
- Must check DB before enqueue

### Workers
- Input = HydrationJob row ONLY
- Must transition pending → running → completed/failed
- Must re-check idempotency before AI call
- Must wrap DB writes in a transaction
- Must never auto-approve content
- All generated content = status:draft
- Must log every LLM call
- Must not silently swallow errors

### AI Output
- JSON only
- Schema validated
- Deterministic ordering enforced
- Versioned, append-only

### System Settings
- Json fields accessed type-safely
- No `any`
- Pause ≠ failure

### Prisma
- Prefer explicit IDs over names
- No semantic overloading of columns
# AI Pipeline — Copilot Lock

## Non-Negotiable Rules

### Hydrators
- Only enqueue jobs
- Never call LLMs
- Must be idempotent
- Must not mutate content
- Must check DB before enqueue

### Workers
- Input = HydrationJob row ONLY
- Must transition pending → running → completed/failed
- Must re-check idempotency before AI call
- Must wrap DB writes in a transaction
- Must never auto-approve content
- All generated content = status:draft
- Must log every LLM call
- Must not silently swallow errors

### AI Output
- JSON only
- Schema validated
- Deterministic ordering enforced
- Versioned, append-only

### System Settings
- Json fields accessed type-safely
- No `any`
- Pause ≠ failure

### Prisma
- Prefer explicit IDs over names
- No semantic overloading of columns
