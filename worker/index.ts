/*
 * Worker index — explicit registry and safe re-exports.
 * - Does NOT start any background loops on import.
 * - Exports factories and handlers for the bootstrap entrypoint.
 */

export { startContentWorker } from './processors/contentWorker.js'
export { default as regenerationWorker, startWorker as startRegenerationWorker, processNextJob, claimJob } from './processors/regenerationWorker.js'
export { handleSyllabusJob } from './services/syllabusWorker.js'
export { runForAllCourses as runAnalyticsAggregator, default as aggregateDay } from './services/analyticsAggregator.js'
export { generateSignalsForAllCourses } from './services/generateSignals.js'
export { startWorkerLifecycleWatchdog } from './services/heartbeatWatchdog.js'
