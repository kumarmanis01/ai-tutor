# 🧱 PART A — HELM / K8s PLAN FOR LEARNER SERVICES

## 🎯 Objective
Deploy learner-facing services in Kubernetes for:
- Read-only content delivery
- Scalable progress tracking (write-only progress APIs)
- Monetization safety
- Observability readiness for Phase 10

## 🧩 Services to Deploy

| Service     | Responsibility |
|-------------|----------------|
| learner-api | Phase 9 APIs (learn, progress, store) — stateless, horizontally scaled |
| admin-api   | Existing admin APIs (deployed separately) |
| evaluator   | Alerting/worker (Phase 5) |
| postgres    | External (Neon / RDS) |
| redis       | External (Upstash / ElastiCache) |
| pushgateway | Metrics bridge (Phase 10) |

## 📦 Helm Chart Structure
```
helm/
└── ai-platform/
  ├── Chart.yaml
  ├── values.yaml
  ├── values-staging.yaml
  ├── values-prod.yaml
  ├── templates/
  │   ├── learner-api.deployment.yaml
  │   ├── learner-api.service.yaml
  │   ├── learner-api.hpa.yaml
  │   ├── evaluator.deployment.yaml
  │   ├── secrets.yaml
  │   ├── configmap.yaml
  │   └── serviceaccount.yaml
```

## 🔐 Secrets Strategy (Critical)
- NO secrets in values files.
- Create secrets from an env file and reference by name in values.

Create secret:
```bash
kubectl create secret generic ai-platform-secrets \
  --from-env-file=.env.production
```

Helm values reference:
```yaml
secrets:
  secretName: ai-platform-secrets
```

## 🚀 learner-api Deployment (Key Design)
- Stateless, horizontally scalable
- Read-only content APIs; write-only progress APIs
- Default replicas: 2 (HPA min 2 / max 10)
- Env from secrets: DATABASE_URL, REDIS_URL, NODE_ENV, TENANT_MODE=enabled

Resource defaults (values.yaml):
```yaml
replicaCount: 2
resources:
  requests:
  cpu: 100m
  memory: 256Mi
  limits:
  cpu: 500m
  memory: 512Mi
env:
  - DATABASE_URL
  - REDIS_URL
  - NODE_ENV
  - TENANT_MODE=enabled
```

## 📈 Autoscaling (HPA)
```yaml
hpa:
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
    name: cpu
    target:
      type: Utilization
      averageUtilization: 70
```

## 🔍 Observability Hooks (Phase 10 Ready)
- Expose `/metrics` endpoint (Prometheus)
- Push to Pushgateway when scraping is not feasible
Suggested metrics:
- lesson_views_total
- lesson_completed_total
- course_enrollments_total
- purchase_completed_total

## 🧠 Deployment Flow (Recommended)
1. Build image (GitHub Actions)
2. Push to GHCR
3. Helm upgrade/install:
```bash
helm upgrade --install ai-platform ./helm/ai-platform \
  -f values-staging.yaml \
  --set image.tag=$GIT_SHA
```

## ✅ Quick validation
- `helm lint ./helm/ai-platform`
- `helm template ./helm/ai-platform -f values-staging.yaml`

## ⚠️ Risks & Recommendations
- Ensure managed Postgres & Redis provisioned before install
- NO secrets committed; secure .env.production
- Prefer Prometheus pull (scrape) where possible; use Pushgateway only when necessary
- Add readiness/liveness probes to learner-api
- Include RBAC / NetworkPolicy templates for production
- Tune resource requests/limits to real load
- CI: run helm lint/template on PRs touching helm/**

---

##  — SUMMARY OF CHANGES (Phase 10A)
- Objective: Deploy learner-facing services in K8s for safe, observable delivery
- Services: learner-api (stateless), admin-api (separate), evaluator, external postgres/redis, pushgateway
- Helm: created `ai-platform` chart with values and templates (deployment, service, HPA, evaluator, serviceaccount, configmap, secrets)
- Secrets: use k8s secret from env file; chart reads by secret name
- Autoscaling: CPU-based HPA (70% target), min 2 / max 10
- Observability: `/metrics` + Pushgateway metrics list
- CI: added helm lint/template validation on PRs

