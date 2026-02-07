# HydrateAll Deployment Checklist

**Project**: AI Tutor Platform
**Feature**: HydrateAll Content Generation Pipeline
**Date**: 2026-01-31
**Status**: Ready for Deployment

---

## 📦 DELIVERED COMPONENTS

### ✅ 1. Documentation
| File | Purpose | Status |
|------|---------|--------|
| [HYDRATEALL_IMPLEMENTATION_GUIDE.md](./HYDRATEALL_IMPLEMENTATION_GUIDE.md) | Complete implementation reference | ✅ Done |
| [HYDRATEALL_DEPLOYMENT_CHECKLIST.md](./HYDRATEALL_DEPLOYMENT_CHECKLIST.md) | This deployment guide | ✅ Done |
| [HYDRATEALL_FINAL_ARCHITECTURE.md](./HYDRATEALL_FINAL_ARCHITECTURE.md) | Original architecture spec | ✅ Existing |
| [hydrateAll-architecture.md](./hydrateAll-architecture.md) | Architectural patterns | ✅ Existing |

### ✅ 2. Backend API Endpoints
| File | Endpoint | Status |
|------|----------|--------|
| [app/api/admin/hydrateAll/route.ts](../app/api/admin/hydrateAll/route.ts) | POST /api/admin/hydrateAll | ✅ Implemented |
| [app/api/admin/hydrateAll/[jobId]/route.ts](../app/api/admin/hydrateAll/[jobId]/route.ts) | GET /api/admin/hydrateAll/:jobId | ✅ Implemented |
| [app/api/admin/hydrateAll/[jobId]/route.ts](../app/api/admin/hydrateAll/[jobId]/route.ts) | DELETE /api/admin/hydrateAll/:jobId | ✅ Implemented |

### ✅ 3. Admin UI Components
| File | Component | Status |
|------|-----------|--------|
| [app/admin/content-engine/hydrateAll/page.tsx](../app/admin/content-engine/hydrateAll/page.tsx) | Main page with tabs | ✅ Implemented |
| [app/admin/content-engine/hydrateAll/components/TriggerForm.tsx](../app/admin/content-engine/hydrateAll/components/TriggerForm.tsx) | Job submission form | ✅ Implemented |
| [app/admin/content-engine/hydrateAll/components/ProgressDashboard.tsx](../app/admin/content-engine/hydrateAll/components/ProgressDashboard.tsx) | Real-time progress | ✅ Implemented |
| [app/admin/content-engine/hydrateAll/components/JobsTable.tsx](../app/admin/content-engine/hydrateAll/components/JobsTable.tsx) | Job history table | ✅ Implemented |

### ✅ 4. Worker Services
| File | Purpose | Status |
|------|---------|--------|
| [worker/services/hydrationReconciler.ts](../worker/services/hydrationReconciler.ts) | Cascade orchestrator | ✅ Implemented |
| [worker/services/syllabusWorker.ts](../worker/services/syllabusWorker.ts) | Chapter/topic generation | ✅ Existing |
| [worker/services/notesWorker.ts](../worker/services/notesWorker.ts) | Note generation | ✅ Existing |
| [worker/services/questionsWorker.ts](../worker/services/questionsWorker.ts) | Question generation | ✅ Existing |

### ✅ 5. Tests
| File | Type | Status |
|------|------|--------|
| [tests/unit/api/hydrateAll.test.ts](../tests/unit/api/hydrateAll.test.ts) | Unit tests - API | ✅ Implemented |
| [tests/unit/worker/services/hydrationReconciler.test.ts](../tests/unit/worker/services/hydrationReconciler.test.ts) | Unit tests - Reconciler | ✅ Implemented |
| [tests/integration/hydrateAll-e2e.test.ts](../tests/integration/hydrateAll-e2e.test.ts) | E2E integration test | ✅ Implemented |

### ✅ 6. Infrastructure
| Component | Status | Notes |
|-----------|--------|-------|
| Database Schema | ✅ Exists | HydrationJob, Outbox, ExecutionJob tables |
| Metrics | ✅ Exists | [lib/metrics/hydrateMetrics.ts](../lib/metrics/hydrateMetrics.ts) |
| Outbox Dispatcher | ✅ Exists | [worker/outboxDispatcher.ts](../worker/outboxDispatcher.ts) |

---

## 🚀 DEPLOYMENT STEPS

### Phase 1: Pre-Deployment Verification

#### Step 1.1: Verify Database Schema
```bash
# Check if HydrationJob table has all required fields
npx prisma studio
# Navigate to HydrationJob table and verify columns:
# - hierarchyLevel
# - chaptersExpected/Completed
# - topicsExpected/Completed
# - notesExpected/Completed
# - questionsExpected/Completed
# - estimatedCostUsd/actualCostUsd
# - estimatedDurationMins/actualDurationMins
```

#### Step 1.2: Run Type Check
```bash
npm run type-check
```

Expected Output:
```
✓ No TypeScript errors
```

#### Step 1.3: Run Linter
```bash
npm run lint
```

Expected Output:
```
✓ 0 warnings, 0 errors
```

#### Step 1.4: Run Unit Tests
```bash
npm run test:unit
```

Expected Output:
```
✓ All tests pass
```

---

### Phase 2: Database Migration (if needed)

#### Step 2.1: Check Current Schema
```bash
npx prisma db pull
npx prisma generate
```

#### Step 2.2: Create Migration (if schema changes needed)
```sql
-- Check if fields exist in HydrationJob table
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'HydrationJob'
  AND column_name IN (
    'chaptersExpected', 'chaptersCompleted',
    'topicsExpected', 'topicsCompleted',
    'notesExpected', 'notesCompleted',
    'questionsExpected', 'questionsCompleted',
    'estimatedCostUsd', 'actualCostUsd',
    'estimatedDurationMins', 'actualDurationMins',
    'hierarchyLevel'
  );
```

If missing fields, create migration:
```bash
npx prisma migrate dev --name add_hydrateall_progress_tracking
```

#### Step 2.3: Test Migration on Staging
```bash
# On staging environment
DATABASE_URL="<staging_db_url>" npx prisma migrate deploy
```

---

### Phase 3: Code Deployment

#### Step 3.1: Build Application
```bash
npm run build:prod
```

Expected Output:
```
✓ Next.js build successful
✓ Worker build successful
✓ dist/ directory created
```

#### Step 3.2: Deploy API Server (Zero-Downtime)
```bash
# Using PM2 (example)
pm2 reload ecosystem.config.cjs --only api-server

# Using Kubernetes (example)
kubectl set image deployment/api-server \
  api-server=your-registry/ai-tutor:latest \
  --record

# Verify deployment
kubectl rollout status deployment/api-server
```

#### Step 3.3: Deploy Worker Pool
```bash
# PM2
pm2 reload ecosystem.config.cjs --only content-engine-worker

# K8s (rolling update)
kubectl set image deployment/worker-pool \
  worker=your-registry/ai-tutor-worker:latest \
  --record
```

#### Step 3.4: Deploy Reconciler (Ensure Singleton)
```bash
# PM2 (cron job)
# Add to crontab:
# */5 * * * * cd /path/to/app && npm run reconcile

# K8s (CronJob)
kubectl apply -f deployment/k8s/reconciler-cronjob.yaml
```

Example CronJob YAML:
```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: hydration-reconciler
spec:
  schedule: "*/5 * * * *"  # Every 5 minutes
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: reconciler
            image: your-registry/ai-tutor:latest
            command: ["node", "dist/worker/services/hydrationReconciler.js"]
            env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: db-secret
                  key: url
          restartPolicy: OnFailure
```

---

### Phase 4: Verification

#### Step 4.1: Smoke Test - Submit Test Job
```bash
# Using curl
curl -X POST https://your-domain/api/admin/hydrateAll \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "language": "en",
    "boardCode": "CBSE",
    "grade": "1",
    "subjectCode": "MATH",
    "options": {
      "generateNotes": true,
      "generateQuestions": false,
      "dryRun": true
    }
  }'
```

Expected Response (200 OK):
```json
{
  "rootJobId": "dry-run",
  "status": "dry-run",
  "estimates": {
    "totalChapters": 12,
    "estimatedTopics": 60,
    "estimatedNotes": 60,
    "estimatedQuestions": 0,
    "estimatedCostUsd": 10.8,
    "estimatedDurationMins": 332
  }
}
```

#### Step 4.2: Submit Real Job (Small Dataset)
```bash
curl -X POST https://your-domain/api/admin/hydrateAll \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "language": "en",
    "boardCode": "CBSE",
    "grade": "1",
    "subjectCode": "MATH"
  }'
```

Expected Response (202 Accepted):
```json
{
  "rootJobId": "clx123abc456",
  "status": "pending",
  "estimates": { ... },
  "traceId": "hydrate-abc123xyz",
  "createdAt": "2026-01-31T10:00:00Z"
}
```

#### Step 4.3: Monitor Job Progress
```bash
# Get job status
curl https://your-domain/api/admin/hydrateAll/clx123abc456 \
  -H "Authorization: Bearer <admin_token>"
```

Expected Response:
```json
{
  "jobId": "clx123abc456",
  "status": "running",
  "progress": {
    "overall": 35,
    "levels": {
      "chapters": { "completed": 8, "expected": 12 },
      "topics": { "completed": 30, "expected": 60 },
      ...
    }
  }
}
```

#### Step 4.4: Check Metrics
```bash
# Prometheus metrics endpoint
curl http://your-metrics-server:9090/metrics | grep hydrate
```

Expected Metrics:
```
hydrate_jobs_created_total{target="subject"} 1
hydrate_jobs_claimed_total{target="subject"} 1
hydrate_jobs_completed_total{target="subject"} 0
hydrate_job_duration_seconds_sum 0
```

---

### Phase 5: Monitoring Setup

#### Step 5.1: Grafana Dashboard

Create dashboard with panels:
1. **Job Status Overview**
   - Query: `sum(hydrate_jobs_created_total) - sum(hydrate_jobs_completed_total)`
   - Panel Type: Stat
   - Alert: > 100 jobs pending for > 30 minutes

2. **Success Rate**
   - Query: `rate(hydrate_jobs_completed_total[5m]) / rate(hydrate_jobs_created_total[5m])`
   - Panel Type: Graph
   - Alert: < 90% success rate

3. **Cost Tracking**
   - Query: Sum of `actualCostUsd` from HydrationJob table
   - Panel Type: Graph

4. **Duration Distribution**
   - Query: `hydrate_job_duration_seconds`
   - Panel Type: Heatmap

#### Step 5.2: Alert Rules

```yaml
# alerts/hydrateAll.yml
groups:
  - name: hydrateAll
    rules:
      - alert: HydrateJobsBacklog
        expr: sum(hydrate_jobs_created_total) - sum(hydrate_jobs_completed_total) > 100
        for: 30m
        annotations:
          summary: "Large HydrateAll job backlog"
          description: "{{ $value }} jobs pending for > 30 minutes"

      - alert: HydrateJobFailures
        expr: rate(hydrate_jobs_failed_total[5m]) > 0.05
        for: 10m
        annotations:
          summary: "High HydrateAll job failure rate"
          description: "Failure rate: {{ $value | humanizePercentage }}"

      - alert: ReconcilerNotRunning
        expr: time() - max(hydrate_reconciler_last_run_timestamp) > 600
        for: 5m
        annotations:
          summary: "Reconciler has not run in 10 minutes"
```

---

### Phase 6: Documentation & Training

#### Step 6.1: Update Internal Wiki
- [ ] Add link to [HYDRATEALL_IMPLEMENTATION_GUIDE.md](./HYDRATEALL_IMPLEMENTATION_GUIDE.md)
- [ ] Document API endpoints with examples
- [ ] Add troubleshooting guide

#### Step 6.2: Admin Training
- [ ] Schedule training session for admin team
- [ ] Demo: Submit HydrateAll job via UI
- [ ] Demo: Monitor progress dashboard
- [ ] Demo: Cancel running job
- [ ] Demo: Interpret error logs

#### Step 6.3: Runbook for Operations
Create runbook covering:
1. How to manually trigger reconciler
2. How to cancel stuck jobs
3. How to requeue failed jobs
4. How to investigate cost overruns
5. How to handle validation failures

---

## 🔍 POST-DEPLOYMENT VERIFICATION

### Week 1 Checklist

- [ ] **Day 1**: Monitor first production job completion
- [ ] **Day 2**: Verify cost tracking accuracy
- [ ] **Day 3**: Check reconciler performance (query execution time)
- [ ] **Day 5**: Review validation failure patterns
- [ ] **Day 7**: Analyze week 1 metrics and adjust estimates

### Metrics to Track

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Average job completion time | < 120 minutes | TBD | ⏳ |
| Job success rate | > 95% | TBD | ⏳ |
| Cost estimation accuracy | ±10% | TBD | ⏳ |
| Reconciler execution time | < 30 seconds | TBD | ⏳ |
| Worker claim success rate | > 99% | TBD | ⏳ |

---

## 🐛 TROUBLESHOOTING

### Issue: Jobs Stuck in Pending

**Diagnosis**:
```sql
SELECT id, status, attempts, lockedAt, updatedAt
FROM "HydrationJob"
WHERE status = 'pending'
  AND updatedAt < NOW() - INTERVAL '1 hour'
ORDER BY updatedAt ASC;
```

**Resolution**:
1. Check Outbox Dispatcher is running
2. Check BullMQ queue health
3. Manually trigger reconciler

### Issue: Reconciler Not Creating Child Jobs

**Diagnosis**:
```bash
# Check reconciler logs
kubectl logs -l app=reconciler --tail=100

# Check JobLock
SELECT * FROM "JobLock" WHERE "jobName" = 'hydration_reconciler';
```

**Resolution**:
1. Verify Level 1 jobs are completed
2. Check for database connection issues
3. Manually run reconciler with debug logging

### Issue: High Cost Variance

**Diagnosis**:
```sql
SELECT
  id,
  estimatedCostUsd,
  actualCostUsd,
  (actualCostUsd - estimatedCostUsd) / estimatedCostUsd * 100 AS variance_pct
FROM "HydrationJob"
WHERE actualCostUsd IS NOT NULL
ORDER BY ABS(actualCostUsd - estimatedCostUsd) DESC
LIMIT 10;
```

**Resolution**:
1. Review AIContentLog for token usage
2. Adjust cost constants in API
3. Investigate prompt optimization

---

## 📞 SUPPORT

**Deployment Lead**: [Your Name]
**Slack Channel**: #ai-tutor-deployments
**Runbook**: [Link to Confluence/Wiki]
**Incident Response**: [On-call rotation]

---

## ✅ SIGN-OFF

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Tech Lead | | | |
| DevOps Lead | | | |
| QA Lead | | | |
| Product Owner | | | |

---

**Deployment Status**: ⏳ Ready for Deployment
**Next Review**: 7 days post-deployment
