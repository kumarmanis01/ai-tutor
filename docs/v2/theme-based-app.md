<!--
FILE OBJECTIVE:
- Describe feasibility, required changes, migration plan, timeline, risks and acceptance criteria
  for converting the app to a theme-based UI system.

LINKED UNIT TEST:
- tests/unit/docs/theme_based_app.spec.ts

COPILOT INSTRUCTIONS FOLLOWED:
- /docs/COPILOT_GUARDRAILS.md
- .github/copilot-instructions.md

EDIT LOG:
- 2026-04-22T12:00:00Z | copilot | created initial design document
-->

# Theme-based UI — Feasibility & Implementation Plan

This document captures feasibility, required changes, phased migration plan, timeline estimates, risks and acceptance criteria for migrating the repo from scattered UI attributes to a centralized theme/token-based system. It is intended to guide engineering and product decisions and to be the source-of-truth for the V2 theming work.

**Feasibility Summary**
- Current repo state: a large proportion of UI styling is already tokenized or using CSS variables:
  - `styles/tailwind.css` and `styles/globals.css` declare `:root` variables and dark-mode overrides.
  - `tailwind.config.js` references `var(--...)` tokens for many colors and font families.
  - There is an existing `components/UI/variants` system (designTokens, UIVariantProvider, ThemeWrapper) and a `ThemeProvider` component.
- Conclusion: migration is feasible and low-to-medium risk. We can leverage `components/UI/variants` and `styles/tailwind.css` as the canonical token surface and perform an incremental component-by-component refactor.

**Goals**
- Centralize all UI tokens (colors, typography, spacing, radii, component sizes, animations).
- Make themes runtime-switchable and support per-tenant (school) overrides.
- Keep dark-mode support and enable safe gradual rollout without large visual regressions.
- Provide an admin UI + API for client theme configuration and a cacheable, audited backend store.

**High-level Approach**
1. Establish a single source-of-truth for tokens: use `components/UI/variants/designTokens` as canonical generator.
2. Ensure tokens are exposed as CSS custom properties at root (documentElement) so themes can switch at runtime without rebuilds.
3. Keep Tailwind referencing CSS variables (already in place) so class utilities adapt to runtime tokens.
4. Incrementally refactor components to consume tokens (use utility classes that map to `var(--...)` or inline CSS variables via `ThemeWrapper`).
5. Add tenant/organization theme storage (DB + API + admin UI) with caching and TTL for performance.

**Required Changes (detailed)**
- Token & Provider
  - Audit `components/UI/variants` and consolidate its output as the canonical theme API.
  - Expand `ThemeProvider` or unify it with `UIVariantProvider` so one provider handles app-level tokens + dark/light toggling.
  - Ensure provider applies CSS variables once at root (not repeatedly per component).

- CSS & Tailwind
  - Consolidate variable declarations into `styles/tailwind.css` (single `:root` + `.dark` overrides).
  - Verify `tailwind.config.js` only uses `var(--...)` tokens (safelist any utility classes that might be removed by Purge/JIT).

- Component Refactor
  - Create a prioritized list of components to refactor to tokens. Example priority: `Buttons`, `Navigation`, `Header`, `Chat` (bubbles, input), `Cards`, `Forms`, `PricingCard`, `ProfileWidgets`.
  - For each component: replace hard-coded color/font/spacing with token-based classes (or use `style` with variables for computed sizes).
  - Maintain identical markup where possible to reduce regression surface.

- API, DB & Admin
  - Database migration: add `themes` table (example schema below) or add JSONB `theme_overrides` column on `tenants`/`clients` table.
    - themes: id, tenant_id, name, tokens JSONB, logo_url, fonts[], is_default, created_at, updated_at
  - API endpoints: `GET /api/admin/themes`, `POST /api/admin/themes`, `PUT /api/admin/themes/:id`, `DELETE /api/admin/themes/:id` (auth-guarded and audited).
  - Admin UI: simple theme editor (color pickers, preview, upload logo/font) with validation and preview sandbox.

- Caching & Runtime
  - Cache resolved theme tokens in Redis with TTL. Invalidate cache when admin updates a theme.
  - On page load, server render should include a minimal token payload (or a class) to avoid flash-of-unstyled-theme (FOUT). Use inline `<style>` or initial CSS variables in server HTML.

- Testing & Visual QA
  - Unit tests: token generator, provider behavior (SSR fallback), API handlers.
  - Integration tests: admin API flows and tenant theme loading.
  - Visual regression tests: Percy/Playwright snapshots for high-priority views pre/post theme changes.

**Example DB Migration (conceptual)**
```sql
CREATE TABLE theme (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenant(id),
  name text NOT NULL,
  tokens jsonb NOT NULL,
  logo_url text,
  fonts jsonb,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Phased Migration Plan**
- Phase 0 — Discovery & Audit (2–3 dev-days)
  - Inventory hard-coded styles and compile a component priority list.
  - Confirm token gaps in `components/UI/variants` and `styles/tailwind.css`.

- Phase 1 — Core Tokens & Provider (4–6 dev-days)
  - Finalize canonical tokens and wire provider to apply variables at root.
  - Add SSR-safe fallback (server inject minimal variables to avoid FOUC).

- Phase 2 — Tailwind & Global CSS Lockdown (2–3 dev-days)
  - Consolidate variables in `styles/tailwind.css` and update `tailwind.config.js`.
  - Safelist dynamic classes used during migration.

- Phase 3 — Component Refactor (iterative)
  - Sprint 1 (critical components): 5–8 dev-days.
  - Sprint 2 (secondary components): 10–20 dev-days depending on scope.
  - Do this in small PRs with visual snapshots.

- Phase 4 — Admin UI, API & DB (5–8 dev-days)
  - Simple CRUD admin UI and API with validation and preview + DB migration and caching.

- Phase 5 — Testing, Visual Regression & Rollout (3–6 dev-days)
  - Add tests, visual diffs; run manual QA and accessibility checks.

Estimated total (1 engineer full-time): 6–12 weeks depending on component count and QA thoroughness. With 2 engineers working in parallel, 3–6 weeks is a realistic target.

**Acceptance Criteria**
- Primary UI elements (Buttons, Nav, Cards, Chat) use tokens for color/typography/spacing.
- Dark mode and runtime theme switch work without full rebuilds.
- Tenant-level themes can be created, persisted and applied at runtime.
- Visual regression diffs for critical pages are within acceptable bounds (product sign-off).
- CI passes: lint, type-check, unit tests and integration tests added for core pieces.

**Risks & Mitigations**
- Visual regressions: mitigate with visual snapshot testing and staged release (feature flag).
- Tailwind purging removing required classes: mitigate via safelist and limited runtime class generation.
- Performance: injecting variables at root avoids repeated DOM writes; cache theme payloads in Redis.
- Font licensing & hosting: avoid dynamically injecting third-party webfonts without license; host essential fonts in object storage (R2) if needed.

**Operational & Security Notes**
- Theme tokens must never contain PII.
- Admin theme changes must be audited and only available to authorized roles.
- Use existing feature flags (e.g., `ROLLOUT_PERCENTAGE`) for staged tenant rollouts.

**Testing Checklist**
- Unit tests for token generation and provider SSR fallback.
- Integration tests for theme CRUD API and tenant-loading middleware.
- Visual snapshot tests for top 8 critical pages in both default and tenant-theme states.
- Accessibility checks: color-contrast automated runs for generated themes.

**Open Questions / Decisions Needed**
1. Where should tenant themes live? (new `themes` table vs `tenant.theme_overrides` column) — recommendation: new `themes` table for history & audit.
2. Should we allow free-form CSS in admin UI or strictly token-only edits? — recommendation: token-only edits to reduce XSS and regressions.
3. Do we provide a WYSIWYG preview for themes? strong +1 for preview to reduce QA burden.

**Next Steps**
1. Review and approve this plan.
2. Run an automated style audit (grep for hex codes, inline styles) and produce a component priority list (2–3 dev-days).
3. Kick off Phase 1 (assign owner, create PRs, implement provider + SSR-safe variable injection).

---
If you'd like, I can (a) produce the audit report (component list + counts of hard-coded styles), or (b) open the initial PR scaffold for Phase 1. Which should I do next?

## Infra Design — Phase 1 PR (scaffold)

This PR will establish the infrastructure needed for the theme migration without touching production UI yet. It includes:

- A small configuration file to opt-out paths (docs) from automated tokenization: `theme.config.json`.
- A lightweight JS helper that exposes `designTokens` to application code (`lib/ui/theme.ts`). This is useful for canvas drawing, JS color arrays, and any runtime code that cannot read CSS variables directly.
- A unit test stub for the helper (`tests/unit/lib/ui/theme.spec.ts`) to satisfy the repository's file-level testing requirements for incremental changes.
- A brief NOTE in this document to record the PR plan and scope.

Why this PR first?
- Minimizes risk: adds non-invasive infra and tests.
- Enables subsequent PRs to safely replace hard-coded colors with token reads (JS or CSS) without introducing visual regressions.
- Explicitly excludes `/docs/**` from automated replacement to preserve wireframes and documentation.

Planned follow-ups (after this PR merges):

1. Mount `UIVariantProvider` at app root and ensure `ThemeWrapper` applies CSS variables at runtime (small PR).
2. Replace one high-priority component (e.g., `AITutorChatPanel`) with token-backed classes as a proof-of-concept PR.
3. Add a CLI script to perform controlled token replacements, respecting `theme.config.json` ignore paths.

PR name suggestion: `feat(theme): add theme infra scaffold (config + token helper + tests)`

---
<!-- NOTE: `/docs/**` is intentionally excluded from tokenization and automated replacements. -->
