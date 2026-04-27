# ESLint Rules — AI Content Engine

This folder contains custom ESLint rules that enforce AI pipeline guardrails.

Files
- `index.cjs` — plugin entry exporting rules
- `no-direct-llm.cjs` — forbids direct imports/requires of LLM SDKs (e.g. `openai`) outside approved server modules
- `require-copilot-lock.cjs` — enforces presence of the Copilot AI lock header in critical directories
- `tests/run-rule-tests.cjs` — minimal RuleTester-based runner for the rules

Running tests locally

1. Install dependencies:

```bash
npm ci
```

2. Run the custom rule tests:

```bash
npm run test:eslint-rules
```

Notes
- The tests are a minimal smoke-suite using ESLint's `RuleTester`. Expand them to cover more edge cases before enforcing widely.
- Adjust `no-direct-llm.cjs` allowlist (`allowedPathSegments`) if you have additional server-side modules that need direct LLM SDK access.
