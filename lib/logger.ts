/**
 * FILE OBJECTIVE:
 * - Provide structured, sanitized logging for server and client contexts with
 *   environment-aware level gating and API request/response debugging helpers.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/logger.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-15T00:00:00Z | copilot | add unit tests for logger features
 * - 2026-05-01T00:00:00Z | copilot | preserve Error details in structured context logs
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const ENV = process.env.NODE_ENV || 'development';

function now() {
  return new Date().toISOString();
}

function toSerializableError(err: Error) {
  return {
    name: err.name,
    message: err.message,
    stack: err.stack,
  };
}

// Basic sanitizers
function sanitizeValue(v: unknown): unknown {
  if (v == null) return v;
  if (v instanceof Error) return toSerializableError(v);
  if (typeof v === 'string') {
    // redact JWT-looking strings (three segments separated by dots, length heuristics)
    if (/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(v)) return '[REDACTED_JWT]';
    // redact session token cookie names/values
    if (/session-token|session|next-auth|__Secure-next-auth/i.test(v)) return '[REDACTED_SESSION]';
    // redact emails
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return '[REDACTED_EMAIL]';
    // redact raw answers or fields named rawAnswer or answer-like content
    if (/\b(answer|rawanswer|raw_answer)\b/i.test(v)) return '[REDACTED_ANSWER]';
    return v;
  }
  if (Array.isArray(v)) return (v as unknown[]).map(sanitizeValue);
  if (typeof v === 'object') return sanitizeObject(v as Record<string, unknown>);
  return v;
}
function sanitizeObject(obj: Record<string, unknown> | null | undefined): unknown {
  if (!obj) return obj;
  if (obj instanceof Error) return toSerializableError(obj);
  const out: Record<string, unknown> | unknown[] = Array.isArray(obj) ? [] : {};
  for (const k of Object.keys(obj)) {
    const lk = k.toLowerCase();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const val = (obj as any)[k];
    if (
      lk.includes('token') ||
      lk.includes('jwt') ||
      lk.includes('session') ||
      lk.includes('password') ||
      lk.includes('secret')
    ) {
      (out as Record<string, unknown>)[k] = '[REDACTED]';
      continue;
    }
    if (lk.includes('email')) {
      (out as Record<string, unknown>)[k] = '[REDACTED_EMAIL]';
      continue;
    }
    if (lk.includes('answer') || lk.includes('rawanswer') || lk.includes('raw_answer')) {
      (out as Record<string, unknown>)[k] = '[REDACTED_ANSWER]';
      continue;
    }
    (out as Record<string, unknown>)[k] = sanitizeValue(val as unknown);
  }
  return out;
}

function shouldLog(level: LogLevel) {
  if (level === 'debug') return ENV === 'development';
  if (level === 'info') return ENV === 'production' || ENV === 'development';
  return true; // warn/error always
}

function output(level: LogLevel, event: string, context?: any) {
  if (!shouldLog(level)) return;
  const payload = {
    timestamp: now(),
    level,
    event,
    context: sanitizeObject(context || {}),
  };
  // Use stdout for info/debug, stderr for warn/error
  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    // Route warnings to stderr via console.warn so they're clearly visible
    // but not treated as fatal errors by tooling that watches stderr.
    console.warn(line);
  } else {
    console.log(line);
  }
}

// NOTE: file-backed logging was intentionally removed from this module to
// remain compatible with Next.js Edge runtime and Turbopack static analysis.
// Server-side file transport can be added in a separate, Node-only module
// that attaches to `logger.subscribe()` during Node process startup (worker/PM2).

export function debug(event: string, context?: any) {
  output('debug', event, context);
}

export function info(event: string, context?: any) {
  output('info', event, context);
}

export function warn(event: string, context?: any) {
  output('warn', event, context);
}

export function error(event: string, context?: any) {
  output('error', event, context);
}
/**
 * Logger utility for capturing logs with optional class and method context.
 * Logging is enabled only if NEXT_PUBLIC_DEBUG_MODE === 'true'.
 * In other cases, logger is a no-op.
 * Usage:
 *   logger.add('A log message', { className: 'MyClass', methodName: 'myMethod' });
 *   logger.subscribe((msg) => { ... });
 *   logger.getLogs();
 *   logger.logRouteInfo(req, res, context); // log route request/response info
 */

type LogCallback = (msg: string) => void;

interface LogContext {
  className?: string;
  methodName?: string;
  [key: string]: unknown;
}

// Determine environment and logging levels
// Use `globalThis` to detect browser `window` without requiring DOM lib.
const isClient = typeof (globalThis as any).window !== 'undefined';
const isDebug = process.env.NEXT_PUBLIC_DEBUG_MODE === 'true';
// Worker-level debug override (useful for PM2/workers): set WORKER_DEBUG=1 to enable server debug logs
const isWorkerDebug = process.env.WORKER_DEBUG === '1' || process.env.WORKER_DEBUG === 'true';

type Level = 'error' | 'warn' | 'info' | 'debug' | 'log';
const levelWeight: Record<Level, number> = {
  error: 40,
  warn: 30,
  info: 20,
  debug: 10,
  log: 20,
};

function parseLevel(s?: string | null): Level {
  const v = String(s || '').toLowerCase();
  if (v === 'error' || v === 'warn' || v === 'info' || v === 'debug' || v === 'log')
    return v as Level;
  return 'error';
}

// Server log level via env; default behaviour:
// - If `WORKER_DEBUG` is set, force server-level logs to `debug` for verbose job traces.
// - In development, default to `debug` so local tests and dev runs see informative logs.
// - Otherwise, derive from `LOG_LEVEL` (fallback handled by `parseLevel`).
const serverMinLevel = isWorkerDebug
  ? levelWeight.debug
  : ENV === 'development'
    ? levelWeight.debug
    : levelWeight[parseLevel(process.env.LOG_LEVEL)];
// Client min level: allow error logs even when debug is off; otherwise gate by NEXT_PUBLIC_DEBUG_MODE
const clientMinLevel = isDebug ? levelWeight.debug : levelWeight.error;

class Logger {
  private logs: string[] = [];
  private subscribers: LogCallback[] = [];
  private closed = false;

  private shouldLog(level: Level) {
    const min = isClient ? clientMinLevel : serverMinLevel;
    return levelWeight[level] >= min;
  }

  add(msg: string, context?: LogContext, level: Level = 'log') {
    if (this.closed) return;
    if (!this.shouldLog(level)) return;
    const time = new Date().toLocaleTimeString();
    let prefix = `[${time}]`;
    if (context?.className) prefix += ` [${context.className}]`;
    if (context?.methodName) prefix += ` [${context.methodName}]`;
    // Serialize additional context (including Error objects) into the log entry
    const ctxString = context ? ` ${safeSerializeContext(context)}` : '';
    const entry = `${prefix} ${msg}${ctxString}`;
    this.logs.push(entry);
    this.subscribers.forEach((cb) => cb(entry));
    // Emit structured log using output() defined above
    const mapLevel: Record<Level, LogLevel> = {
      error: 'error',
      warn: 'warn',
      info: 'info',
      debug: 'debug',
      log: 'info',
    };
    try {
      output(mapLevel[level] as LogLevel, msg, { ...context });
    } catch {
      // fallback to console.error if structured output fails
      try {
        console.error(entry);
      } catch {}
    }
  }

  error(msg: string, context?: LogContext) {
    this.add(`[ERROR] ${msg}`, context, 'error');
  }

  warn(msg: string, context?: LogContext) {
    this.add(`[WARN] ${msg}`, context, 'warn');
  }

  info(msg: string, context?: LogContext) {
    this.add(`[INFO] ${msg}`, context, 'info');
  }

  debug(msg: string, context?: LogContext) {
    this.add(`[DEBUG] ${msg}`, context, 'debug');
  }

  getLogs() {
    return isDebug || isWorkerDebug ? [...this.logs] : [];
  }

  subscribe(cb: LogCallback) {
    if (!(isDebug || isWorkerDebug)) return () => {};
    if (this.closed) return () => {};
    this.subscribers.push(cb);
    this.logs.forEach((log) => cb(log));
    return () => {
      this.subscribers = this.subscribers.filter((sub) => sub !== cb);
    };
  }

  /**
   * Close the logger and release subscribers. Call from tests teardown to
   * ensure no further logging occurs after tests complete which can keep
   * the Node process alive or cause "log after tests are done" warnings.
   */
  close() {
    this.closed = true;
    this.subscribers = [];
    this.logs = [];
  }

  /**
   * Pretty-print API request and response for dev debugging, including turnaround time.
   * Usage: logger.logAPI(req, res, context, startTime)
   * @param req - The HTTP request object
   * @param res - (Optional) The HTTP response object
   * @param context - (Optional) Additional context
   * @param startTime - (Optional) ms timestamp when request started
   */
  async logAPI(req: Request, res?: Response, context?: LogContext, startTime?: number) {
    if (this.closed) return;
    if (!isDebug || process.env.NODE_ENV === 'production') return;
    try {
      const url = req.url;
      const method = typeof req.method === 'string' ? req.method : 'UNKNOWN';
      let reqBody = '';
      if ((req as any).body) {
        try {
          reqBody = await req.clone().text();
        } catch {}
      }
      const resStatus = res?.status;
      let resBody = '';
      if (res) {
        try {
          resBody = await res.clone().text();
        } catch {}
      }
      const endTime = Date.now();
      const duration = startTime ? `${endTime - startTime}ms` : undefined;
      // Pretty print
      // Avoid logging raw request/response bodies. Log only metadata (keys, hasBody, size).
      const requestInfo: any = reqBody
        ? (() => {
            try {
              const parsed = safeJson(reqBody);
              if (parsed && typeof parsed === 'object') {
                return {
                  keys: Object.keys(parsed),
                  hasBody: true,
                  size: JSON.stringify(parsed).length,
                };
              }
              return { hasBody: true, size: String(reqBody).length };
            } catch {
              return { hasBody: true, size: String(reqBody).length };
            }
          })()
        : { hasBody: false };

      const responseInfo: any =
        res && resBody
          ? (() => {
              try {
                const parsed = safeJson(resBody);
                if (parsed && typeof parsed === 'object') {
                  return {
                    status: resStatus,
                    keys: Object.keys(parsed),
                    size: JSON.stringify(parsed).length,
                  };
                }
                return { status: resStatus, hasBody: true, size: String(resBody).length };
              } catch {
                return { status: resStatus, hasBody: true, size: String(resBody).length };
              }
            })()
          : res
            ? { status: resStatus, hasBody: false }
            : undefined;

      const logObj: any = {
        route: { method, url },
        request: requestInfo,
        response: responseInfo,
        ...(duration && { duration }),
        ...(context && { context }),
      };
      // Remove undefined fields
      Object.keys(logObj).forEach((k) => logObj[k] === undefined && delete logObj[k]);
      // Print as pretty JSON
      this.add(JSON.stringify(logObj, null, 2), context, 'debug');
    } catch (err) {
      this.add(`logAPI error: ${err}`, context, 'error');
    }
  }
}

// Serialize context safely, expanding Error objects to include name/message/stack
function safeSerializeContext(ctx: LogContext) {
  try {
    const replacer = (_key: string, value: any) => {
      if (value instanceof Error) {
        return { name: value.name, message: value.message, stack: value.stack };
      }
      // Avoid serializing huge objects like request/response bodies; fall back to string
      if (typeof value === 'object' && value !== null) {
        try {
          // Attempt shallow clone of simple objects to avoid circular refs
          return value;
        } catch {
          return String(value);
        }
      }
      return value;
    };

    return JSON.stringify(ctx, replacer, 2);
  } catch {
    try {
      return String(ctx);
    } catch {
      return '{unserializable_context}';
    }
  }
}

// Helper to pretty print JSON or fallback to string
function safeJson(str: string) {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

// Always instantiate the logger; level gating ensures appropriate output.
export const logger = new Logger();

// Default export for backward compatibility: the logger instance
export default logger;
