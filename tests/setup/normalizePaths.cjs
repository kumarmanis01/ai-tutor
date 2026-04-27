const fs = require('fs')
const path = require('path')

const ORIGINAL_EXISTS = fs.existsSync.bind(fs)
const DEV_PREFIX = 'C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\'

function normalizePath(p) {
  try {
    if (typeof p === 'string' && p.startsWith(DEV_PREFIX)) {
      const rel = p.slice(DEV_PREFIX.length).replace(/\\\\/g, path.sep)
      const candidate = path.join(process.cwd(), rel)
      if (rel.startsWith('workers' + path.sep)) {
        const rest = rel.slice(('workers' + path.sep).length)
        const altServices = path.join(process.cwd(), 'worker', 'services', rest)
        if (ORIGINAL_EXISTS(altServices)) return altServices
        const altProcessors = path.join(process.cwd(), 'worker', 'processors', rest)
        if (ORIGINAL_EXISTS(altProcessors)) return altProcessors
        const altRoot = path.join(process.cwd(), 'worker', rest)
        if (ORIGINAL_EXISTS(altRoot)) return altRoot
      }
      return candidate
    }

    if (typeof p === 'string' && p.includes(path.sep + 'workers' + path.sep)) {
      const parts = p.split(path.sep)
      const idx = parts.indexOf('workers')
      if (idx !== -1 && idx < parts.length - 1) {
        const rest = parts.slice(idx + 1).join(path.sep)
        const altServices = path.join(process.cwd(), 'worker', 'services', rest)
        if (ORIGINAL_EXISTS(altServices)) return altServices
        const altProcessors = path.join(process.cwd(), 'worker', 'processors', rest)
        if (ORIGINAL_EXISTS(altProcessors)) return altProcessors
        const altRoot = path.join(process.cwd(), 'worker', rest)
        if (ORIGINAL_EXISTS(altRoot)) return altRoot
      }
    }
  } catch (e) {
    // fallback to original path if anything goes wrong
  }
  return p
}

fs.existsSync = function (p) {
  const normalized = normalizePath(p)
  return ORIGINAL_EXISTS(normalized)
}

module.exports = {}
