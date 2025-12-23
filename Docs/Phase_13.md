📘 Phase 13 — Regeneration Execution Worker (Isolated, Deterministic, Audited)
13.0 Phase Intent (Read This First)
Goal

Introduce a strictly isolated execution layer that can materialize RegenerationJobs into outputs (documents, regenerated assets, exports) without giving the admin UI, APIs, or analytics any execution powers.

Phase 13 turns:

“A triggerable intent” → “A completed artifact”

Core Principle

Control Plane ≠ Execution Plane

Phase 12 created the control plane.
Phase 13 introduces the execution plane — headless, locked down, non-interactive.

## 13.1 Hard Rules & Invariants (Non-Negotiable)

These are enforced by design and tests.
Execution Rules
❌ No admin UI can execute generation
❌ No API route can call generators
✅ Only the worker can run generators
✅ Worker consumes jobs by status transition
✅ Exactly-once semantics (idempotent execution)
✅ Insert-only outputs (no overwrites)
✅ Audit every execution lifecycle event
✅ No streaming, no partial writes
✅ Deterministic input → reproducible output
✅ Worker can crash/restart safely

Status State Machine (Authoritative)
PENDING
  ↓ (worker lock)
RUNNING
  ↓ success
COMPLETED

RUNNING
  ↓ failure
FAILED


❌ No transitions backward
❌ No re-run of COMPLETED or FAILED jobs
❌ No admin mutation except trigger → PENDING

13.2 System Architecture
┌────────────────────────┐
│ Admin UI (Phase 12)    │
│ - Trigger only         │
│ - Read-only            │
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│ RegenerationJob (DB)   │
│ status=PENDING         │
└──────────┬─────────────┘
           │
           ▼
┌──────────────────────────────┐
│ Regeneration Worker (Phase13)│
│ - Polls DB                   │
│ - Locks job                  │
│ - Executes generator         │
│ - Writes output              │
│ - Audits lifecycle           │
└──────────────────────────────┘

13.3 Prisma Changes (If Needed)
13.3.1 RegenerationJob (already exists)

Ensure fields exist:

model RegenerationJob {
  id             String   @id @default(cuid())
  status         RegenerationJobStatus
  instructionJson Json
  outputRef      String?
  errorJson      Json?
  lockedAt       DateTime?
  completedAt    DateTime?
  createdAt      DateTime @default(now())
}


No new mutable fields beyond status + refs.

13.4 Worker Responsibilities
Worker MUST:

Poll for PENDING jobs
Atomically lock (status=RUNNING, lockedAt=now)
Execute generator based on instructionJson
Store output immutably
Update outputRef
Mark COMPLETED or FAILED
Emit audit events

Worker MUST NOT:
Accept HTTP requests
Read session/user context
Modify existing outputs
Retry failed jobs automatically
Modify instructions

13.5 Execution Model
Job Claim (Atomic)
UPDATE RegenerationJob
SET status='RUNNING', lockedAt=now()
WHERE id=? AND status='PENDING'
If affected rows = 0 → skip

Idempotency
Job can only be locked once
OutputRef written once
Re-runs must be no-ops

13.6 Generator Interface (Strict)
All generators must conform to:
export interface RegenerationExecutor {
  type: RegenerationJobType
  run(input: InstructionJson): Promise<ExecutionResult>
}
No generator registry exposed to UI or APIs.

13.7 Output Storage
Options (Choose One)
Local filesystem (dev)
S3 / blob store (prod)

Rules
Output paths must be deterministic
OutputRef is immutable
No overwrites allowed

13.8 Audit Events (Mandatory)
Event
REGEN_JOB_LOCKED
REGEN_JOB_STARTED
REGEN_JOB_COMPLETED
REGEN_JOB_FAILED

Audit must be:
Fire-and-forget
Non-blocking
Include jobId + status

13.9 Failure Handling
Failures:
Generator throws
Output write fails
Validation fails

Behavior:
Mark job FAILED
Write errorJson
Do NOT retry

Do NOT rollback previous outputs

13.10 Testing Strategy
- Required Tests
- 1Worker claims PENDING job
- Completed job not re-run
- Failed job not re-run
- Exactly-once output creation
- Audit events emitted

Crash recovery (lock prevents double run)

## 🧠 COPILOT PROMPTS (BROKEN DOWN, SAFE)
🔹 Copilot Prompt 13.A — Worker Skeleton
Create a new regeneration worker module that runs independently
from API routes and UI.

Requirements:
- Location: /workers/regenerationWorker.ts
- No HTTP imports
- No Next.js imports
- No session/auth imports

Behavior:
- Poll RegenerationJob where status = 'PENDING'
- Process jobs sequentially (no concurrency yet)
- Do not implement generator logic yet

Include:
- startWorker()
- processNextJob()
- claimJob(jobId)

Do NOT:
- Call any generator
- Modify schemas
- Import admin/UI code

## 🔹 Copilot Prompt 13.B — Job Locking Logic
Implement atomic job locking for RegenerationJob.

Task:
- Update claimJob(jobId) to:
  - Transition status PENDING → RUNNING
  - Set lockedAt = now()
  - Return null if already locked

Rules:
- Use Prisma updateMany or equivalent
- Ensure exactly-once semantics
- Add unit tests for:
  - Successful claim
  - Double-claim prevention

## 🔹 Copilot Prompt 13.C — Generator Interface
Define a strict RegenerationExecutor interface.

Requirements:
- Interface only, no implementations
- Located in /regeneration/executor.ts
- run(input) returns ExecutionResult
- No side effects
- No DB access inside interface

Do NOT:
- Implement generators
- Import worker code

## 🔹 Copilot Prompt 13.D — Execution + Output Write
Extend regenerationWorker to execute a generator
after locking a job.

Tasks:
1. Read instructionJson
2. Select generator by type
3. Run generator
4. Persist output to storage
5. Write outputRef to job
6. Mark COMPLETED

Rules:
- OutputRef written exactly once
- No overwrite allowed
- Catch errors and mark FAILED
- Write errorJson on failure

## 🔹 Copilot Prompt 13.E — Audit Wiring
Add non-blocking audit logging to the regeneration worker.

Events:
- REGEN_JOB_LOCKED
- REGEN_JOB_STARTED
- REGEN_JOB_COMPLETED
- REGEN_JOB_FAILED

Rules:
- Fire-and-forget logging
- Never throw from audit
- Include jobId and status
- Reuse existing logAuditEvent helper

## 🔹 Copilot Prompt 13.F — Worker Tests
Add unit tests for regenerationWorker.

Test cases:
1. PENDING job is claimed and completed
2. COMPLETED job is skipped
3. FAILED job is skipped
4. Double execution prevented
5. Output written once
6. Audit events emitted

Rules:
- Use test DB
- No real generators (mock executor)
- No filesystem writes (mock storage)

🔚 Phase 13 Exit Criteria

You may declare Phase 13 complete only when:

✅ Worker runs without UI/API coupling
✅ Jobs execute exactly once
✅ Outputs are immutable
✅ Audit trail is complete
✅ Tests enforce invariants