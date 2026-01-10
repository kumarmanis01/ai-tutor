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
  if (v === 'error' || v === 'warn' || v === 'info' || v === 'debug' || v === 'log') return v as Level;
  return 'error';
}

// Server log level via env; default to 'error' to preserve production visibility for errors
const serverMinLevel = levelWeight[parseLevel(process.env.LOG_LEVEL)];
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
    const entry = `${prefix} ${msg}`;
    this.logs.push(entry);
    this.subscribers.forEach((cb) => cb(entry));
    // Also log to console with appropriate level
    if (level === 'error') console.error(entry);
    else if (level === 'warn') console.warn(entry);
    else console.log(entry);
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
    return isDebug ? [...this.logs] : [];
  }

  subscribe(cb: LogCallback) {
    if (!isDebug) return () => {};
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
      if (req.body) {
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
      const logObj: any = {
        route: { method, url },
        request: reqBody ? safeJson(reqBody) : undefined,
        response: res ? { status: resStatus, body: resBody ? safeJson(resBody) : undefined } : undefined,
        ...(duration && { duration }),
        ...(context && { context }),
      };
      // Remove undefined fields
      Object.keys(logObj).forEach((k) => logObj[k] === undefined && delete logObj[k]);
      // Print as pretty JSON
      console.log('[API DEBUG]', JSON.stringify(logObj, null, 2));
    } catch (err) {
      this.add(`logAPI error: ${err}`, context, 'error');
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
