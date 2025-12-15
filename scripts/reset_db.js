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
  // Remove accidental trailing dot(s) which can break psql parsing (e.g. channel_binding=require.)
  while (url.endsWith('.')) url = url.slice(0, -1);
  return url;
}

function setPgPasswordFromUrl(dbUrl) {
  try {
    // Use WHATWG URL to parse credentials if possible
    const u = new URL(dbUrl);
    if (u.password) {
      process.env.PGPASSWORD = u.password;
    }
  } catch (e) {
    // ignore parse errors; leave PGPASSWORD unset
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
    shell: opts.shell !== undefined ? opts.shell : true, // default true, but can be disabled
  });
  if (res.error) throw res.error;
  if (res.status !== 0) throw new Error(`${cmd} failed with exit code ${res.status}`);
}

/* ------------------ confirmation ------------------ */

function confirmDangerousAction(dbUrl) {
  // Allow CI / automation to skip interactive confirmation
  if (process.env.FORCE_DROP === '1' || process.env.CI === 'true') {
    console.log('\n⚠️  FORCE_DROP or CI mode enabled — skipping interactive confirmation');
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const masked = dbUrl.replace(/:\/\/.*@/, "://***@");
    console.log("\n⚠️  DANGER ZONE");
    console.log("You are about to DROP and RECREATE the database schema.");
    console.log("Database:", masked);
    console.log("\nType EXACTLY:  DROP  to continue");

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question("> ", (answer) => {
      rl.close();
      resolve(answer === "DROP");
    });
  });
}

/* ------------------ main ------------------ */

(async () => {
  try {
    const dbUrl = readDatabaseUrl();

    // Export password (if present) so psql won't prompt interactively
    setPgPasswordFromUrl(dbUrl);

    const confirmed = await confirmDangerousAction(dbUrl);
    if (!confirmed) {
      console.log("\n❌ Aborted. No changes were made.");
      process.exit(0);
    }

    logStep("Dropping & recreating public schema");
    // Use shell: false so the -c argument is passed exactly (avoids shell semicolon splitting)
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

    logStep("Applying Prisma migrations");
    run("npx", ["prisma", "migrate", "deploy"]);

    logStep("Generating Prisma client");
    run("npx", ["prisma", "generate"]);

    const seedTs = path.resolve(process.cwd(), "scripts", "seed_ai_content.ts");
    const seedJs = path.resolve(process.cwd(), "scripts", "seed.js");

    if (fs.existsSync(seedTs)) {
      logStep("Running TypeScript seed");
      run("npx", ["ts-node", seedTs]);
    } else if (fs.existsSync(seedJs)) {
      logStep("Running JavaScript seed");
      run("node", [seedJs]);
    } else {
      logStep("No seed script found (skipping)");
    }

    console.log("\n✅ DATABASE RESET COMPLETE");
  } catch (err) {
    console.error("\n❌ RESET FAILED");
    console.error(err.message || err);
    process.exit(1);
  }
})();
