# LLM & AI Runtime Flags (reference)

This document lists environment flags that control LLM behaviour, worker-level debug logging, and the new console-only raw-LLM logging mode.

Purpose
- Single reference for engineers and operators to enable/disable LLM debug behaviours safely.

Guiding principles
- Prefer short-lived, targeted debug flags for collecting sensitive outputs; disable immediately after capturing required info.
- Do not enable raw-output persistence in production unless absolutely necessary and with access controls/retention in place.

Flags

- `LOG_RAW_LLM_OUTPUT_CONSOLE_ONLY` (new)
  - Default: `false`
  - Purpose: When `true`, the worker will log a trimmed snippet of the raw LLM output to the application logger (PM2 logs) but will redact/avoid persisting the raw text inside `AIContentLog.responseBody.raw`.
  - Usage: enable only for short troubleshooting windows on worker nodes. Prevents raw text from being written to the DB while still surfacing a snippet in logs.

- `AI_CONTENT_DEBUG`
  - Default: `false`
  - Purpose: Call-site debug; callLLM may attach `_rawText` to persisted `AIContentLog` entries and produce additional debug logs.
  - Notes: This tends to persist raw outputs when logging is not suppressed — use with caution.

- `WORKER_DEBUG`
  - Default: `false`
  - Purpose: Emits worker-level debug logs (raw + parsed) inside `callLLM` and workers. Useful when debugging parsing logic.
  - Notes: Verbose; may include large objects.

- `HYDRATION_DEBUG`
  - Default: `false`
  - Purpose: Hydration pipeline-specific debug; used by `callLLM` to emit structured debug entries for hydration flows.

- `ALLOW_LLM_CALLS`
  - Default: (none) — must be set to `1` in worker runtime
  - Purpose: Safety guard ensuring LLM calls only happen in worker processes.

- `LLM_MODE`
  - Values: `mock` | `real`
  - Purpose: When `mock`, `callLLM` returns deterministic stub responses for fast dev/testing.

- `LLM_SAFE_MODE`
  - Default: `false`
  - Purpose: When `true`, worker flows run sequentially / more conservatively to avoid concurrency/rate issues.

- Other feature flags (examples):
  - `ENABLE_AI_TUTOR`, `ENABLE_DISTRESS_DETECTION`, `ENABLE_TUTOR_CARD`, `ENABLE_SESSION_ENGINE` — feature toggles that gate product behaviour; not LLM-debug flags but listed here for operational context.

Why we added `LOG_RAW_LLM_OUTPUT_CONSOLE_ONLY` instead of reusing an existing flag
- `AI_CONTENT_DEBUG` and `WORKER_DEBUG` are useful but are broader:
  - `AI_CONTENT_DEBUG` may persist raw text in DB (not acceptable if you want console-only observation without persistence).
  - `WORKER_DEBUG` is noisy and used for general developer debugging.
- `LOG_RAW_LLM_OUTPUT_CONSOLE_ONLY` is intentionally scoped:
  - Writes a trimmed snippet to application logs only.
  - Redacts raw LLM text from the persisted `AIContentLog.responseBody`.
  - Safer for temporary investigation without increasing DB footprint or long-term retention of raw outputs.

Operational guidance
- Enable for a short period only (e.g., 15–60 minutes), then set to `false` and restart the worker process.
- Use PM2 to restart the worker and tail logs. Example (PowerShell):
```powershell
$env:LOG_RAW_LLM_OUTPUT_CONSOLE_ONLY='true'
$env:ALLOW_LLM_CALLS='1'
pm2 restart content-engine-worker
pm2 logs content-engine-worker --lines 500 | Select-String 'LLM_RAW_DEBUG'
```

Security & retention
- Treat raw LLM outputs as sensitive: they may contain user PII or other sensitive text.
- Prefer `LOG_RAW_LLM_OUTPUT_CONSOLE_ONLY` for quick troubleshooting. If you must persist raw outputs, store them in controlled storage (R2/S3) with access restrictions and retention policy (e.g., 30 days), and record an audit entry.

Where to set
- Add the flag to your worker environment (e.g., `.env.production`, PM2 `ecosystem.config.cjs` env block) when required.
- Default value in repo: `false` (do not commit secrets or enable by default).

Recommended next steps
- Add this file to the repo (done).
- Add `LOG_RAW_LLM_OUTPUT_CONSOLE_ONLY=false` to `.env.example` and to your PM2 ecosystem file as a commented sample.
- Document the short-lived workflow in runbooks for on-call engineers.

Contact
- For questions about how `callLLM` or workers use this flag, see `lib/callLLM.ts` and `worker/services/*` implementations.
