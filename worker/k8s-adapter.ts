import * as k8s from '@kubernetes/client-node'
import path from 'path'

const kc = new k8s.KubeConfig()
try { kc.loadFromDefault() } catch { /* best-effort; will throw when used if not configured */ }
const batchApi = kc.makeApiClient(k8s.BatchV1Api)

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
              args: ['-r', 'ts-node/register', path.posix.join('worker', 'bootstrap.ts'), '--type', type],
            },
          ],
          restartPolicy: 'Never',
        },
      },
      backoffLimit: 3,
    },
  }

  const namespace = process.env.WORKER_K8S_NAMESPACE || 'default'
  return batchApi.createNamespacedJob(namespace, job as any)
}
