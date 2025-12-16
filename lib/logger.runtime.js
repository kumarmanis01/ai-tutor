/* eslint-disable no-console */
// Lightweight runtime logger for scripts and non-TS runtimes.
// This file intentionally mirrors the public API used in the codebase
// and forwards to console.*. It avoids importing the TypeScript
// `lib/logger.ts` implementation so scripts can run with plain Node.
const logger = {
  error: (...args) => {
    try { console.error(...args); } catch {};
  },
  warn: (...args) => {
    try { console.warn(...args); } catch {};
  },
  info: (...args) => {
    try { console.log(...args); } catch {};
  },
  log: (...args) => {
    try { console.log(...args); } catch {};
  },
  debug: (...args) => {
    try {
      if (console.debug) console.debug(...args);
      else console.log(...args);
    } catch {}
  },
};

module.exports = { logger };
