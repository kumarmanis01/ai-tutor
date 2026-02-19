#!/usr/bin/env tsx
import runHydrateAll from './hydrateAll'

async function run() {
  // Trigger a full hydration run for development
  // Optionally pass { fromTopic: '<topicId>' } to limit scope
  await runHydrateAll()
  console.log('Submitted')
}

run().catch((err) => {
  console.error('dev-hydrate failed:', err)
  process.exit(1)
})
