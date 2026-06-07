/**
 * FILE OBJECTIVE:
 * - Lightweight DOM/jsdom polyfills (jest-dom matchers, TextEncoder/Decoder,
 *   scrollIntoView) loaded by the Jest jsdom project so component tests do
 *   not crash on missing browser APIs.
 *
 * LINKED UNIT TEST:
 * - (test-infra; exercised indirectly by every component spec.)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-06-07T00:00:00Z | claude | replace single-line note with standard header.
 */

// Register @testing-library/jest-dom matchers (toBeInTheDocument, toHaveClass,
// toHaveTextContent, ...) for the entire jsdom project. Without this every
// component spec would have to import jest-dom itself.
import '@testing-library/jest-dom';

// next/navigation mock now lives in tests/setup/navigationMock.ts and is loaded
// by both jest projects so node-environment specs (dashboard page.test.ts) also
// get the router stub.

// Ensure TextDecoder/TextEncoder exist in older jsdom/node test environments
// so components that consume streaming APIs (SSE / Fetch body readers) do
// not crash when constructing decoders in tests.
try {
  const g: any = globalThis as any
  if (typeof g.TextDecoder === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    g.TextDecoder = require('util').TextDecoder
  }
  if (typeof g.TextEncoder === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    g.TextEncoder = require('util').TextEncoder
  }
} catch {
  // best-effort: if require is not available, ignore and continue
}

if (typeof (globalThis as any).window !== 'undefined') {
  try {
    const g: any = globalThis as any
    if (g.HTMLElement && !g.HTMLElement.prototype.scrollIntoView) {
      // Provide a no-op implementation used by components that call
      // `element.scrollIntoView(...)` during lifecycle effects.
      g.HTMLElement.prototype.scrollIntoView = function () {
        // no-op for tests
      }
    }
  } catch {
    // ignore failures in odd runtime shims
  }
}
