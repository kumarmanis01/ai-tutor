export type JobSchedule =
  | { type: 'manual' }
  | { type: 'interval'; everySec: number }

export interface JobDefinition {
  name: string
  // The job's main entrypoint — must be async and side-effecting
  run: () => Promise<void>
  // A numeric key used to derive advisory lock ids
  lockKey: string
  // Maximum allowed runtime in milliseconds
  timeoutMs: number
  // Scheduling metadata (no execution is performed by this module)
  schedule: JobSchedule
}

/**
 * Central registry of JobDefinitions. Other modules should call
 * `registerJob()` to add their JobDefinition. This module does NOT run
 * jobs — it only stores metadata.
 */
const registry = new Map<string, JobDefinition>()

export function registerJob(job: JobDefinition) {
  if (!job || !job.name) throw new Error('invalid job definition')
  if (registry.has(job.name)) throw new Error(`job already registered: ${job.name}`)
  registry.set(job.name, job)
}

export function getJob(name: string): JobDefinition | undefined {
  return registry.get(name)
}

export function listJobs(): JobDefinition[] {
  return Array.from(registry.values())
}

export default registry
