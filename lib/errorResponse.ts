export function formatErrorForResponse(error: unknown) {
  if (error === undefined || error === null) {
    return { name: 'Error', message: 'Unknown error', stack: null };
  }

  const e: any = error as any
  const name = e?.name || 'Error'

  let message: string
  if (typeof e === 'string') {
    message = e
  } else if (e && typeof e === 'object' && 'message' in e && (e as any).message) {
    message = (e as any).message
  } else {
    message = String(e) || 'Unknown error'
  }

  const stack = e?.stack ?? null
  return { name, message, stack }
}
