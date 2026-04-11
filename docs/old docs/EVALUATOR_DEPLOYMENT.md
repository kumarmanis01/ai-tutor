# Evaluator Deployment Patterns

This document contains recommended deployment snippets for running the alert evaluator and metrics exporter in production.

1) Systemd unit (single-node)

Create `/etc/systemd/system/alert-evaluator.service`:

```ini
[Unit]
Description=Alert Evaluator
After=network.target

[Service]
Type=simple
User=yourapp
WorkingDirectory=/opt/ai-tutor
Environment=NODE_ENV=production
Environment=DATABASE_URL=postgres://user:pass@host:5432/db
Environment=REDIS_URL=redis://redis:6379
Environment=OPS_EMAIL=ops@example.com
Environment=SLACK_WEBHOOK=https://hooks.slack.com/services/XXX/YYY/ZZZ
ExecStart=/usr/bin/node -r ts-node/register/transpile-only scripts/runAlertEvaluator.ts
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Start and enable:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now alert-evaluator
```

2) Procfile (Heroku / container runners)

```
evaluator: node -r ts-node/register/transpile-only scripts/runAlertEvaluator.ts
metrics: node -r ts-node/register/transpile-only scripts/metricsServer.ts
```

3) Kubernetes / Helm (minimal Deployment + Service)

values.yaml:

```yaml
replicaCount: 1
image:
  repository: your-registry/ai-tutor
  tag: v1.0.0
env:
  - name: DATABASE_URL
    value: "postgres://user:pass@postgres:5432/db"
  - name: REDIS_URL
    valueFrom:
      secretKeyRef:
        name: redis-secret
        key: REDIS_URL
  - name: OPS_EMAIL
    valueFrom:
      secretKeyRef:
        name: evaluator-secrets
        key: OPS_EMAIL
  - name: SLACK_WEBHOOK
    valueFrom:
      secretKeyRef:
        name: evaluator-secrets
        key: SLACK_WEBHOOK
```

Deployment (snippet):

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: alert-evaluator
spec:
  replicas: 1
  selector:
    matchLabels:
      app: alert-evaluator
  template:
    metadata:
      labels:
        app: alert-evaluator
    spec:
      containers:
        - name: evaluator
          image: your-registry/ai-tutor:v1.0.0
          command: ["node","-r","ts-node/register/transpile-only","scripts/runAlertEvaluator.ts"]
          envFrom:
            - secretRef:
                name: evaluator-secrets
        - name: metrics
          image: your-registry/ai-tutor:v1.0.0
          command: ["node","-r","ts-node/register/transpile-only","scripts/metricsServer.ts"]
          ports:
            - containerPort: 9187
```

4) Pushgateway (optional)

- If you prefer pushing metrics instead of running a /metrics server, set `PUSHGATEWAY_URL` and the evaluator will try to push metrics at shutdown (or periodically). Example Pushgateway URL: `http://pushgateway.monitoring.svc:9091`.

5) Operational checklist
- Set repo secret `ALLOW_EVALUATOR_DRY_RUN=1` to enable the CI dry-run test.
- Provision `REDIS_URL`, set `OPS_EMAIL`, `SLACK_WEBHOOK`, and `PAGER_WEBHOOK` secrets to enable real notifications.
- Configure monitoring to scrape the `/metrics` endpoint or configure Pushgateway and set `PUSHGATEWAY_URL`.
