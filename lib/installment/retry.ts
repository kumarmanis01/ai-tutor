/**
 * Helper to enqueue an installment retry job. This abstracts the queue
 * implementation and keeps API routes thin.
 */
import { getInstallmentDunningQueue } from '@/jobs/installmentDunning'

export async function enqueueInstallmentRetry(opts: { subscriptionId: string; installmentId: string }) {
  const queue = getInstallmentDunningQueue()
  // enqueue a targeted job with notes to process that installment immediately
  await queue.add('installment-dunning-target', { notes: { subscriptionId: opts.subscriptionId, installmentId: opts.installmentId, installmentNumber: opts.installmentId } }, { attempts: 1 })
}

const InstallmentRetry = { enqueueInstallmentRetry }
export default InstallmentRetry
