/**
 * Failure taxonomy and helpers for structured lastError values.
 *
 * lastError format: <ERROR_CODE>::<short human message>
 */
export enum FailureCode {
  PROMPT_INVALID = 'PROMPT_INVALID',
  LLM_TIMEOUT = 'LLM_TIMEOUT',
  LLM_RATE_LIMIT = 'LLM_RATE_LIMIT',
  LLM_RESPONSE_INVALID = 'LLM_RESPONSE_INVALID',
  PARSE_FAILED = 'PARSE_FAILED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  DEPENDENCY_MISSING = 'DEPENDENCY_MISSING',
  DB_WRITE_FAILED = 'DB_WRITE_FAILED',
  LOCK_FAILED = 'LOCK_FAILED'
}

export function formatLastError(code: FailureCode, message: string) {
  const short = String(message || '').split('\n')[0].slice(0, 200);
  return `${code}::${short}`;
}

export function formatChildFailure(childJobId: string, childJobType: string, childErrorCode: FailureCode | string) {
  const code = String(childErrorCode);
  return `CHILD_FAILED::${childJobType}(${childJobId})::${code}`;
}

export function inferFailureCodeFromMessage(msg: string): FailureCode {
  const m = String(msg || '').toLowerCase();
  if (m.includes('timeout')) return FailureCode.LLM_TIMEOUT;
  if (m.includes('rate limit') || m.includes('rate_limit')) return FailureCode.LLM_RATE_LIMIT;
  if (m.includes('parse') || m.includes('invalid json') || m.includes('failed_parse')) return FailureCode.PARSE_FAILED;
  if (m.includes('validation') || m.includes('validation_failed')) return FailureCode.VALIDATION_FAILED;
  if (m.includes('missing') || m.includes('not_found') || m.includes('not found')) return FailureCode.DEPENDENCY_MISSING;
  if (m.includes('lock') || m.includes('concurrent')) return FailureCode.LOCK_FAILED;
  // default
  return FailureCode.DB_WRITE_FAILED;
}
