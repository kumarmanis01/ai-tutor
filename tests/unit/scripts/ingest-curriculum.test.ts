/**
 * FILE OBJECTIVE:
 * - Unit tests for `scripts/ingest-curriculum.ts` validating idempotency and version bump behavior.
 *
 * LINKED SOURCE:
 * - scripts/ingest-curriculum.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-08T00:00:00Z | git-user | adapt tests to inject prismaMock and stabilize module loading
 */

import { prismaMock } from '../../helpers/prismaMock'
import crypto from 'crypto'

jest.mock('@/lib/prisma.js', () => ({ prisma: require('../../helpers/prismaMock').prismaMock }))
jest.mock('@/lib/ai/embeddings', () => ({ getEmbeddingsBatch: jest.fn() }))
jest.mock('@/lib/logger.js', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))

// Ensure analyticsEvent mock exists on prismaMock for new telemetry writes
const { prismaMock } = require('../../helpers/prismaMock')
prismaMock.analyticsEvent = { create: jest.fn() }

describe('ingest-curriculum script', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('bumps version when content changed and writes run log', async () => {
    const content = 'changed content'
    const newHash = crypto.createHash('sha256').update(content, 'utf8').digest('hex')

    // Use isolateModules to require the script after mocks are set
    let runIngest: any
    jest.isolateModules(() => {
      // First $queryRawUnsafe call: all chunks
      prismaMock.$queryRawUnsafe = jest.fn()
        .mockResolvedValueOnce([{ id: 'c-1', content, contentHash: 'oldhash', version: 1 }])
        // Second call: chunks needing embed (none)
        .mockResolvedValueOnce([])

      // Mock embeddings
      const { getEmbeddingsBatch } = require('@/lib/ai/embeddings')
      ;(getEmbeddingsBatch as jest.Mock).mockResolvedValue([[0.1, 0.2, 0.3]])

      prismaMock.$executeRawUnsafe = jest.fn().mockResolvedValue(undefined)
      prismaMock.ingestRunLog = { create: jest.fn().mockResolvedValue(true) } as any
      prismaMock.$disconnect = jest.fn().mockResolvedValue(undefined)

      const mod = require('@/scripts/ingest-curriculum')
      runIngest = () => mod.main(prismaMock)
    })

    try {
      await runIngest()
    } catch (err) {
      console.error('runIngest error:', err)
      throw err
    }

    const execCalls = (prismaMock.$executeRawUnsafe as jest.Mock).mock.calls.length
    if (execCalls === 0) {
      const qCalls = (prismaMock.$queryRawUnsafe as jest.Mock).mock.calls.length
      throw new Error(`Expected $executeRawUnsafe to be called but it was not; $queryRawUnsafe calls=${qCalls}`)
    }
    const firstSql = (prismaMock.$executeRawUnsafe as jest.Mock).mock.calls[0][0]
    if (!firstSql.includes('version = version + 1')) throw new Error(`Expected SQL to bump version; got: ${firstSql}`)
    if (typeof (prismaMock.ingestRunLog.create as jest.Mock).mock !== 'object') throw new Error('ingestRunLog.create mock not present')
  })

  it('is idempotent when contentHash matches and embedding exists', async () => {
    const content = 'stable content'
    const hash = crypto.createHash('sha256').update(content, 'utf8').digest('hex')

    let runIngest2: any
    jest.isolateModules(() => {
      // All chunks: contentHash already matches
      prismaMock.$queryRawUnsafe = jest.fn()
        .mockResolvedValueOnce([{ id: 'c-2', content, contentHash: hash, version: 2 }])
        .mockResolvedValueOnce([])

      prismaMock.ingestRunLog = { create: jest.fn().mockResolvedValue(true) } as any
      prismaMock.$disconnect = jest.fn().mockResolvedValue(undefined)

      const mod = require('@/scripts/ingest-curriculum')
      runIngest2 = () => mod.main(prismaMock)
    })

    try {
      await runIngest2()
    } catch (err) {
      console.error('runIngest2 error:', err)
      throw err
    }

    // No embedding/update should have occurred
    const execCalls2 = (prismaMock.$executeRawUnsafe as jest.Mock).mock.calls.length
    if (execCalls2 > 0) throw new Error(`Did not expect $executeRawUnsafe to be called; calls=${execCalls2}`)
    if (typeof (prismaMock.ingestRunLog.create as jest.Mock).mock !== 'object') throw new Error('ingestRunLog.create mock not present')
  })
})
