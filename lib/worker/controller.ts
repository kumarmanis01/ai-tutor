import { prisma } from '../prisma'

export async function createWorkerLifecycle(data: { id: string; type: string; host?: string; pid?: number; meta?: any }) {
  return prisma.workerLifecycle.create({
    data: {
      id: data.id,
      type: data.type,
      host: data.host,
      pid: data.pid,
      meta: data.meta,
      status: 'STARTING',
      startedAt: new Date(),
      lastHeartbeatAt: new Date(),
    },
  })
}

export async function updateHeartbeat(id: string) {
  return prisma.workerLifecycle.update({ where: { id }, data: { lastHeartbeatAt: new Date(), status: 'RUNNING' } })
}

export async function markDraining(id: string) {
  return prisma.workerLifecycle.update({ where: { id }, data: { status: 'DRAINING' } })
}

export async function markStopped(id: string) {
  return prisma.workerLifecycle.update({ where: { id }, data: { status: 'STOPPED', stoppedAt: new Date() } })
}

export async function markFailed(id: string, meta?: any) {
  return prisma.workerLifecycle.update({ where: { id }, data: { status: 'FAILED', stoppedAt: new Date(), meta } })
}
