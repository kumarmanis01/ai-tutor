export async function GET() {
  try {
    const prom = await import('prom-client')
    const client: any = (prom && (prom as any).default) || prom
    const register = client.register || client
    const metrics = await register.metrics()
    const contentType = (register as any).contentType || 'text/plain; version=0.0.4'
    return new Response(metrics, { status: 200, headers: { 'Content-Type': contentType } })
  } catch (err) {
    try {
      const logger = (await import('@/lib/logger')).logger
      logger?.warn?.('metrics.endpoint: prom-client not available or failed', { err: String(err) })
    } catch {}
    return new Response('', { status: 204 })
  }
}
