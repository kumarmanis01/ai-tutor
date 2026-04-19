<!--
FILE OBJECTIVE:
- Phase 2 enhancements for Annual Invoice Summary (F-PAR-032 AC-05).

LINKED UNIT TEST:
- tests/unit/api/parent-invoices-annual-summary.spec.ts

COPILOT INSTRUCTIONS FOLLOWED:
- .github/copilot-instructions.md
- /docs/COPILOT_GUARDRAILS.md

EDIT LOG:
- 2026-04-17T00:00:00Z | copilot | create phase-2 planning document for annual invoice summary
-->

# Annual Invoice Summary — Phase 2 (Planned Enhancements)

Summary:
- This document lists planned improvements for the annual invoice summary feature beyond the initial implementation that returns merged PDFs for a financial year.

Planned Phase 2 items:

- Streaming & large-PDF handling:
  - Implement streaming response to avoid constructing very large in-memory PDFs for parents with many invoices.
  - Integrate a worker/job to generate merged PDFs asynchronously and persist merged PDFs to R2 for caching.

- Access control for private invoice files:
  - If per-invoice `fileUrl` is private, implement authenticated download (signed R2 URLs) or always regenerate server-side to avoid exposing credentials.

- Caching and re-use:
  - Cache merged PDFs per parent + FY in R2 and return cached copy when available. Add cache invalidation when invoices change.

- Table of Contents / Pagination in merged PDF:
  - Add a first-page TOC listing invoice numbers and dates with page offsets.
  - Add page numbers and per-invoice headers for easier navigation.

- Background generation + notification:
  - For large merges, enqueue a job and email the parent (or provide a webhook) when the merged PDF is ready.

- Rate limiting and quota:
  - Apply rate limits per parent to avoid abuse. Consider queueing policy for heavy requests.

- Performance & observability:
  - Instrument job durations, merged PDF sizes, and download counts.
  - Add unit/integration tests for streaming and caching flows.

Implementation notes:
- Prefer `pdf-lib` for deterministic server-side merging and to keep tests Playwright-free.
- Keep all changes audit-friendly and logged (follow existing logging conventions).

Work items (short):
- [ ] Streaming response + worker job
- [ ] Signed download support for private R2
- [ ] Cache merged PDFs to R2 with TTL and invalidation
- [ ] Add TOC, page numbers
- [ ] Add integration tests and e2e for large account

Estimated effort: 3–5 dev days (implementation + tests + infra)

**End of Phase 2 plan**
