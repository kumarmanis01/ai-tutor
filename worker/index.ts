/*
 * Worker index — explicit registry and safe re-exports.
 * - Does NOT start any background loops on import.
 * - Exports factories and handlers for the bootstrap entrypoint.
 */

export { startContentWorker } from './processors/contentWorker'
export { default as regenerationWorker, startWorker as startRegenerationWorker, processNextJob, claimJob } from './processors/regenerationWorker'
export { handleSyllabusJob } from './services/syllabusWorker'
export { runForAllCourses as runAnalyticsAggregator, default as aggregateDay } from './services/analyticsAggregator'
export { generateSignalsForAllCourses } from './services/generateSignals'
export { startWorkerLifecycleWatchdog } from './services/heartbeatWatchdog'
