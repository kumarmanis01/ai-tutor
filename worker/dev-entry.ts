import dotenv from 'dotenv';
import path from 'path';

// Prefer .env.local for local dev to avoid accidental usage of other env files
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Import the standard `entry.ts` which performs validation and calls `bootstrapWorker()`.
// We load `.env.local` first so the entry's environment checks pass in dev.
import './entry';

// bootstrap.ts registers the worker and starts it when imported in CLI-style.
// If bootstrap exports a function, ensure it runs on import; otherwise, import triggers existing CLI behaviour.
