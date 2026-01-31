# HydrateAll Decision Matrix

This matrix maps each proposed model/enum to an implementation phase, estimated effort, risk level, and suggested owner. Use this in sprint planning.

| Item | Phase | Estimated Effort | Risk (L/M/H) | Suggested Owner |
|------|-------:|-----------------:|-------------:|----------------:|
| `HydrationJob` table (core) | Phase 1 | 2 dev-days | M | Backend (Jobs)
| `Outbox` table & dispatcher | Phase 1 | 1 dev-day | M | Backend (Jobs)
| `JobExecutionLog` | Phase 1 | 1 dev-day | L | Backend (Jobs)
| minimal `AIContentLog` (tokens,cost) | Phase 1 | 1 dev-day | M | Backend (Jobs)
| `lib/metrics/hydrateMetrics` instrumentation | Phase 1 | 0.5 dev-day | L | Platform / Observability
| `ValidationRule` model (stub) | Phase 2 | 1 dev-day | M | Backend (Validation)
| `TopicNote` / `TopicQuestion` (content models) | Phase 2 | 3-4 dev-days | M | Content Team
| Curriculum models (Board/Subject/Chapter/Topic) | Phase 2 | 5-7 dev-days | M | Content / Data
| Full `AIContentLog` expansion (detailed) | Phase 2 | 1-2 dev-days | L | Backend (Jobs)
| `ContentCache` model (optional) | Phase 3 | 2 dev-days | L | Platform
| Enums additions (GenerationStatus, etc.) | Phase 1 | 0.5 dev-day | L | Backend
| `User` model relation additions | Phase 1 | 0.5 dev-day | L | Backend
| `Validation` pipeline implementation | Phase 3 | 5-8 dev-days | H | Backend (Validation)

Notes:
- Phase 1 = Must-have core job plumbing (Outbox, HydrationJob, basic logging, metrics).
- Phase 2 = Domain & content models + richer logs and cost tracking.
- Phase 3 = Validation, caching, policy controls and full UX progress.
- Owners are suggested; please assign available engineers and confirm sprint capacity.
