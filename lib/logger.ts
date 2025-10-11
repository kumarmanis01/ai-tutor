/**
 * Logger utility for capturing logs with optional class and method context.
 *
 * In production mode (NODE_ENV === 'production'), logger is a no-op:
 * - No logs are recorded, emitted, or stored.
 *
 * Usage:
 *   logger.add('A log message', { className: 'MyClass', methodName: 'myMethod' });
 *   logger.subscribe((msg) => { ... }); // Reactively receive new log entries
 *   logger.getLogs(); // Retrieve all logs
 */

type LogCallback = (msg: string) => void;

/**
 * Optional context for log entries.
 * - className: Name of the class or component generating the log.
 * - methodName: Name of the method or function generating the log.
 */
interface LogContext {
  className?: string;
  methodName?: string;
}

const isDev = process.env.NODE_ENV !== 'production';

class Logger {
  private logs: string[] = [];
  private subscribers: LogCallback[] = [];

  /**
   * Add a log entry.
   * Only logs in development mode.
   * @param msg - The log message.
   * @param context - Optional context for class and method names.
   */
  add(msg: string, context?: LogContext) {
    if (!isDev) return;
    const time = new Date().toLocaleTimeString();
    let prefix = `[${time}]`;
    if (context?.className) prefix += ` [${context.className}]`;
    if (context?.methodName) prefix += ` [${context.methodName}]`;
    const entry = `${prefix} ${msg}`;
    this.logs.push(entry);
    this.subscribers.forEach((cb) => cb(entry));
  }

  /**
   * Get all log entries.
   * @returns Array of log strings.
   */
  getLogs() {
    return isDev ? [...this.logs] : [];
  }

  /**
   * Subscribe to log updates.
   * @param cb - Callback to receive new log entries.
   * @returns Unsubscribe function.
   */
  subscribe(cb: LogCallback) {
    if (!isDev) return () => {};
    this.subscribers.push(cb);
    this.logs.forEach((log) => cb(log));
    return () => {
      this.subscribers = this.subscribers.filter((sub) => sub !== cb);
    };
  }
}

/**
 * Export a singleton logger instance.
 * In production, logger methods are no-ops.
 */
export const logger = isDev
  ? new Logger()
  : {
      add: () => {},
      getLogs: () => [],
      subscribe: () => () => {},
    };
