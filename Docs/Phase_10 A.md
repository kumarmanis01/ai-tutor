🧱 PART A — HELM / K8s PLAN FOR LEARNER SERVICES
🎯 Objective

Deploy learner-facing services in Kubernetes with:

Read-only content delivery

Scalable progress tracking

Monetization safety

Observability hooks for Phase 10

🧩 Services to Deploy
Service	Responsibility
learner-api	Phase 9 APIs (learn, progress, store)
admin-api	Existing admin APIs (already deployed)
evaluator	Alerting worker (Phase 5)
postgres	External (Neon/RDS)
redis	External (Upstash / Elasticache)
pushgateway	Metrics bridge (Phase 10)
📦 Helm Chart Structure
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

🔐 Secrets Strategy (Critical)

NO secrets in values files

Use:

kubectl create secret generic ai-platform-secrets \
  --from-env-file=.env.production


Helm values reference:

secrets:
  secretName: ai-platform-secrets

🚀 learner-api Deployment (Key Design)

Deployment characteristics

Stateless

Horizontal scaling

Read-only content APIs

Write-only progress APIs

replicas: 2

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

📈 Autoscaling (HPA)
minReplicas: 2
maxReplicas: 10
metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70

🔍 Observability Hooks (Phase 10 Ready)

Expose:

/metrics endpoint (Prometheus)

Push metrics to Pushgateway:

lesson_views_total

lesson_completed_total

course_enrollments_total

purchase_completed_total

🧠 Deployment Flow (Recommended)

Build image (GitHub Actions)

Push to GHCR

Helm upgrade:

helm upgrade --install ai-platform ./helm/ai-platform \
  -f values-staging.yaml \
  --set image.tag=$GIT_SHA