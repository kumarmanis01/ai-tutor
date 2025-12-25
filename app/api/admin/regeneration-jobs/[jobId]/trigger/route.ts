// Compatibility shim: tests expect a `[jobId]` route folder name.
// Re-export the real implementation from the existing `[id]` route.
export { POST, GET, PUT, PATCH, DELETE } from '../../[id]/trigger/route';
