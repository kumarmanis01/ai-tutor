// Shim to gracefully handle ESM-only chalk when a CJS `require('chalk')` is attempted.
const Module = require('module');
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'chalk') {
    try {
      // Try normal load (may throw if chalk is ESM)
      return originalLoad.apply(this, arguments);
    } catch (err) {
      // Return a minimal fallback compatible with existing usage in component-tagger
      return {
        default: {
          red: (s) => s,
          green: (s) => s,
          blue: (s) => s,
          yellow: (s) => s,
        },
      };
    }
  }
  return originalLoad.apply(this, arguments);
};
