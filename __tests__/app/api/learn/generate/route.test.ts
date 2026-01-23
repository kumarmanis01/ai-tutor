/**
 * FILE OBJECTIVE:
 * - Unit tests for on-demand study material generation API.
 * - Tests rate limiting, caching, content generation, and error handling.
 *
 * LINKED UNIT TEST:
 * - (self)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-01-23T10:35:00Z | copilot | Created unit tests for generate API
 */

// Mock dependencies before importing the route
jest.mock('@/lib/prisma', () => ({
  prisma: {
    generatedStudyContent: {
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    subscription: {
      findFirst: jest.fn(),
    },
    studentStudyBookmark: {
      create: jest.fn(),
    },
  },
}));

jest.mock('@/lib/session', () => ({
  getServerSessionForHandlers: jest.fn(),
}));

jest.mock('@/lib/callLLM', () => ({
  callLLM: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import { POST, GET } from '@/app/api/learn/generate/route';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { callLLM } from '@/lib/callLLM';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockGetSession = getServerSessionForHandlers as jest.Mock;
const mockCallLLM = callLLM as jest.Mock;

describe('POST /api/learn/generate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockGetSession.mockResolvedValue(null);

      const req = new Request('http://localhost/api/learn/generate', {
        method: 'POST',
        body: JSON.stringify({ topic: 'Photosynthesis' }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('sign in');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits for free users', async () => {
      mockGetSession.mockResolvedValue({
        user: { id: 'user-1', role: 'student' },
      });
      
      (mockPrisma.subscription.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.generatedStudyContent.count as jest.Mock).mockResolvedValue(3); // At limit

      const req = new Request('http://localhost/api/learn/generate', {
        method: 'POST',
        body: JSON.stringify({ topic: 'Photosynthesis' }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toContain('Daily limit');
    });

    it('should allow premium users higher limits', async () => {
      mockGetSession.mockResolvedValue({
        user: { id: 'user-1', role: 'student' },
      });
      
      (mockPrisma.subscription.findFirst as jest.Mock).mockResolvedValue({
        id: 'sub-1',
        status: 'active',
        endDate: new Date(Date.now() + 86400000),
      });
      (mockPrisma.generatedStudyContent.count as jest.Mock).mockResolvedValue(5); // Under premium limit
      (mockPrisma.generatedStudyContent.findUnique as jest.Mock).mockResolvedValue(null);
      
      mockCallLLM.mockResolvedValue({
        content: JSON.stringify({
          title: 'Understanding Photosynthesis',
          content: { introduction: 'Test content' },
        }),
      });

      (mockPrisma.generatedStudyContent.create as jest.Mock).mockResolvedValue({
        id: 'content-1',
        contentHash: 'hash123',
        topic: 'Photosynthesis',
        contentJson: { title: 'Test', content: {} },
        createdAt: new Date(),
      });

      const req = new Request('http://localhost/api/learn/generate', {
        method: 'POST',
        body: JSON.stringify({ topic: 'Photosynthesis' }),
      });

      const response = await POST(req);

      expect(response.status).toBe(200);
    });
  });

  describe('Input Validation', () => {
    beforeEach(() => {
      mockGetSession.mockResolvedValue({
        user: { id: 'user-1', role: 'student' },
      });
      (mockPrisma.subscription.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.generatedStudyContent.count as jest.Mock).mockResolvedValue(0);
    });

    it('should reject invalid JSON', async () => {
      const req = new Request('http://localhost/api/learn/generate', {
        method: 'POST',
        body: 'not json',
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid JSON');
    });

    it('should reject topics less than 3 characters', async () => {
      const req = new Request('http://localhost/api/learn/generate', {
        method: 'POST',
        body: JSON.stringify({ topic: 'ab' }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('at least 3 characters');
    });

    it('should reject blocked terms', async () => {
      const req = new Request('http://localhost/api/learn/generate', {
        method: 'POST',
        body: JSON.stringify({ topic: 'Give me exam answers for tomorrow' }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('cannot be generated');
    });
  });

  describe('Content Caching', () => {
    beforeEach(() => {
      mockGetSession.mockResolvedValue({
        user: { id: 'user-1', role: 'student' },
      });
      (mockPrisma.subscription.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.generatedStudyContent.count as jest.Mock).mockResolvedValue(0);
    });

    it('should return cached content if exists', async () => {
      const cachedContent = {
        id: 'content-1',
        contentHash: 'hash123',
        topic: 'Photosynthesis',
        contentJson: {
          title: 'Understanding Photosynthesis',
          content: { introduction: 'Cached intro' },
        },
        createdAt: new Date(),
        viewCount: 5,
      };

      (mockPrisma.generatedStudyContent.findUnique as jest.Mock).mockResolvedValue(cachedContent);
      (mockPrisma.generatedStudyContent.update as jest.Mock).mockResolvedValue({
        ...cachedContent,
        viewCount: 6,
      });

      const req = new Request('http://localhost/api/learn/generate', {
        method: 'POST',
        body: JSON.stringify({ topic: 'Photosynthesis' }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.cached).toBe(true);
      expect(data.content.title).toBe('Understanding Photosynthesis');
      expect(mockCallLLM).not.toHaveBeenCalled();
    });

    it('should generate and store new content if not cached', async () => {
      (mockPrisma.generatedStudyContent.findUnique as jest.Mock).mockResolvedValue(null);
      
      const generatedContent = {
        title: 'Understanding Photosynthesis',
        content: {
          introduction: 'Plants are amazing!',
          summary: 'Test summary',
        },
      };

      mockCallLLM.mockResolvedValue({
        content: JSON.stringify(generatedContent),
      });

      (mockPrisma.generatedStudyContent.create as jest.Mock).mockResolvedValue({
        id: 'content-new',
        contentHash: 'newhash',
        topic: 'Photosynthesis',
        contentJson: generatedContent,
        createdAt: new Date(),
        viewCount: 1,
      });

      const req = new Request('http://localhost/api/learn/generate', {
        method: 'POST',
        body: JSON.stringify({ topic: 'Photosynthesis' }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.cached).toBe(false);
      expect(mockCallLLM).toHaveBeenCalled();
      expect(mockPrisma.generatedStudyContent.create).toHaveBeenCalled();
    });
  });

  describe('Bookmark Saving', () => {
    beforeEach(() => {
      mockGetSession.mockResolvedValue({
        user: { id: 'user-1', role: 'student' },
      });
      (mockPrisma.subscription.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.generatedStudyContent.count as jest.Mock).mockResolvedValue(0);
      (mockPrisma.generatedStudyContent.findUnique as jest.Mock).mockResolvedValue(null);
    });

    it('should save bookmark when saveToPersonal is true', async () => {
      const generatedContent = {
        title: 'Test Topic',
        content: { introduction: 'Test' },
      };

      mockCallLLM.mockResolvedValue({
        content: JSON.stringify(generatedContent),
      });

      (mockPrisma.generatedStudyContent.create as jest.Mock).mockResolvedValue({
        id: 'content-1',
        contentJson: generatedContent,
        createdAt: new Date(),
      });

      (mockPrisma.studentStudyBookmark.create as jest.Mock).mockResolvedValue({
        id: 'bookmark-1',
        userId: 'user-1',
        contentType: 'generated',
        contentId: 'content-1',
      });

      const req = new Request('http://localhost/api/learn/generate', {
        method: 'POST',
        body: JSON.stringify({ topic: 'Test Topic', saveToPersonal: true }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockPrisma.studentStudyBookmark.create).toHaveBeenCalled();
      expect(data.meta.savedToBookmarks).toBe('bookmark-1');
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockGetSession.mockResolvedValue({
        user: { id: 'user-1', role: 'student' },
      });
      (mockPrisma.subscription.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.generatedStudyContent.count as jest.Mock).mockResolvedValue(0);
      (mockPrisma.generatedStudyContent.findUnique as jest.Mock).mockResolvedValue(null);
    });

    it('should handle LLM call failure gracefully', async () => {
      mockCallLLM.mockRejectedValue(new Error('LLM service unavailable'));

      const req = new Request('http://localhost/api/learn/generate', {
        method: 'POST',
        body: JSON.stringify({ topic: 'Photosynthesis' }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to generate');
      expect(data.retryable).toBe(true);
    });

    it('should handle invalid LLM response format', async () => {
      mockCallLLM.mockResolvedValue({
        content: 'This is not JSON',
      });

      const req = new Request('http://localhost/api/learn/generate', {
        method: 'POST',
        body: JSON.stringify({ topic: 'Photosynthesis' }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to process');
      expect(data.retryable).toBe(true);
    });
  });
});

describe('GET /api/learn/generate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 if not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);

    const req = new Request('http://localhost/api/learn/generate', {
      method: 'GET',
    });

    const response = await GET(req);
    expect(response.status).toBe(401);
  });

  it('should return rate limit info and recent generations', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'user-1', role: 'student' },
    });
    
    (mockPrisma.subscription.findFirst as jest.Mock).mockResolvedValue(null);
    (mockPrisma.generatedStudyContent.count as jest.Mock).mockResolvedValue(1);
    (mockPrisma.generatedStudyContent.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'content-1',
        topic: 'Photosynthesis',
        subject: 'Biology',
        grade: 9,
        createdAt: new Date(),
        viewCount: 5,
      },
    ]);

    const req = new Request('http://localhost/api/learn/generate', {
      method: 'GET',
    });

    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.userType).toBe('free');
    expect(data.rateLimit.limit).toBe(3);
    expect(data.rateLimit.remaining).toBe(2);
    expect(data.recentGenerations).toHaveLength(1);
  });
});
