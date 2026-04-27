import runHydrateAll from './hydrateAll'

;(async () => {
  try {
    await runHydrateAll()
    process.exit(0)
  } catch (err) {
    console.error('hydrateAllRunner failed', err)
    process.exit(1)
  }
})()
