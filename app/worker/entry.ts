(async () => {
  try {
    // Only load dotenv in local/dev
    if (process.env.NODE_ENV !== 'production') {
      await import('dotenv/config')
    }

    const { bootstrapWorker } = await import('./bootstrap')
    await bootstrapWorker()
  } catch (err) {
    console.error('[worker] fatal startup error', err)
    process.exit(1) // PM2 will restart
  }
})()

