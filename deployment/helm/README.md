This folder contains a tiny snippet to deploy the Alert Evaluator as a Kubernetes Deployment + Service with readiness/liveness probes and a Service to expose metrics.

Values to set:
- image.repository
- image.tag
- replicas
- env.PUSHGATEWAY_URL (optional)
- env.DATABASE_URL (recommended to reference a k8s Secret)

Use `kubectl apply -f` for the YAML snippet below or adapt into your chart.
