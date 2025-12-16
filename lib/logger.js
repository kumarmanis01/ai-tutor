// Lightweight CommonJS logger used by scripts and test helpers.
// Keeps API compatible with `const { logger } = require('../../lib/logger')`.
function formatArgs(level, args) {
  const prefix = `[${level}]`;
  return [prefix].concat(Array.from(args || []));
}

const logger = {
  info: (...args) => console.log.apply(console, formatArgs('INFO', args)),
  warn: (...args) => console.warn.apply(console, formatArgs('WARN', args)),
  error: (...args) => console.error.apply(console, formatArgs('ERROR', args)),
  debug: (...args) => (console.debug ? console.debug.apply(console, formatArgs('DEBUG', args)) : console.log.apply(console, formatArgs('DEBUG', args))),
};

module.exports = { logger };
