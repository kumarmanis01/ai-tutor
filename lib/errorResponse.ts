export function formatErrorForResponse(error: unknown) {
  const e: any = error || {};
  return {
    name: e.name || 'Error',
    message: e.message || String(e) || 'Unknown error',
    stack: e.stack || null,
  };
}
