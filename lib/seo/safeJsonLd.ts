/**
 * FILE OBJECTIVE:
 * - Safely serialize JSON-LD schemas for use in dangerouslySetInnerHTML to prevent XSS.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/seo/safe-json-ld.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-26T00:00:00Z | copilot | created safe JSON-LD serializer with HTML escaping
 */

/**
 * Safely serializes a JSON-LD object for use in dangerouslySetInnerHTML.
 * Escapes HTML entities (< > / quotes) to prevent script tag breakout XSS.
 * 
 * @param obj The JSON-LD object to serialize
 * @returns Escaped JSON string safe for use in script tags
 */
export function safeJsonLd<T>(obj: T): string {
  const jsonString = JSON.stringify(obj);
  
  return jsonString
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\//g, '\\/')
    .replace(/'/g, '\\u0027')
    .replace(/"/g, '\\u0022');
}
