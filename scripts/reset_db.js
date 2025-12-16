import fs from "fs";
import path from "path";
import readline from "readline";
import { spawnSync } from "child_process";

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
  } catch (err) {
    console.error('Warning: could not parse DATABASE_URL for password extraction:', err);
    // intentionally ignored — URL parsing may fail for non-standard strings
  }
}

function logStep(msg) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`▶ ${msg}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

function run(cmd, args, opts = {}) {
  console.log(`$ ${cmd} ${args.join(" ")}`);
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
      console.error("\n⚠️  FORCE_DROP requested but .allow_automation not found.");
      console.error(
        "Create an empty .allow_automation file to allow automated destructive runs."
      );
      return false;
    }

    console.log(
      "\n⚠️  FORCE_DROP / CI mode enabled and .allow_automation present — skipping confirmation"
    );
    return true;
  }

  // Interactive confirmation
  const masked = dbUrl.replace(/:\/\/.*@/, "://***@");
  console.log("\n⚠️  DANGER ZONE");
  console.log("You are about to DROP and RECREATE the database schema.");
  console.log("Database:", masked);
  console.log("\nType EXACTLY:  DROP  to continue");

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
      console.log('\n⚠️  Automation allow file present — skipping migrations delete confirmation');
      return true;
    }
  }

  console.log(`\n⚠️  About to DELETE Prisma migrations directory: ${migrationsDir}`);
  console.log("This will permanently remove all migration files.\n");
  console.log("Type EXACTLY: DROP_MIGRATIONS to continue (or press Enter to abort)");

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
      console.log("\n❌ Aborted. No changes were made.");
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
        console.log("\n❌ Aborted migrations deletion. No changes were made.");
        process.exit(0);
      }
      try {
        fs.rmSync(migrationsDir, { recursive: true, force: true });
        console.log(`Removed ${migrationsDir}`);
      } catch (e) {
        console.warn(`Could not remove migrations dir: ${e}`);
      }
    } else {
      console.log("No existing migrations directory found");
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

    console.log("\n✅ DATABASE RESET COMPLETE");
  } catch (err) {
    console.error("\n❌ RESET FAILED");
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
})();
