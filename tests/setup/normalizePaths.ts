import fs from 'fs';
import path from 'path';

const ORIGINAL_EXISTS = fs.existsSync;
const DEV_PREFIX = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\";

function normalizePath(p: fs.PathLike) {
  if (typeof p === 'string' && p.startsWith(DEV_PREFIX)) {
    const rel = p.slice(DEV_PREFIX.length).replace(/\\\\/g, path.sep);
    const candidate = path.join(process.cwd(), rel);
    // If tests reference a legacy `workers/...` folder, map to `worker/services/...`
    if (rel.startsWith('workers' + path.sep)) {
      const rest = rel.slice(('workers' + path.sep).length);
      const altServices = path.join(process.cwd(), 'worker', 'services', rest);
      if (ORIGINAL_EXISTS.call(fs, altServices)) return altServices;
      const altProcessors = path.join(process.cwd(), 'worker', 'processors', rest);
      if (ORIGINAL_EXISTS.call(fs, altProcessors)) return altProcessors;
      const altRoot = path.join(process.cwd(), 'worker', rest);
      if (ORIGINAL_EXISTS.call(fs, altRoot)) return altRoot;
    }
    return candidate;
  }
  // Also handle generic paths that may include `/workers/` but don't start with DEV_PREFIX
  if (typeof p === 'string' && p.includes(path.sep + 'workers' + path.sep)) {
    const parts = p.split(path.sep);
    const idx = parts.indexOf('workers');
    if (idx !== -1 && idx < parts.length - 1) {
      const rest = parts.slice(idx + 1).join(path.sep);
      const altServices = path.join(process.cwd(), 'worker', 'services', rest);
      if (ORIGINAL_EXISTS.call(fs, altServices)) return altServices;
      const altProcessors = path.join(process.cwd(), 'worker', 'processors', rest);
      if (ORIGINAL_EXISTS.call(fs, altProcessors)) return altProcessors;
      const altRoot = path.join(process.cwd(), 'worker', rest);
      if (ORIGINAL_EXISTS.call(fs, altRoot)) return altRoot;
    }
  }
  return p;
}

(fs as any).existsSync = function (p: fs.PathLike) {
  try {
    const normalized = normalizePath(p);
    return ORIGINAL_EXISTS.call(fs, normalized);
  } catch {
      return ORIGINAL_EXISTS.call(fs, p);
    }
};

export {};
