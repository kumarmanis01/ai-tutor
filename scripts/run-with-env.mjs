import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';
import { pathToFileURL } from 'url';

// Prefer an existing DATABASE_URL from the environment (CI sets this via GITHUB_ENV).
// Only load .env.production when present and when DATABASE_URL is not already set.
const envPath = path.resolve(process.cwd(), '.env.production');
if (!process.env.DATABASE_URL) {
  if (fs.existsSync(envPath)) {
    const result = dotenv.config({ path: envPath });
    if (result.error) {
      console.warn('Failed to load .env.production:', result.error);
    } else {
      console.log('Loaded environment from .env.production');
    }
  } else {
    console.log('.env.production not found; relying on existing environment variables');
  }
} else {
  console.log('DATABASE_URL already set in environment; skipping .env.production load');
}

const target = process.argv[2];
if (!target) {
  console.error('Usage: node scripts/run-with-env.mjs <compiled-js-path>');
  process.exit(1);
}

// Log presence of DATABASE_URL for debugging (do not print the value in CI logs).
if (process.env.DATABASE_URL) {
  console.log('DATABASE_URL is set');
} else {
  console.warn('DATABASE_URL is NOT set — integration tests may be skipped or fail');
}

const full = path.resolve(process.cwd(), target);
(async () => {
  try {
    await import(pathToFileURL(full).href);
  } catch (err) {
    console.error('Error running target:', err);
    process.exit(1);
  }
})();
