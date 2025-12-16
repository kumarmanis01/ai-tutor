import fs from "fs";
import path from "path";
import readline from "readline";
import { spawnSync } from "child_process";
// Runtime logger for script output — load the TypeScript logger at runtime via jiti
const jiti = require('jiti')(process.cwd());
const { logger } = jiti('../lib/logger');

/* ------------------ helpers ------------------ */

function readDatabaseUrl() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) throw new Error(".env file not found");

  const contents = fs.readFileSync(envPath, "utf8");
  const match = contents.match(/^DATABASE_URL\s*=\s*("?)(.+?)\1$/m);
  if (!match) throw new Error("DATABASE_URL not found in .env");

  let url = match[2].trim();
  // Remove accidental trailing dots (e.g. channel_binding=require.)
  while (url.endsWith(".")) url = url.slice(0, -1);
  return url;
}

function setPgPasswordFromUrl(dbUrl) {
  try {
    const u = new URL(dbUrl);
    if (u.password) {
      process.env.PGPASSWORD = u.password;
    }
  } catch {
    // intentionally ignored — URL parsing may fail for non-standard strings
  }
}

function logStep(msg) {
  logger.info(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  logger.info(`▶ ${msg}`);
  logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

function run(cmd, args, opts = {}) {
  logger.info(`$ ${cmd} ${args.join(" ")}`);
  const res = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: opts.shell ?? true,
  });

  if (res.error) throw res.error;
  if (res.status !== 0) {
    throw new Error(`${cmd} failed with exit code ${res.status}`);
  }
}

/* ------------------ confirmation ------------------ */

async function confirmDangerousAction(dbUrl) {
  // CI / automation path
  if (process.env.FORCE_DROP === "1" || process.env.CI === "true") {
    const allowFile = path.join(process.cwd(), ".allow_automation");

    if (!fs.existsSync(allowFile)) {
      logger.error("\n⚠️  FORCE_DROP requested but .allow_automation not found.");
      logger.error(
        "Create an empty .allow_automation file to allow automated destructive runs."
      );
      return false;
    }

    logger.info(
      "\n⚠️  FORCE_DROP / CI mode enabled and .allow_automation present — skipping confirmation"
    );
    return true;
  }

  // Interactive confirmation
  const masked = dbUrl.replace(/:\/\/.*@/, "://***@");
  logger.warn("\n⚠️  DANGER ZONE");
  logger.warn("You are about to DROP and RECREATE the database schema.");
  logger.warn("Database: " + masked);
  logger.warn("\nType EXACTLY:  DROP  to continue");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("> ", (answer) => {
      rl.close();
      resolve(answer === "DROP");
    });
  });
}

async function confirmDropMigrations(migrationsDir) {
  // If automation consent already provided, skip interactive prompt
  if (process.env.FORCE_DROP === "1" || process.env.CI === "true") {
    const allowFile = path.join(process.cwd(), ".allow_automation");
    if (fs.existsSync(allowFile)) {
      logger.info('\n⚠️  Automation allow file present — skipping migrations delete confirmation');
      return true;
    }
  }

  logger.warn(`\n⚠️  About to DELETE Prisma migrations directory: ${migrationsDir}`);
  logger.warn("This will permanently remove all migration files.\n");
  logger.warn("Type EXACTLY: DROP_MIGRATIONS to continue (or press Enter to abort)");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question("> ", (answer) => {
      rl.close();
      resolve(answer === "DROP_MIGRATIONS");
    });
  });
}

/* ------------------ main ------------------ */

(async () => {
  try {
    const dbUrl = readDatabaseUrl();
    setPgPasswordFromUrl(dbUrl);

    const confirmed = await confirmDangerousAction(dbUrl);
    if (!confirmed) {
      logger.info("\n❌ Aborted. No changes were made.");
      process.exit(0);
    }

    logStep("Dropping & recreating public schema");
    run(
      "psql",
      [
        "--dbname",
        dbUrl,
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;",
      ],
      { shell: false }
    );

    // Remove existing migrations to create a fresh baseline
    logStep("Removing existing Prisma migrations (interactive confirmation required)");
    const migrationsDir = path.resolve(process.cwd(), "prisma", "migrations");
    if (fs.existsSync(migrationsDir)) {
      const ok = await confirmDropMigrations(migrationsDir);
      if (!ok) {
        logger.info("\n❌ Aborted migrations deletion. No changes were made.");
        process.exit(0);
      }
      try {
        fs.rmSync(migrationsDir, { recursive: true, force: true });
        logger.info(`Removed ${migrationsDir}`);
      } catch (e) {
        logger.warn(`Could not remove migrations dir: ${e}`);
      }
    } else {
      logger.info("No existing migrations directory found");
    }

    // Create a fresh baseline migration (create-only) then deploy it
    logStep("Creating new baseline migration (create-only)");
    run("npx", ["prisma", "migrate", "dev", "--name", "init", "--create-only"]);

    logStep("Applying Prisma migrations");
    run("npx", ["prisma", "migrate", "deploy"]);

    logStep("Generating Prisma client");
    run("npx", ["prisma", "generate"]);

    // This reset script intentionally does NOT run any seed scripts.
    // Seeding should be performed separately to avoid accidental data inserts.
    logStep("Skipping seed execution — reset script only recreates schema and migrations");

    logger.info("\n✅ DATABASE RESET COMPLETE");
  } catch (err) {
    logger.error("\n❌ RESET FAILED");
    logger.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
})();
