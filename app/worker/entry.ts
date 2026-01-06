(async () => {
  try {
    // Only load dotenv in local/dev
    if (process.env.NODE_ENV !== 'production') {
      await import('dotenv/config')
    }

    const { bootstrapWorker } = await import('./bootstrap')
    await bootstrapWorker()
  } catch (err) {
    try {
      const { logger } = await import('@/lib/logger')
      logger.error('[worker] fatal startup error', { error: err?.message ?? String(err) })
    } catch {
      // Fall back to stderr if logger import fails during startup
      // eslint-disable-next-line no-console
      console.error('[worker] fatal startup error', err)
    }
    process.exit(1) // PM2 will restart
  }
})()

