// Lightweight DOM polyfills used only in the Jest jsdom environment.
// Ensure common DOM methods used in components exist so unit tests don't
// crash when run under jsdom in CI or local dev.

// jest-dom custom matchers (toBeInTheDocument, toHaveAttribute, etc.)
import '@testing-library/jest-dom';

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
