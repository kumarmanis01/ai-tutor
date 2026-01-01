import dotenv from 'dotenv';
import path from 'path';
import { pathToFileURL } from 'url';

const envPath = path.resolve(process.cwd(), '.env.production');
dotenv.config({ path: envPath });

const target = process.argv[2];
if (!target) {
  console.error('Usage: node scripts/run-with-env.mjs <compiled-js-path>');
  process.exit(1);
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
