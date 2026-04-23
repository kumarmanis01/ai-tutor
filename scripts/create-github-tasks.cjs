#!/usr/bin/env node

const fs = require("fs");
const { execSync } = require("child_process");

// -----------------------------
// CONFIG
// -----------------------------

const FILE = process.argv[2];
const REPO = process.env.REPO;
const OWNER = process.env.OWNER;
const PROJECT_NAME = process.env.PROJECT_NAME || "Spinzy Project";

if (!FILE) {
  console.error("❌ Usage: node create-github-tasks.cjs <file.md>");
  process.exit(1);
}

if (!REPO || !OWNER) {
  console.error("❌ Set REPO and OWNER env variables");
  process.exit(1);
}

// -----------------------------
// HELPERS
// -----------------------------

function run(cmd) {
  try {
    return execSync(cmd, { encoding: "utf-8" }).trim();
  } catch (e) {
    console.error("❌ Command failed:", cmd);
    console.error(e.stdout?.toString() || "");
    process.exit(1);
  }
}

function normalizePhase(phase) {
  return phase.toLowerCase().trim().replace(/\s+/g, "-");
}

function writeTempBody(content, id) {
  const file = `.tmp_${id}.md`;
  fs.writeFileSync(file, content);
  return file;
}

function isAlreadyLinked(issueNumber, epicNumber) {
  const comments = JSON.parse(
    run(`gh issue view ${issueNumber} --repo ${REPO} --json comments`)
  ).comments;

  return comments.some(c =>
    c.body.includes(`Epic #${epicNumber}`)
  );
}

// -----------------------------
// PARSER
// -----------------------------

function parseStories(md) {
  const blocks = md.split(/\n## /).slice(1);

  return blocks.map((block) => {
    const lines = block.split("\n");
    const header = lines[0].trim();

    const match = header.match(/^([A-Z0-9.\-]+)\s*\|\s*(P[0-2])\s*\|\s*(.+)$/);
    if (!match) return null;

    const id = match[1].trim();
    const priority = match[2].trim();
    const title = match[3].trim();

    const getSection = (name) => {
      const regex = new RegExp(`### ${name}([\\s\\S]*?)(?=\\n### |$)`);
      const match = block.match(regex);
      return match ? match[1].trim() : "";
    };

    const labelsLine = block.match(/\*\*Labels:\*\*(.*)/);
    const phaseLine = block.match(/\*\*Phase:\*\*(.*)/);

    const labels = labelsLine
      ? labelsLine[1].split(",").map((l) => l.trim()).filter(Boolean)
      : [];

    const phase = phaseLine ? phaseLine[1].trim() : null;

    return {
      id,
      title,
      priority,
      labels,
      phase,
      body: `
## ${title}

### 🧾 User Story
${getSection("User Story")}

### ✅ Acceptance Criteria
${getSection("Acceptance Criteria")}

### 🛠 Dev Tasks
${getSection("Dev Tasks")}

### 🧪 QA
${getSection("QA")}
      `,
    };
  }).filter(Boolean);
}

// -----------------------------
// LOAD STORIES
// -----------------------------

const md = fs.readFileSync(FILE, "utf-8");
const stories = parseStories(md);

// -----------------------------
// LABEL SYSTEM (FIXED)
// -----------------------------

console.log("🏷 Ensuring labels...");

const existingLabels = JSON.parse(
  run(`gh label list --repo ${REPO} --limit 200 --json name`)
).map((l) => l.name);

// system labels
const systemLabels = ["P0", "P1", "P2", "epic"];

// dynamic phase labels
const dynamicPhaseLabels = new Set();

stories.forEach((s) => {
  if (s.phase) {
    dynamicPhaseLabels.add(`phase:${normalizePhase(s.phase)}`);
  }
});

// merge
const allLabels = [...systemLabels, ...dynamicPhaseLabels];

console.log("🧪 Phase labels:", [...dynamicPhaseLabels]);

// ensure labels exist
allLabels.forEach((label) => {
  if (!existingLabels.includes(label)) {
    console.log("➕ Creating label:", label);
    run(`gh label create "${label}" --repo ${REPO}`);
  }
});

// -----------------------------
// PROJECT SETUP
// -----------------------------

console.log("📊 Ensuring project...");

let projects = JSON.parse(
  run(`gh project list --owner ${OWNER} --format json`)
);

let project = projects.projects.find((p) => p.title === PROJECT_NAME);

let projectNumber;
let projectId;

if (!project) {
  console.log("➕ Creating project...");
  const created = JSON.parse(
    run(`gh project create --owner ${OWNER} --title "${PROJECT_NAME}" --format json`)
  );
  projectNumber = created.number;
  projectId = created.id;
} else {
  projectNumber = project.number;
  projectId = project.id;
}

console.log("🧪 Project:", { projectNumber, projectId });

// -----------------------------
// PHASE FIELD
// -----------------------------

console.log("🧱 Ensuring Phase field...");

let fields = JSON.parse(
  run(`gh project field-list ${projectNumber} --owner ${OWNER} --format json`)
).fields;

let phaseField = fields.find((f) => f.name === "Phase");

if (!phaseField) {
  console.log("➕ Creating Phase field...");

  const phaseOptionsList = [...dynamicPhaseLabels].map((l) =>
    l.replace("phase:", "")
  );

  run(
    `gh project field-create ${projectNumber} \
    --owner ${OWNER} \
    --name "Phase" \
    --data-type SINGLE_SELECT \
    --single-select-options "${phaseOptionsList.join(",")}"`
  );

  fields = JSON.parse(
    run(`gh project field-list ${projectNumber} --owner ${OWNER} --format json`)
  ).fields;

  phaseField = fields.find((f) => f.name === "Phase");
}

// map options
const phaseOptions = {};
phaseField.options.forEach((opt) => {
  phaseOptions[normalizePhase(opt.name)] = opt.id;
});

// -----------------------------
// EXISTING ISSUES
// -----------------------------

console.log("🔍 Fetching existing issues...");

const existingIssues = JSON.parse(
  run(`gh issue list --repo ${REPO} --limit 500 --state all --json number,title`)
);

// -----------------------------
// EPICS
// -----------------------------

const epicMap = {};

function getOrCreateEpic(phase) {
  const key = normalizePhase(phase);

  if (epicMap[key]) return epicMap[key];

  const existing = existingIssues.find((i) =>
    i.title.toLowerCase().includes(`[epic] ${key}`)
  );

  if (existing) {
    epicMap[key] = existing.number;
    return existing.number;
  }

  console.log(`🧱 Creating Epic: ${phase}`);

  const result = run(
    `gh issue create \
    --repo ${REPO} \
    --title "[EPIC] ${phase}" \
    --body "Epic for ${phase}" \
    --label "epic"`
  );

  const number = result.match(/issues\/(\d+)/)[1];
  epicMap[key] = number;

  return number;
}

// -----------------------------
// MAIN LOOP
// -----------------------------

for (const story of stories) {
  const title = `${story.id} | ${story.title}`;

  const existing = existingIssues.find((i) =>
    i.title.startsWith(story.id)
  );

  let issueNumber;



  if (existing) {
    console.log("🔁 Updating", story.id);

    issueNumber = existing.number;

    const tempFile = writeTempBody(story.body, story.id);
    console.log("🧾 Body preview:", {
      id: story.id,
      title: story.title,
      hasBody: !!story.body.trim(),
      length: story.body.length
    });

    run(
      `gh issue edit ${issueNumber} \
      --repo ${REPO} \
      --body-file "${tempFile}"`
    );

    fs.unlinkSync(tempFile);
  } else {
      console.log("➕ Creating", story.id);

      const tempFile = writeTempBody(story.body, story.id);
      console.log("🧾 Body preview:", {
        id: story.id,
        title: story.title,
        hasBody: !!story.body.trim(),
        length: story.body.length
      });      
      
      const result = run(
        `gh issue create \
        --repo ${REPO} \
        --title "${title}" \
        --body-file "${tempFile}"`
      );

      fs.unlinkSync(tempFile);

    issueNumber = result.match(/issues\/(\d+)/)[1];
  }

  // -------------------------
  // LABELS
  // -------------------------

  run(`gh issue edit ${issueNumber} --repo ${REPO} --add-label "${story.priority}"`);

  story.labels.forEach((l) => {
    run(`gh issue edit ${issueNumber} --repo ${REPO} --add-label "${l}"`);
  });

  if (story.phase) {
    const phaseLabel = `phase:${normalizePhase(story.phase)}`;

    run(`gh issue edit ${issueNumber} --repo ${REPO} --add-label "${phaseLabel}"`);

    const epic = getOrCreateEpic(story.phase);

    if (!isAlreadyLinked(issueNumber, epic)) {
      run(
        `gh issue comment ${issueNumber} \
        --repo ${REPO} \
        --body "Linked to Epic #${epic}"`
      );
    } else {
      console.log("Already linked");
    }
  }

  // -------------------------
  // PROJECT
  // -------------------------

  console.log("📌 Adding to project:", story.id);

  const item = JSON.parse(
    run(
      `gh project item-add ${projectNumber} \
      --owner ${OWNER} \
      --url https://github.com/${REPO}/issues/${issueNumber} \
      --format json`
    )
  );

  if (story.phase) {
    const optionId = phaseOptions[normalizePhase(story.phase)];

    if (optionId) {
      run(
        `gh project item-edit \
        --id ${item.id} \
        --project-id ${projectId} \
        --field-id ${phaseField.id} \
        --single-select-option-id ${optionId}`
      );
    }
  }
}

console.log("\n✅ V5.1 Sync Complete 🚀");