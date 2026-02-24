#!/usr/bin/env node

/**
 * validate-master-branch.cjs
 *
 * Runs full validation stack before pushing master.
 * Stops immediately on any failure.
 */

const { spawnSync } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");

function runStep(name, command, args) {
  console.log("\n══════════════════════════════════════════════");
  console.log(`▶ Running: ${name}`);
  console.log("══════════════════════════════════════════════\n");

  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });

  if (result.status !== 0) {
    console.error(`\n❌ FAILED: ${name}`);
    process.exit(result.status || 1);
  }

  console.log(`\n✅ PASSED: ${name}`);
}

function main() {
  console.log("\n🚦 MASTER BRANCH VALIDATION STARTED\n");

  // 1️⃣ TypeScript Check
  runStep(
    "TypeScript Type Check",
    "npx",
    ["tsc", "--noEmit", "-p", "tsconfig.build.json"]
  );

  // 2️⃣ Next.js Production Build
  runStep("Next.js Production Build", "npm", ["run", "build"]);

  // 3️⃣ Prisma Validate
  runStep("Prisma Validate", "npx", ["prisma", "validate"]);
  runStep("Prisma Generate", "npx", ["prisma", "generate"]);

  // 4️⃣ Deterministic Engine Scenarios
  runStep("MVP Flow Test", "node", ["scripts/test-mvp-flow.cjs"]);

  // 5️⃣ Chaos Simulation (safe dry-run)
  runStep(
    "Chaos Simulation (mixed-70 dry-run)",
    "node",
    ["scripts/chaos-progress-simulation.cjs", "--mode=mixed-70", "--dry-run"]
  );

  // 6️⃣ Concurrency Stress Test (50 users)
  runStep(
    "Concurrency Stress Test (50 users)",
    "node",
    ["scripts/concurrency-stress-test.cjs", "--mode=mixed-70", "--users=50"]
  );

  // 7️⃣ Logging Safety Audit
  runStep(
    "Logging Safety Audit",
    "node",
    ["scripts/audit-logs-safety.cjs"]
  );

  // 8️⃣ Final Prelaunch Check
  runStep(
    "Prelaunch Environment Check",
    "node",
    ["scripts/prelaunch-check.cjs"]
  );

  console.log("\n══════════════════════════════════════════════");
  console.log("🎉 ALL VALIDATION STEPS PASSED");
  console.log("🚀 MASTER BRANCH IS SAFE TO PUSH");
  console.log("══════════════════════════════════════════════\n");
}

main();