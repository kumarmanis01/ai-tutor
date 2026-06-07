// Lightweight DOM polyfills used only in the Jest jsdom environment.
// Ensure common DOM methods used in components exist so unit tests don't
// crash when run under jsdom in CI or local dev.

// Register @testing-library/jest-dom matchers (toBeInTheDocument, toHaveClass,
// toHaveTextContent, ...) for the entire jsdom project. Without this every
// component spec would have to import jest-dom itself.
import '@testing-library/jest-dom';

// Global mock for next/navigation so any component that calls useRouter /
// usePathname / useSearchParams during render doesn't throw
// "invariant expected app router to be mounted" in unit tests.
jest.mock('next/navigation', () => {
  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  };
  return {
    __esModule: true,
    useRouter: () => router,
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(),
    useParams: () => ({}),
    redirect: jest.fn(),
    notFound: jest.fn(),
  };
});

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
