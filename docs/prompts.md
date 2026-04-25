# Spinzy Academy — Reusable Prompt Templates

## HOW TO USE

Copy the template, fill [PLACEHOLDERS], paste into Claude Code or Chat.
Always include the CONTEXT BLOCK at the top of new chats.

---

## CONTEXT BLOCK (paste at start of every new chat)

```
Project: Spinzy Academy -- AI home tutor, Indian K-12
Stack: Next.js 16 + TypeScript + Prisma 6 + Neon PostgreSQL + Redis + BullMQ
VPS: /home/gnosiva/apps/content-engine/ai-tutor/
Deploy: ./scripts/deploy-and-run.sh

CRITICAL RULES:
- SQL: bash scripts/db-exec.sh "..." NEVER --stdin <
- Bash: val=$(eval echo "\$$var") NEVER ${!var}
- SubjectDef relation: 'class' NOT 'classLevel'
- SubjectDef FK: 'classId' NOT 'classLevelId'
- grade filter: ALWAYS class.grade + board.slug NEVER slug alone
- User.subjects: lowercase slugs {mathematics,science}
- User.role students: 'user' NOT 'student'
- EMAIL_FROM: "Spinzy Academy <no-reply@send.spinzyacademy.com>"
- Pre-commit: python3 scripts/fix-smart-quotes.py && npx tsc --noEmit && npm run build
```

---

## TEMPLATE 1 -- Fix a bug

```
# BUG FIX: [ONE LINE DESCRIPTION]
# Symptoms: [what the user sees]
# Suspected cause: [your hypothesis or "unknown"]

## Step 1 -- Read before touching
[list files to read]

## Step 2 -- Reproduce / confirm RCA
[grep commands or DB queries to confirm cause]

## Step 3 -- Fix
[describe the fix or paste the code]

## Step 4 -- Verify
[what to check after fix]

## Step 5
python3 scripts/fix-smart-quotes.py
npx tsc --noEmit --project tsconfig.json
npm run build && npm test
git add -A && git commit -m "fix: [description]"
```

---

## TEMPLATE 2 -- Build a feature

```
# FEATURE: [NAME]
# Goal: [one sentence -- what the user can do after this]
# Scope: [files to create/modify]

## Step 1 -- Read existing patterns
[files to read for context]

## Step 2 -- Build
[spec with TypeScript interfaces, Prisma queries, component structure]

## Step 3 -- Wire up
[where to import/render the new component or call the new API]

## Step 4 -- Edge cases
[list what could go wrong and how to handle]

## Step 5
python3 scripts/fix-smart-quotes.py
npx tsc --noEmit --project tsconfig.json
npm run build && npm test
git add -A && git commit -m "feat: [description]"
```

---

## TEMPLATE 3 -- Debug production issue

```
# PRODUCTION DEBUG: [SYMPTOM]
# URL: [affected route]
# Status: [HTTP status or error message]
# User impact: [who is affected]

## Step 1 -- Gather evidence
pm2 logs ai-tutor-web --lines 50 --nostream | grep -i "error\|Error" | tail -20
pm2 logs content-engine-worker --lines 30 --nostream | tail -20

## Step 2 -- Check DB state
[Neon SQL queries to confirm data state]

## Step 3 -- RCA
[read source files, identify root cause]

## Step 4 -- Fix and verify
[minimal change to fix + verification steps]

## Step 5
git add -A && git commit -m "fix: [description] -- [rca in one line]"
# Deploy:
git pull origin master && ./scripts/deploy-and-run.sh
```

---

## TEMPLATE 4 -- Safe refactor

```
# REFACTOR: [WHAT AND WHY]
# Risk: [low/medium/high]
# Files affected: [list]

## Step 1 -- Read all affected files completely
[list]

## Step 2 -- Identify all call sites
grep -rn "[pattern]" app/ lib/ worker/ --include="*.ts" --include="*.tsx" \
  | grep -v node_modules | grep -v .next

## Step 3 -- Refactor (one file at a time)
[change description]
After each file: npx tsc --noEmit

## Step 4 -- Verify nothing broken
npm run build && npm test
grep -rn "[old pattern]" app/ lib/ worker/ --include="*.ts"
# Must return zero results

## Step 5
git add -A && git commit -m "refactor: [description]"
```

---

## TEMPLATE 5 -- Content pipeline trigger

```
# CONTENT GENERATION: [SUBJECT] Grade [N] [BOARD]
# SubjectDef ID: [from DB query]
# Prerequisites: Redis running, tsx installed, worker online

## Trigger
From /admin/content -> find subject row -> click [Generate all]
OR:
curl -X POST https://spinzyacademy.com/api/admin/content/hydrate \
  -H "Content-Type: application/json" \
  -H "Cookie: [admin session]" \
  -d '{"subjectId":"[ID]","board":"cbse","grade":[N],"language":"en"}'

## Monitor (run every 5 min on Neon)
SELECT sd.name,
  COUNT(DISTINCT cd.id) chapters, COUNT(DISTINCT td.id) topics,
  COUNT(DISTINCT tn.id) notes,   COUNT(DISTINCT gq.id) questions
FROM "SubjectDef" sd
JOIN "ClassLevel" cl ON sd."classId" = cl.id
JOIN "Board" b ON cl."boardId" = b.id
LEFT JOIN "ChapterDef" cd ON cd."subjectId"=sd.id AND cd.lifecycle='active'
LEFT JOIN "TopicDef" td ON td."chapterId"=cd.id AND td.lifecycle='active'
LEFT JOIN "TopicNote" tn ON tn."topicId"=td.id
LEFT JOIN "GeneratedQuestion" gq ON gq."topicId"=td.id
WHERE sd.id = '[SubjectDef ID]'
GROUP BY sd.name;

## Healthy completion
chapters > 0, topics > 0, notes > 0, questions > 0
HydrationJob.status = 'completed', contentReady = true
```

---

## TEMPLATE 6 -- New chat handover

```
# HANDOVER CONTEXT
# Paste this at the start of every new Claude chat.

## Project
Spinzy Academy -- AI home tutor, Indian K-12.
Docs: /docs/ folder in repo (architecture.md, current-sprint.md etc.)

## Current state
[copy from current-sprint.md -> Immediate Next Actions]

## What I need from you
[specific task -- one thing only]

## Files relevant to this task
[list 2-5 files max]
```

---

## COMMON GREP PATTERNS

```bash
# Find broken SubjectDef queries
grep -rn "classLevel\b" app/ lib/ worker/ --include="*.ts" --include="*.tsx" \
  | grep -v node_modules | grep -v ".next" | grep -v "ClassLevel\b"

# Find hardcoded slugs
grep -rn "'math'\|'maths'\|'sci'\|'sst'" app/ lib/ --include="*.ts"

# Find redirect to dashboard (should not exist in diagnostic page)
grep -rn "redirect.*dashboard\|push.*dashboard" \
  app/\(student\)/diagnostic/ --include="*.tsx"

# Find nodemailer usage (must be zero)
grep -rn "nodemailer" lib/ app/ worker/ --include="*.ts" | grep -v node_modules

# Find non-upsert creates in seed
grep -n "\.create(" scripts/seed-taxonomy.cjs
```
