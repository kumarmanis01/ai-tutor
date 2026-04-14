// Lightweight DOM polyfills used only in the Jest jsdom environment.
// Ensure common DOM methods used in components exist so unit tests don't
// crash when run under jsdom in CI or local dev.

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
