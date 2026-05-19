/**
 * Centralized queue names for BullMQ.
 *
 * COUPLING-02: Both outboxDispatcher and worker bootstrap MUST import from here.
 * No hardcoded queue names elsewhere -- prevents mismatch between dispatcher
 * and worker.
 */

/** Content hydration queue -- syllabus, notes, questions, tests. */
export const CONTENT_HYDRATION_QUEUE = 'content-hydration';

/** AI request queue -- enqueues requests that must be executed in worker runtime */
export const AI_REQUEST_QUEUE = 'ai-requests';

/** Analytics ingest queue -- client-submitted events enqueued here, worker bulk-writes to DB. */
export const ANALYTICS_INGEST_QUEUE = 'analytics-ingest';

/** PDF ingest queue -- parses uploaded NCERT textbook PDFs and seeds BookChapter/BookTopic rows. */
export const PDF_INGEST_QUEUE = 'pdf-ingest';
