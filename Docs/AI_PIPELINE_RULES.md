## AI Content Pipeline — Copilot Rules

### Global
- AI output is NEVER auto-approved
- All AI output starts as draft
- Human approval is mandatory
- Versioning is append-only
- No in-place edits of AI content

### Hydrators
- May only enqueue HydrationJob
- Must be idempotent
- Must never call LLMs

### Workers
- Input is HydrationJob only
- Must re-check DB before generating
- Must log AIContentLog
- Must fail loudly and visibly

### LLM
- JSON-only responses
- Strict schema validation
- No streaming
- No partial saves

### Prisma
- Use string literals for enums
- Never cast Json to any
- Never ignore lifecycle or status

### COPILOT PIPELINE RULES

- API routes must NOT implement retries, backoff, or execution logic
- All execution must go through submitJob()
- Workers are the only place where LLMs are called
- Redis/Queue creation must be lazy
- Jobs must be idempotent and resumable
- Failures must be recorded, never swallowed
- Cancellation must be respected before execution
