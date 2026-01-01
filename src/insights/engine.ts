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
