# Spinzy Academy — Dev Workflow

## Claude Chat vs Claude Code

| Use Claude Chat for | Use Claude Code for |
|--------------------|---------------------|
| RCA diagnosis from logs/DB output | Reading source files |
| SQL queries to run on Neon | Writing + editing code |
| Architecture decisions | Running build/test/lint |
| Prompt templates | Git commits |
| Handover docs | Deploying to VPS |
| "What's wrong?" analysis | "Fix this file" tasks |

**Rule:** Chat diagnoses. Code fixes.
Never paste 500 lines of source into Chat. Give Claude Code the file path.

---

## Session Structure

### Starting a new chat
1. Paste the CONTEXT BLOCK from prompts.md
2. Paste current-sprint.md -> Immediate Next Actions section
3. State ONE specific task
4. List 2-5 relevant files (not the content, just paths)

### During a session
- One task per Claude Code prompt
- Always end with: `python3 scripts/fix-smart-quotes.py && npx tsc --noEmit && npm run build`
- Always commit before moving to next task
- Never leave uncommitted changes overnight

### When to reset chat
- After 3+ back-and-forth exchanges on same bug -> start fresh with diagnosis
- After any successful feature completion
- When context window feels "heavy" (responses slow/repetitive)
- After every deploy

---

## Token Efficiency Rules

1. **Never paste full file contents into Chat** -- give paths, Claude Code reads them
2. **Never ask Chat to write code** -- ask Chat for diagnosis/plan, give Code the fix prompt
3. **One bug per prompt** -- mixing bugs leads to missed fixes
4. **Grep before reading** -- narrow down to relevant lines before reading full files
5. **Use the templates** -- prompts.md templates are pre-optimised for minimal tokens

---

## Deploy Workflow

```
# Standard deploy (from VPS)
cd /home/gnosiva/apps/content-engine/ai-tutor
git pull origin master
./scripts/deploy-and-run.sh

# Verify
pm2 list                          # all 3 processes online
pm2 logs ai-tutor-web --lines 5 --nostream | grep -i error
redis-cli ping                    # PONG
curl -I https://spinzyacademy.com # 200
```

**Never deploy** without:
- Passing build locally
- Passing tests locally
- Smart quotes fixed

---

## Staging Workflow

```
# Deploy to staging (port 3001)
cd /home/gnosiva/apps/content-engine/ai-tutor-staging
git checkout [branch]
./scripts/deploy-staging.sh

# Test at https://staging.spinzyacademy.com

# Promote to production
./scripts/promote-to-production.sh
```

---

## DB Operations

```bash
# Always use db-exec.sh -- never --stdin <
bash scripts/db-exec.sh "SELECT COUNT(*) FROM \"User\";"

# Run migration
npx prisma migrate deploy

# Re-seed taxonomy (safe, idempotent)
set -a && source .env.production && set +a
node scripts/seed-taxonomy.cjs

# Emergency content wipe (pre-launch only)
# TRUNCATE "GeneratedQuestion","TopicNote","TopicDef","ChapterDef","HydrationJob" CASCADE;
```

---

## Daily Checklist (5 min)

```
[] pm2 list -> all 3 online?
[] redis-cli ping -> PONG?
[] /admin/system/health -> all green?
[] /admin/jobs -> any failed jobs?
[] /admin/safety -> any distress alerts?
[] current-sprint.md -> what's the next checkbox?
```

---

## Pre-commit Checklist (non-negotiable)

```bash
python3 scripts/fix-smart-quotes.py   # fix unicode quotes
npx tsc --noEmit --project tsconfig.json  # type check
npm run build                          # build must pass
npm test                               # tests must pass
git add -A && git commit -m "type: description"
```

Commit types: `feat:` `fix:` `refactor:` `docs:` `chore:`

---

## Debugging Hierarchy

1. **Check PM2 logs first**
   `pm2 logs ai-tutor-web --lines 50 --nostream | grep -i error`

2. **Check DB state**
   Run relevant Neon SQL query

3. **Read the source file**
   Give Claude Code the file path, ask it to find the issue

4. **Grep for the pattern**
   Search codebase for the specific function/field

5. **Fix minimal change**
   Touch as few files as possible

6. **Verify with curl or browser**
   Confirm fix before committing

---

## Content Generation Priority

```
Priority 1 (unblocks diagnostic):
  CBSE Gr10: Mathematics, Science

Priority 2 (core student cohort):
  CBSE Gr10: English, Social Science, Hindi
  CBSE Gr9:  Mathematics, Science

Priority 3 (expand reach):
  CBSE Gr8, Gr7, Gr6: Mathematics, Science, English

Priority 4 (post-launch):
  CBSE Gr11, Gr12 (science stream)
  ICSE equivalents
  Grades 1-5
```

Run NCERT scraper before each subject for accurate chapter names:
```bash
npx tsx scripts/scrape-ncert.ts --grade 10 --subject mathematics --lang en
```
