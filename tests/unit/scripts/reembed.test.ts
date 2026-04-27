/**
 * Unit test for scripts/reembed.ts
 */
/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('@/lib/prisma', () => ({ prisma: require('../../helpers/prismaMock').prismaMock }))
jest.mock('@/lib/ai/embeddings', () => ({ getEmbeddingsBatch: jest.fn() }))

import { prismaMock } from '../../helpers/prismaMock'
import { getEmbeddingsBatch } from '@/lib/ai/embeddings'

const { main: reembedMain } = require('@/scripts/reembed')

describe('reembed script', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    // default mocks
    prismaMock.curriculumChunk = { findMany: jest.fn().mockResolvedValue([{ id: 'c-1', content: 'hello' }]) } as any
    prismaMock.$executeRawUnsafe = jest.fn().mockResolvedValue(undefined)
    prismaMock.ingestRunLog = { create: jest.fn().mockResolvedValue({ id: 'run-1' }) } as any
    prismaMock.analyticsEvent = { create: jest.fn().mockResolvedValue({ id: 'ae-1' }) } as any
  })

  it('re-embeds chunks and writes run log + analytics event', async () => {
    ;(getEmbeddingsBatch as jest.Mock).mockResolvedValue([[0.1, 0.2, 0.3]])

    const oldArgv = process.argv
    process.argv = ['node', 'reembed', '--chunk-ids', 'c-1']
    try {
      await reembedMain()
    } finally {
      process.argv = oldArgv
    }

    expect(prismaMock.$executeRawUnsafe).toHaveBeenCalled()
    expect(prismaMock.ingestRunLog.create).toHaveBeenCalled()
    expect(prismaMock.analyticsEvent.create).toHaveBeenCalled()
  })
})
