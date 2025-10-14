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
}

// Logging is enabled only if NEXT_PUBLIC_DEBUG_MODE === 'true'
const isDebug = process.env.NEXT_PUBLIC_DEBUG_MODE === 'true';

class Logger {
  private logs: string[] = [];
  private subscribers: LogCallback[] = [];

  add(msg: string, context?: LogContext) {
    if (!isDebug) return;
    const time = new Date().toLocaleTimeString();
    let prefix = `[${time}]`;
    if (context?.className) prefix += ` [${context.className}]`;
    if (context?.methodName) prefix += ` [${context.methodName}]`;
    const entry = `${prefix} ${msg}`;
    this.logs.push(entry);
    this.subscribers.forEach((cb) => cb(entry));
    // Also log to console in debug mode
    console.log(entry);
  }

  getLogs() {
    return isDebug ? [...this.logs] : [];
  }

  subscribe(cb: LogCallback) {
    if (!isDebug) return () => {};
    this.subscribers.push(cb);
    this.logs.forEach((log) => cb(log));
    return () => {
      this.subscribers = this.subscribers.filter((sub) => sub !== cb);
    };
  }

  /**
   * Log route request/response info in debug mode.
   * @param req - The request object.
   * @param res - The response object (optional).
   * @param context - Optional context for class and method names.
   */
  async logRouteInfo(req: Request, res?: Response, context?: LogContext) {
    if (!isDebug) return;
    try {
      const url = req.url;
      const method = typeof req.method === 'string' ? req.method : 'UNKNOWN';
      this.add(`Route: ${method} ${url}`, context);

      // Log request body (if available)
      if (req.body) {
        try {
          const reqBody = await req.clone().text();
          this.add(`Request Body: ${reqBody}`, context);
        } catch {}
      }

      // Log response status and body (if available)
      if (res) {
        this.add(`Response Status: ${res.status}`, context);
        try {
          const resBody = await res.clone().text();
          this.add(`Response Body: ${resBody}`, context);
        } catch {}
      }
    } catch (err) {
      this.add(`Logger error: ${err}`, context);
    }
  }
}

export const logger = isDebug
  ? new Logger()
  : {
      add: () => {},
      getLogs: () => [],
      subscribe: () => () => {},
      logRouteInfo: async () => {},
    };
