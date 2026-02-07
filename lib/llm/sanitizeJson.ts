/**
 * Helper utilities to sanitize and robustly parse JSON-like strings returned by LLMs.
 * Provides heuristics to extract JSON from surrounding markdown and to repair
 * common escape issues that cause `JSON.parse` to fail.
 */
export function sanitizeTextForJson(input: string): string {
  if (!input || typeof input !== 'string') return input;
  let s = input.trim();

  // Remove triple-backtick or triple-tilde fences and optional language tag
  if (/^```/.test(s)) {
    const firstNewline = s.indexOf('\n');
    if (firstNewline !== -1) s = s.slice(firstNewline + 1);
    const closing = s.lastIndexOf('```');
    if (closing !== -1) s = s.slice(0, closing);
    s = s.trim();
  }
  if (/^~~~/.test(s)) {
    const firstNewline = s.indexOf('\n');
    if (firstNewline !== -1) s = s.slice(firstNewline + 1);
    const closing = s.lastIndexOf('~~~');
    if (closing !== -1) s = s.slice(0, closing);
    s = s.trim();
  }

  // If wrapped in single backticks
  if (s.startsWith('`') && s.endsWith('`')) s = s.slice(1, -1).trim();

  // Normalize smart quotes to straight ones
  s = s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

  return s;
}

export function extractJsonSpan(text: string): string | null {
  if (!text || typeof text !== 'string') return null;
  const t = text.trim();
  // Try fenced JSON block
  const jsonFence = /```json\s*([\s\S]*?)```/i.exec(t);
  if (jsonFence && jsonFence[1]) return jsonFence[1].trim();

  // Any fenced block
  const anyFence = /```[\s\S]*?\n([\s\S]*?)```/.exec(t);
  if (anyFence && anyFence[1]) return anyFence[1].trim();

  // Try first object or array span
  const firstObj = t.indexOf('{');
  const lastObj = t.lastIndexOf('}');
  const firstArr = t.indexOf('[');
  const lastArr = t.lastIndexOf(']');
  if (firstObj !== -1 && lastObj !== -1 && lastObj > firstObj) return t.slice(firstObj, lastObj + 1).trim();
  if (firstArr !== -1 && lastArr !== -1 && lastArr > firstArr) return t.slice(firstArr, lastArr + 1).trim();

  return null;
}

function repairCommonEscapes(s: string): string {
  // Remove stray backslashes that are not part of a valid JSON escape sequence
  // Valid escapes: \" \\ \/ \b \f \n \r \t \uXXXX
  // Strategy: remove backslash when followed by a char that isn't a valid escape token
  try {
    return s.replace(/\\(?=[^"\\\/bfnrtu])/g, '');
  } catch {
    return s;
  }
}

export function parseLlmJson(text: string): any {
  const sanitized = sanitizeTextForJson(String(text ?? ''));

  // Try direct parse
  try {
    return JSON.parse(sanitized);
  } catch {
    // Try extracting a JSON-like span
    const span = extractJsonSpan(sanitized);
    if (span) {
      try {
        return JSON.parse(span);
      } catch {
        // attempt to repair common escape issues
        const repaired = repairCommonEscapes(span).replace(/\r/g, '\\r').replace(/\n/g, '\\n');
        try {
          return JSON.parse(repaired);
        } catch {
          // last resort: attempt to remove control characters
          const stripped = repaired.replace(/\u0000-\u001F/g, '');
          return JSON.parse(stripped);
        }
      }
    }
  }
  // If all attempts fail, throw the original parse error
  throw new Error('parse_error');
}

const llmSanitizer = { sanitizeTextForJson, extractJsonSpan, parseLlmJson };
export default llmSanitizer;
