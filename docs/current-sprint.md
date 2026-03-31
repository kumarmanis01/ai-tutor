# Current Sprint — MVP Bug Fix

## Goal
First student can: sign up -> onboard -> take diagnostic -> start AI session.

## Status: Blocked on content generation

---

## Checklist

### Infrastructure
- [x] VPS running (3 PM2 processes online)
- [x] Redis running (redis-cli ping -> PONG)
- [x] Migrations applied (20 migrations clean)
- [x] Email working (Resend, send.spinzyacademy.com)
- [x] DB reset + clean taxonomy (CBSE + ICSE only)
- [ ] tsx installed globally (npm install -g tsx)
- [ ] NCERT scraper run for Gr10 Maths + Science

### Content Pipeline
- [x] SyllabusWorker error tolerance (per-chapter try/catch)
- [x] NotesWorker retry on validation failure
- [x] aiOutputValidator min length reduced (200->80 chars)
- [x] Reconciler lifecycle filter fix (active chapters only)
- [x] Reconciler cascade verified (0->2->3 levels)
- [x] Complete-pipeline API built
- [ ] CBSE Gr10 Mathematics -- full cascade complete
- [ ] CBSE Gr10 Science -- full cascade complete
- [ ] Diagnostic gate unlocked for both subjects

### Student Flow
- [x] Profile gate fixed (subjects array parsing)
- [x] Parent email conditional (age < 13 only)
- [x] Diagnostic page no-redirect (shows "Vidya is getting ready")
- [x] Subject Readiness cards use correct SubjectDef.id
- [x] "Take diagnostic test" CTA correct href
- [ ] Language selector in onboarding form
- [ ] Mandatory subjects locked in onboarding (Mathematics + Science)
- [ ] Diagnostic questions render correctly
- [ ] Knowledge map shown after diagnostic
- [ ] AI tutor session starts after knowledge map

### Admin Panel
- [x] Sidebar 11 sections, 0 broken links
- [x] Dashboard real KPI data
- [x] Coverage & Hydrate with Notes column
- [x] Jobs page shows HydrationJob (not ExecutionJob)
- [x] System Health -- migration check fixed
- [x] Notification send history (NotificationLog)
- [x] Job detail page -- fix infinite Loading... when job not found
- [x] Details/View job links point to correct HydrationJob detail page
- [x] Content preview modal on Content Review page
- [ ] Sidebar badge counts match actual data

---

## Immediate Next Actions (in order)

1. Deploy latest commits to VPS
   ```
   git pull origin master && ./scripts/deploy-and-run.sh
   ```

2. Re-seed taxonomy (idempotent)
   ```
   set -a && source .env.production && set +a
   node scripts/seed-taxonomy.cjs
   ```

3. Trigger content for CBSE Gr10 Mathematics
   -> /admin/content -> [Generate all]

4. Monitor cascade on Neon (run every 5 min):
   ```sql
   SELECT sd.name, COUNT(DISTINCT cd.id) chapters,
     COUNT(DISTINCT td.id) topics, COUNT(DISTINCT tn.id) notes,
     COUNT(DISTINCT gq.id) questions
   FROM "SubjectDef" sd
   JOIN "ClassLevel" cl ON sd."classId" = cl.id
   JOIN "Board" b ON cl."boardId" = b.id
   LEFT JOIN "ChapterDef" cd ON cd."subjectId" = sd.id AND cd.lifecycle='active'
   LEFT JOIN "TopicDef" td ON td."chapterId" = cd.id AND td.lifecycle='active'
   LEFT JOIN "TopicNote" tn ON tn."topicId" = td.id
   LEFT JOIN "GeneratedQuestion" gq ON gq."topicId" = td.id
   WHERE b.slug='cbse' AND cl.grade=10
   AND sd.slug IN ('mathematics','science')
   GROUP BY sd.name;
   ```

5. Once questions > 0 -> test full student flow end to end

---

## Blockers
| Blocker | Owner | Notes |
|---------|-------|-------|
| Content not generated | Pipeline | Trigger Generate all from admin |
| Language selector missing from onboarding | Claude Code | Part 5D not implemented |

---

## Definition of Done (Phase 1)
- New student signs up -> onboards -> takes Gr10 Maths diagnostic
- Sees knowledge map -> starts AI tutor session
- Admin can see: student in /admin/users, session in /admin/sessions
- Welcome email received by student
