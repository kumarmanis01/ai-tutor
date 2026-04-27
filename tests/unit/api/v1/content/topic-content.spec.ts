/**
 * Unit tests for GET /api/v1/content/[topicId] (S2.2).
 */

jest.mock('@/lib/session', () => ({ getServerSessionForHandlers: jest.fn() }));
jest.mock('@/lib/logger', () => ({
  logger: { logAPI: jest.fn(), error: jest.fn() },
}));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    topicDef: { findUnique: jest.fn() },
    generatedStudyContent: { findFirst: jest.fn() },
  },
}));

import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { GET } from '@/app/api/v1/content/[topicId]/route';

const mockSession = getServerSessionForHandlers as jest.Mock;
const mockTopicFind = prisma.topicDef.findUnique as jest.Mock;
const mockFallbackFind = prisma.generatedStudyContent.findFirst as jest.Mock;

function makeParams(topicId = 'topic-1') {
  return { params: Promise.resolve({ topicId }) };
}

beforeEach(() => {
  jest.resetAllMocks();
  mockSession.mockResolvedValue({ user: { id: 'u1' } });
  mockFallbackFind.mockResolvedValue(null);
});

describe('GET /api/v1/content/[topicId]', () => {
  it('should return 401 when no session', async () => {
    mockSession.mockResolvedValueOnce(null);
    const res = await GET(new Request('https://example.com/api/v1/content/t1'), makeParams('t1'));
    expect(res.status).toBe(401);
  });

  it('should return 404 when topic not found', async () => {
    mockTopicFind.mockResolvedValueOnce(null);
    const res = await GET(new Request('https://example.com/api/v1/content/t1'), makeParams('t1'));
    expect(res.status).toBe(404);
  });

  it('should return lesson payload for topic with notes', async () => {
    const contentJson = {
      title: 'Fractions',
      content: {
        introduction: 'Fractions represent parts of a whole.',
        learningObjectives: ['Understand numerator and denominator'],
        sections: [{ heading: 'What is a Fraction?', explanation: 'A fraction has two parts.', imageUrl: null, imageAlt: null }],
        keyTerms: [{ term: 'Numerator', definition: 'Top number in a fraction.' }],
        commonMistakes: [{ correction: 'Do not confuse numerator and denominator.' }],
        videoUrl: null,
        summary: 'Fractions are core math concepts.',
      },
    };

    mockTopicFind.mockResolvedValueOnce({
      id: 't1',
      name: 'Fractions',
      chapter: { id: 'ch1', name: 'Numbers', subject: { id: 'sub1', name: 'Maths' } },
      notes: [{ id: 'n1', title: 'Fractions', contentJson, status: 'approved', language: 'en' }],
    });

    const res = await GET(new Request('https://example.com/api/v1/content/t1'), makeParams('t1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.topicId).toBe('t1');
    expect(body.title).toBe('Fractions');
    expect(body.keyPoints.length).toBeGreaterThan(0);
    expect(Array.isArray(body.sections)).toBe(true);
    expect(body.studyBuddyHint).toBeTruthy();
  });

  it('should fall back to generatedStudyContent when no TopicNote exists', async () => {
    mockTopicFind.mockResolvedValueOnce({
      id: 't1',
      name: 'Algebra',
      chapter: { id: 'ch1', name: 'Algebra', subject: { id: 'sub1', name: 'Maths' } },
      notes: [],
    });
    mockFallbackFind.mockResolvedValueOnce({
      id: 'gsc1',
      contentJson: {
        title: 'Algebra Basics',
        introduction: 'Algebra uses symbols.',
        sections: [{ heading: 'Variables', explanation: 'Letters stand for numbers.', imageUrl: null, imageAlt: null }],
      },
      language: 'en',
    });

    const res = await GET(new Request('https://example.com/api/v1/content/t1'), makeParams('t1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.topicId).toBe('t1');
  });

  it('should select Hindi note when locale=hi', async () => {
    mockTopicFind.mockResolvedValueOnce({
      id: 't1',
      name: 'Fractions',
      chapter: { id: 'ch1', name: 'Numbers', subject: { id: 'sub1', name: 'Maths' } },
      notes: [
        { id: 'n1', title: 'Fractions EN', contentJson: { title: 'Fractions' }, status: 'approved', language: 'en' },
        { id: 'n2', title: 'Bhinn', contentJson: { title: 'Bhinn' }, status: 'approved', language: 'hi' },
      ],
    });

    const res = await GET(
      new Request('https://example.com/api/v1/content/t1?locale=hi'),
      makeParams('t1')
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.locale).toBe('hi');
    expect(body.availableLocales).toContain('hi');
  });
});
