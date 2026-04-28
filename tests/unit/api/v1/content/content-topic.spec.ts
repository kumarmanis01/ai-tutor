/**
 * Unit tests for GET /api/v1/content/[topicId] (S2.2 lesson content endpoint).
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
const mockGeneratedFind = prisma.generatedStudyContent.findFirst as jest.Mock;

const BASE_URL = 'https://example.com/api/v1/content/topic-1';

function makeParams(topicId = 'topic-1') {
  return { params: Promise.resolve({ topicId }) };
}

const TOPIC_STUB = {
  id: 'topic-1',
  name: 'Introduction to Fractions',
  chapter: {
    id: 'ch-1',
    name: 'Fractions',
    subject: { id: 'sub-1', name: 'Mathematics' },
  },
  notes: [
    {
      id: 'note-1',
      title: 'Introduction to Fractions',
      language: 'en',
      status: 'approved',
      contentJson: {
        content: {
          introduction: 'A fraction represents part of a whole.',
          learningObjectives: ['Understand numerator and denominator', 'Add simple fractions'],
          sections: [
            {
              heading: 'What is a Fraction?',
              explanation: 'A fraction has two parts: numerator and denominator.',
              imageUrl: null,
              imageAlt: null,
            },
          ],
          keyTerms: [
            { term: 'Numerator', definition: 'The top number of a fraction.' },
          ],
          summary: 'Fractions are parts of a whole.',
          commonMistakes: [
            { correction: 'The denominator can never be zero.' },
          ],
          videoUrl: null,
        },
      },
    },
  ],
};

beforeEach(() => {
  jest.resetAllMocks();
  mockSession.mockResolvedValue({ user: { id: 'student-1' } });
  mockGeneratedFind.mockResolvedValue(null);
});

describe('GET /api/v1/content/[topicId]', () => {
  it('should return 401 when no session', async () => {
    mockSession.mockResolvedValueOnce(null);
    const res = await GET(new Request(BASE_URL), makeParams());
    expect(res.status).toBe(401);
  });

  it('should return 404 when topic not found', async () => {
    mockTopicFind.mockResolvedValueOnce(null);
    const res = await GET(new Request(BASE_URL), makeParams());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Topic not found');
  });

  it('should return lesson payload for an approved English note', async () => {
    mockTopicFind.mockResolvedValueOnce(TOPIC_STUB);
    const res = await GET(new Request(BASE_URL), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.topicId).toBe('topic-1');
    expect(body.locale).toBe('en');
    expect(body.title).toBe('Introduction to Fractions');
    expect(body.chapterName).toBe('Fractions');
    expect(body.subjectName).toBe('Mathematics');
    expect(Array.isArray(body.keyPoints)).toBe(true);
    expect(Array.isArray(body.sections)).toBe(true);
    expect(body.sections.length).toBeGreaterThan(0);
    expect(typeof body.studyBuddyHint).toBe('string');
    expect(body.studyBuddyHint.length).toBeGreaterThan(0);
  });

  it('should include hint from commonMistakes in studyBuddyHint', async () => {
    mockTopicFind.mockResolvedValueOnce(TOPIC_STUB);
    const res = await GET(new Request(BASE_URL), makeParams());
    const body = await res.json();
    expect(body.studyBuddyHint).toBe('The denominator can never be zero.');
  });

  it('should return hi locale content when locale=hi and hi note exists', async () => {
    const hiStub = {
      ...TOPIC_STUB,
      notes: [
        { ...TOPIC_STUB.notes[0], language: 'hi', title: null },
      ],
    };
    mockTopicFind.mockResolvedValueOnce(hiStub);
    const hiUrl = `${BASE_URL}?locale=hi`;
    const res = await GET(new Request(hiUrl), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.locale).toBe('hi');
  });

  it('should fall back to generatedStudyContent when no note exists', async () => {
    const noNoteTopic = { ...TOPIC_STUB, notes: [] };
    mockTopicFind.mockResolvedValueOnce(noNoteTopic);
    mockGeneratedFind.mockResolvedValue({
      id: 'gen-1',
      language: 'en',
      contentJson: {
        title: 'Fractions (generated)',
        content: {
          introduction: 'Generated intro.',
          sections: [{ heading: 'Section 1', explanation: 'Body text.' }],
          learningObjectives: [],
          keyTerms: [],
          commonMistakes: [],
          videoUrl: null,
        },
      },
    });
    const res = await GET(new Request(BASE_URL), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.sections)).toBe(true);
  });

  it('should return availableLocales from topic notes', async () => {
    mockTopicFind.mockResolvedValueOnce(TOPIC_STUB);
    const res = await GET(new Request(BASE_URL), makeParams());
    const body = await res.json();
    expect(body.availableLocales).toContain('en');
  });

  it('should set Cache-Control header', async () => {
    mockTopicFind.mockResolvedValueOnce(TOPIC_STUB);
    const res = await GET(new Request(BASE_URL), makeParams());
    expect(res.headers.get('Cache-Control')).toMatch(/max-age/);
  });
});
