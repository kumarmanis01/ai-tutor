import dotenv from 'dotenv';
import path from 'path';

// DEV WORKER ENV LOADER
// - Always load variables from the single source of truth: .env
// - This ensures DATABASE_URL and REDIS_URL match what `npm run dev` and `npm run build` see.
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

// Import the standard `entry.ts` which performs validation and calls `bootstrapWorker()`.
// We load `.env` first so the entry's environment checks pass in dev.
import './entry';

// bootstrap.ts registers the worker and starts it when imported in CLI-style.
// If bootstrap exports a function, ensure it runs on import; otherwise, import triggers existing CLI behaviour.
