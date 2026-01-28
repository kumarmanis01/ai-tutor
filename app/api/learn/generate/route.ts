/**
 * FILE OBJECTIVE:
 * - API endpoint for on-demand student study material generation.
 * - Allows students to generate content for any topic (school projects, homework help).
 * - Caches results for reuse by other students.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/learn/generate/route.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-01-23T10:30:00Z | copilot | Created on-demand generation API
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { callLLM } from '@/lib/callLLM';
import { logger } from '@/lib/logger';
import crypto from 'crypto';
import { parseLlmJson } from '@/lib/llm/sanitizeJson'

/**
 * Rate limits per user type (requests per day)
 */
const RATE_LIMITS = {
  free: 3,
  premium: 20,
  admin: 1000,
};

/**
 * Generate a content hash for deduplication
 */
function generateContentHash(topic: string, subject?: string, grade?: number, board?: string, language?: string): string {
  const normalized = [
    topic.toLowerCase().trim(),
    subject?.toLowerCase().trim() || '',
    grade?.toString() || '',
    board?.toLowerCase().trim() || '',
    language || 'en',
  ].join('|');
  
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 32);
}

/**
 * Check rate limit for user
 */
async function checkRateLimit(userId: string, userType: 'free' | 'premium' | 'admin'): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const limit = RATE_LIMITS[userType];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const usageCount = await prisma.generatedStudyContent.count({
    where: {
      generatedBy: userId,
      createdAt: {
        gte: today,
        lt: tomorrow,
      },
    },
  });

  return {
    allowed: usageCount < limit,
    remaining: Math.max(0, limit - usageCount),
    resetAt: tomorrow,
  };
}

/**
 * Build the generation prompt
 */
function buildGenerationPrompt(topic: string, subject?: string, grade?: number, board?: string, language?: string): string {
  const gradeText = grade ? `Class ${grade}` : 'general';
  const boardText = board || 'general curriculum';
  const subjectText = subject || 'general knowledge';
  const langText = language === 'hi' ? 'Hindi' : 'English';
  const studentAge = grade ? grade + 5 : 12;

  return `You are an expert educator helping a student understand a topic.

Create comprehensive, engaging study material for:
Topic/Question: ${topic}
Subject: ${subjectText}
Level: ${gradeText}
Curriculum: ${boardText}
Language: ${langText}

AUDIENCE: Students (age ~${studentAge} years)

REQUIREMENTS:
- Use simple, age-appropriate language
- Include relatable real-world examples
- Make abstract concepts concrete
- Be encouraging and supportive
- If this is a question, answer it thoroughly then expand on the concept

OUTPUT: JSON ONLY (no markdown, no explanations outside JSON)

JSON Schema:
{
  "title": "string - engaging title for the topic",
  "content": {
    "introduction": "string - hook that captures student interest (2-3 sentences)",
    
    "learningObjectives": [
      "string - By the end of this, you will understand..."
    ],
    
    "sections": [
      {
        "heading": "string - section title",
        "explanation": "string - clear explanation (3-5 paragraphs)",
        "keyTakeaway": "string - one sentence summary",
        "visualSuggestion": "string - describe a helpful diagram/image (optional)"
      }
    ],
    
    "keyTerms": [
      {
        "term": "string",
        "definition": "string - simple definition",
        "example": "string - usage example"
      }
    ],
    
    "realWorldExamples": [
      {
        "scenario": "string - relatable situation",
        "connection": "string - how the topic applies"
      }
    ],
    
    "practiceQuestions": [
      {
        "question": "string",
        "type": "recall | understanding | application",
        "hint": "string (optional)",
        "answer": "string"
      }
    ],
    
    "summary": "string - 3-4 sentence recap",
    
    "funFact": "string - interesting fact (optional)",
    
    "studyTips": ["string - how to remember or practice this"]
  }
}`;
}

export async function POST(req: Request) {
  // Authentication check
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Please sign in to generate study material' },
      { status: 401 }
    );
  }

  const userId = session.user.id;
  
  // Determine user type for rate limiting
  let userType: 'free' | 'premium' | 'admin' = 'free';
  if (session.user.role === 'admin') {
    userType = 'admin';
  } else {
    // Check if user has active subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: 'active',
        endDate: { gt: new Date() },
      },
    });
    if (subscription) {
      userType = 'premium';
    }
  }

  // Check rate limit
  const rateLimit = await checkRateLimit(userId, userType);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: 'Daily limit reached',
        limit: RATE_LIMITS[userType],
        remaining: 0,
        resetAt: rateLimit.resetAt.toISOString(),
      },
      { status: 429 }
    );
  }

  // Parse request body
  let body: {
    topic: string;
    subject?: string;
    grade?: number;
    board?: string;
    language?: 'en' | 'hi';
    saveToPersonal?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { topic, subject, grade, board, language = 'en', saveToPersonal = false } = body;

  // Validate required fields
  if (!topic || typeof topic !== 'string' || topic.trim().length < 3) {
    return NextResponse.json(
      { error: 'Topic is required and must be at least 3 characters' },
      { status: 400 }
    );
  }

  // Content moderation check (basic)
  const lowerTopic = topic.toLowerCase();
  const blockedTerms = ['hack', 'cheat', 'answer key', 'exam answers'];
  if (blockedTerms.some(term => lowerTopic.includes(term))) {
    return NextResponse.json(
      { error: 'This topic cannot be generated. Please try a different topic.' },
      { status: 400 }
    );
  }

  // Check for existing cached content
  const contentHash = generateContentHash(topic, subject, grade, board, language);
  
  const existingContent = await prisma.generatedStudyContent.findUnique({
    where: { contentHash },
  });

  if (existingContent) {
    // Increment view count
    await prisma.generatedStudyContent.update({
      where: { id: existingContent.id },
      data: { viewCount: { increment: 1 } },
    });

    logger.info('[generate] Serving cached content', {
      userId,
      topic,
      contentId: existingContent.id,
    });

    return NextResponse.json({
      success: true,
      cached: true,
      content: {
        title: (existingContent.contentJson as any).title,
        content: (existingContent.contentJson as any).content,
      },
      meta: {
        contentId: existingContent.id,
        generatedAt: existingContent.createdAt.toISOString(),
        viewCount: existingContent.viewCount + 1,
      },
      rateLimit: {
        remaining: rateLimit.remaining,
        resetAt: rateLimit.resetAt.toISOString(),
      },
    });
  }

  // Generate new content
  logger.info('[generate] Generating new content', {
    userId,
    topic,
    subject,
    grade,
    board,
    language,
  });

  const prompt = buildGenerationPrompt(topic, subject, grade, board, language);

  let llmResponse: { content: string };
  let tokensUsed: number | undefined;

  try {
    llmResponse = await callLLM({
      prompt,
      meta: {
        promptType: 'student_generation',
        topic,
        subject,
        grade,
        board,
        language,
        userId,
      },
    });
  } catch (err: any) {
    logger.error('[generate] LLM call failed', { userId, topic, error: err.message });
    return NextResponse.json(
      { error: 'Failed to generate content. Please try again.', retryable: true },
      { status: 500 }
    );
  }

  // Parse and validate response using shared parser
  let parsed: any;
  try {
    parsed = parseLlmJson(llmResponse.content);
    if (!parsed || !parsed.title || !parsed.content) throw new Error('Invalid response structure');
  } catch (err: any) {
    logger.error('[generate] Failed to parse LLM response', { userId, topic, error: String(err) });
    return NextResponse.json(
      { error: 'Failed to process generated content. Please try again.', retryable: true },
      { status: 500 }
    );
  }

  // Store the generated content
  const storedContent = await prisma.generatedStudyContent.create({
    data: {
      contentHash,
      topic: topic.trim(),
      subject: subject?.trim() || null,
      grade: grade || null,
      board: board?.trim() || null,
      language: language as any,
      contentJson: parsed,
      generatedBy: userId,
      model: 'gpt-4', // TODO: Get from LLM response
      tokensUsed,
      viewCount: 1,
    },
  });

  // Optionally save to student's bookmarks
  let bookmarkId: string | undefined;
  if (saveToPersonal) {
    const bookmark = await prisma.studentStudyBookmark.create({
      data: {
        userId,
        contentType: 'generated',
        contentId: storedContent.id,
      },
    });
    bookmarkId = bookmark.id;
  }

  logger.info('[generate] Content generated and stored', {
    userId,
    topic,
    contentId: storedContent.id,
    bookmarkId,
  });

  return NextResponse.json({
    success: true,
    cached: false,
    content: {
      title: parsed.title,
      content: parsed.content,
    },
    meta: {
      contentId: storedContent.id,
      generatedAt: storedContent.createdAt.toISOString(),
      savedToBookmarks: bookmarkId,
    },
    rateLimit: {
      remaining: rateLimit.remaining - 1,
      resetAt: rateLimit.resetAt.toISOString(),
    },
  });
}

/**
 * GET /api/learn/generate
 * Returns user's generation history and rate limit info
 */
export async function GET(_req: Request) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  // Get user type
  let userType: 'free' | 'premium' | 'admin' = 'free';
  if (session.user.role === 'admin') {
    userType = 'admin';
  } else {
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: 'active',
        endDate: { gt: new Date() },
      },
    });
    if (subscription) {
      userType = 'premium';
    }
  }

  const rateLimit = await checkRateLimit(userId, userType);

  // Get recent generations by this user
  const recentGenerations = await prisma.generatedStudyContent.findMany({
    where: { generatedBy: userId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      topic: true,
      subject: true,
      grade: true,
      createdAt: true,
      viewCount: true,
    },
  });

  return NextResponse.json({
    userType,
    rateLimit: {
      limit: RATE_LIMITS[userType],
      remaining: rateLimit.remaining,
      resetAt: rateLimit.resetAt.toISOString(),
    },
    recentGenerations,
  });
}
