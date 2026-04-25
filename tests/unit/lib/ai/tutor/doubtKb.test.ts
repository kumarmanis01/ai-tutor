import { recordDoubt } from '@/lib/ai/tutor/doubtKb';
import { getEmbedding } from '@/lib/ai/embeddings';
import { logger } from '@/lib/logger';

/* eslint-disable @typescript-eslint/no-require-imports */

// Use the test helper prismaMock so tests never hit a real DB
jest.mock('@/lib/prisma.js', () => ({
  prisma: require('../../../../helpers/prismaMock').prismaMock,
}));
jest.mock('@/lib/ai/embeddings');
jest.mock('@/lib/logger');

const mockedPrisma = require('../../../../helpers/prismaMock').prismaMock;
const mockedGetEmbedding = getEmbedding as jest.MockedFunction<typeof getEmbedding>;

beforeEach(() => {
  jest.resetAllMocks();
});

test('recordDoubt updates existing near-duplicate when similarity >= threshold', async () => {
  mockedGetEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);

  // Simulate existing row found by vector query
  mockedPrisma.$queryRawUnsafe = jest
    .fn()
    .mockResolvedValue([{ id: 'existing-1', alternatePhrasings: [], similarity: 0.9 }]);

  mockedPrisma.$executeRawUnsafe = jest.fn().mockResolvedValue(undefined);

  await recordDoubt('What is photosynthesis?', 'Answer text', 'biology');

  expect(mockedPrisma.$queryRawUnsafe).toHaveBeenCalled();
  expect(mockedPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
    expect.stringContaining('UPDATE "DoubtKb"'),
    expect.any(Array),
    'existing-1'
  );
});

test('recordDoubt creates novel doubt when no near-duplicate found', async () => {
  mockedGetEmbedding.mockResolvedValue([0.4, 0.5, 0.6]);

  mockedPrisma.$queryRawUnsafe = jest.fn().mockResolvedValue([]);
  mockedPrisma.doubtKb = { create: jest.fn().mockResolvedValue({ id: 'new-1' }) } as any;
  mockedPrisma.$executeRawUnsafe = jest.fn().mockResolvedValue(undefined);

  await recordDoubt('Explain gravity', 'Gravity explanation', 'physics', 'concept-1');

  expect(mockedPrisma.doubtKb.create).toHaveBeenCalled();
  expect(mockedPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
    expect.stringContaining('UPDATE "DoubtKb" SET embedding'),
    expect.any(String),
    'Explain gravity',
    'physics'
  );
});
