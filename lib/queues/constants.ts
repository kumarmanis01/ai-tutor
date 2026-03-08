/**
 * Centralized queue names for BullMQ.
 *
 * COUPLING-02: Both outboxDispatcher and worker bootstrap MUST import from here.
 * No hardcoded queue names elsewhere — prevents mismatch between dispatcher
 * and worker.
 */

/** Content hydration queue — syllabus, notes, questions, tests. */
export const CONTENT_HYDRATION_QUEUE = 'content-hydration';
