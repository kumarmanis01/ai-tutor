**Evaluator Deployment Snippets**

- **Systemd unit**

```
[Unit]
Description=Alert Evaluator
After=network.target

[Service]
Type=simple
User=www-data
Environment=NODE_ENV=production
Environment=DATABASE_URL=postgres://user:pass@db:5432/ai_tutor
Environment=REDIS_URL=redis://redis:6379
WorkingDirectory=/srv/ai-tutor
ExecStart=/usr/bin/node /srv/ai-tutor/build/runAlertEvaluator.js
Restart=on-failure
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

- **Procfile** (Heroku / container orchestrator)

```
evaluator: node build/runAlertEvaluator.js
metrics: node build/metricsServer.js  # optional standalone metrics server
```

- **Helm (deployment) snippet**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: alert-evaluator
spec:
  replicas: 2
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
          image: your-registry/ai-tutor:latest
          command: ["node", "/app/build/runAlertEvaluator.js"]
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: db-secret
                  key: DATABASE_URL
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: redis-secret
                  key: REDIS_URL
          readinessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 30
          resources:
            limits:
              cpu: "500m"
              memory: "256Mi"
            requests:
              cpu: "100m"
              memory: "128Mi"
```

Notes:
- The `readinessProbe` shown expects the app to expose `/api/health` (see next section).
- Prefer mounting a small sidecar (Pushgateway) or using Prometheus scraping of the `/api/metrics` route.
