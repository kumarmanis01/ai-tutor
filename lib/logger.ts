type LogCallback = (msg: string) => void;

interface LogContext {
  className?: string;
  methodName?: string;
}

class Logger {
  private logs: string[] = [];
  private subscribers: LogCallback[] = [];

  add(msg: string, context?: LogContext) {
    const time = new Date().toLocaleTimeString();
    let prefix = `[${time}]`;
    if (context?.className) prefix += ` [${context.className}]`;
    if (context?.methodName) prefix += ` [${context.methodName}]`;
    const entry = `${prefix} ${msg}`;
    this.logs.push(entry);
    this.subscribers.forEach((cb) => cb(entry));
  }

  getLogs() {
    return [...this.logs];
  }

  subscribe(cb: LogCallback) {
    this.subscribers.push(cb);
    this.logs.forEach((log) => cb(log));
    return () => {
      this.subscribers = this.subscribers.filter((sub) => sub !== cb);
    };
  }
}

export const logger = new Logger();
