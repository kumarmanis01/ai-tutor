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
;(module as any).exports = Object.assign(generateSuggestionsForSignal, { generateSuggestionsForSignal })
