import mapSignalToSuggestions, { AnalyticsSignal, ContentSuggestionInput } from './mappings'

/**
 * Convert a single AnalyticsSignal into one or more ContentSuggestionInput entries.
 * Pure, deterministic, no DB access.
 */
export function generateSuggestionsForSignal(signal: AnalyticsSignal): ContentSuggestionInput[] {
  if (!signal || !signal.type) throw new Error('Invalid AnalyticsSignal')
  return mapSignalToSuggestions(signal)
}

export default generateSuggestionsForSignal

// Ensure CommonJS consumers can require() this module and get the function
// (helps tests that import the default via different transpilation settings)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(function ensureCjsExports() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = (module as any)
  try {
    // assign both the function and named export to cover various interop styles
    m.exports = generateSuggestionsForSignal
    m.exports.default = generateSuggestionsForSignal
    m.exports.generateSuggestionsForSignal = generateSuggestionsForSignal
  } catch {
    // ignore in ESM-only environments
  }
})()
