/* eslint-disable @typescript-eslint/no-require-imports */
// The Kubernetes client is optional in many deployments. Lazily require it
// so builds on environments without the module installed do not fail.
import path from 'path'

let k8s: any = null
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  k8s = require('@kubernetes/client-node')
} catch {
  k8s = null
}

const kc = k8s ? new k8s.KubeConfig() : null
if (kc) {
  try { kc.loadFromDefault() } catch { /* best-effort; will throw when used if not configured */ }
}
const batchApi = kc ? kc.makeApiClient(k8s.BatchV1Api) : null

export async function createJobForWorker(lifecycleId: string, type = 'content-hydration') {
  const image = process.env.WORKER_CONTAINER_IMAGE
  if (!image) throw new Error('WORKER_CONTAINER_IMAGE not set')

  const jobName = `worker-${lifecycleId.replace(/[^a-z0-9\-]/gi, '').toLowerCase()}`
  const job: any = {
    metadata: { name: jobName },
    spec: {
      template: {
        metadata: { labels: { app: 'ai-orchestrator-worker', lifecycleId } },
        spec: {
          containers: [
            {
              name: 'worker',
              image,
              args: (process.env.NODE_ENV !== 'production')
                ? ['-r', ['ts','-','node','/register'].join(''), path.posix.join('worker', 'bootstrap.ts'), '--type', type]
                : [path.posix.join('dist', 'worker', 'bootstrap.js'), '--type', type],
            },
          ],
          restartPolicy: 'Never',
        },
      },
      backoffLimit: 3,
    },
  }

  const namespace = process.env.WORKER_K8S_NAMESPACE || 'default'
  if (!batchApi) throw new Error('kubernetes client not available')
  return (batchApi as any).createNamespacedJob(namespace, job as any)
}
