import dotenv from 'dotenv';
import path from 'path';

// Prefer .env.local for local dev to avoid accidental usage of other env files
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import './bootstrap';

// bootstrap.ts registers the worker and starts it when imported in CLI-style.
// If bootstrap exports a function, ensure it runs on import; otherwise, import triggers existing CLI behaviour.
