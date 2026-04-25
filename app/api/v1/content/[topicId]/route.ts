/**
 * FILE OBJECTIVE:
 * - GET /api/v1/content/[topicId]
 * - Returns lesson content payload for an unlocked topic using TopicNote/GeneratedStudyContent fallback.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/content/topicId/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created S2.2 lesson content endpoint
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ topicId: string }>;
}

interface NoteLikeContent {
  title?: string;
  content?: {
    introduction?: string;
    learningObjectives?: string[];
    sections?: Array<{ heading?: string; explanation?: string }>;
    keyTerms?: Array<{ term?: string; definition?: string }>;
    summary?: string;
    commonMistakes?: Array<{ correction?: string }>;
    videoUrl?: string;
  };
  introduction?: string;
  learningObjectives?: string[];
  sections?: Array<{ heading?: string; explanation?: string }>;
  keyTerms?: Array<{ term?: string; definition?: string }>;
  summary?: string;
  commonMistakes?: Array<{ correction?: string }>;
  videoUrl?: string;
}

function normalizeContent(raw: unknown): {
  title: string | null;
  intro: string;
  keyPoints: string[];
  sections: Array<{ heading: string; body: string }>;
  hint: string;
  videoUrl: string | null;
} {
  const content = (raw ?? {}) as NoteLikeContent;
  const nested = content.content ?? content;

  const sections = Array.isArray(nested.sections)
    ? nested.sections
        .map((section) => ({
          heading: (section?.heading ?? '').trim(),
          body: (section?.explanation ?? '').trim(),
        }))
        .filter((section) => section.heading.length > 0 || section.body.length > 0)
    : [];

  const keyTermPoints = Array.isArray(nested.keyTerms)
    ? nested.keyTerms
        .map((term) => {
          const left = (term?.term ?? '').trim();
          const right = (term?.definition ?? '').trim();
          if (!left || !right) return '';
          return `${left}: ${right}`;
        })
        .filter((point) => point.length > 0)
    : [];

  const objectivePoints = Array.isArray(nested.learningObjectives)
    ? nested.learningObjectives.filter((point): point is string => typeof point === 'string')
    : [];

  const keyPoints = [...objectivePoints, ...keyTermPoints].slice(0, 4);

  const hint =
    Array.isArray(nested.commonMistakes) && nested.commonMistakes.length > 0
      ? (nested.commonMistakes[0]?.correction ?? '').trim() || 'Take it step by step and verify each part.'
      : 'Take it step by step and verify each part.';

  const intro =
    (nested.introduction ?? '').trim() ||
    (nested.summary ?? '').trim() ||
    (sections[0]?.body ?? '').trim() ||
    'Review the key ideas below before practicing.';

  const videoUrl = typeof nested.videoUrl === 'string' && nested.videoUrl.trim() ? nested.videoUrl : null;

  return {
    title: typeof content.title === 'string' && content.title.trim() ? content.title.trim() : null,
    intro,
    keyPoints,
    sections,
    hint,
    videoUrl,
  };
}

export async function GET(req: Request, { params }: Params) {
  const start = Date.now();
  const { topicId } = await params;

  try {
    const session = await getServerSessionForHandlers();
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      logger.logAPI(req, res, { className: 'V1ContentTopicAPI', methodName: 'GET' }, start);
      return res;
    }

    const topic = await prisma.topicDef.findUnique({
      where: { id: topicId },
      select: {
        id: true,
        name: true,
        chapter: {
          select: {
            id: true,
            name: true,
            subject: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        notes: {
          where: {
            lifecycle: 'active',
            OR: [{ status: 'approved' }, { status: 'draft' }],
          },
          orderBy: [{ status: 'asc' }, { version: 'desc' }],
          take: 1,
          select: {
            id: true,
            title: true,
            contentJson: true,
            status: true,
          },
        },
      },
    });

    if (!topic) {
      const res = NextResponse.json({ error: 'Topic not found' }, { status: 404 });
      logger.logAPI(req, res, { className: 'V1ContentTopicAPI', methodName: 'GET' }, start);
      return res;
    }

    const note = topic.notes[0] ?? null;
    let normalized = normalizeContent(note?.contentJson);

    if (!note) {
      const fallback = await prisma.generatedStudyContent.findFirst({
        where: {
          lifecycle: 'active',
          topic: { equals: topic.name, mode: 'insensitive' },
          subject: topic.chapter.subject.name,
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          contentJson: true,
        },
      });
      normalized = normalizeContent(fallback?.contentJson);
    }

    const sections =
      normalized.sections.length > 0
        ? normalized.sections
        : [{ heading: 'Overview', body: normalized.intro }];

    const res = NextResponse.json(
      {
        topicId: topic.id,
        chapterId: topic.chapter.id,
        chapterName: topic.chapter.name,
        subjectId: topic.chapter.subject.id,
        subjectName: topic.chapter.subject.name,
        title: normalized.title ?? topic.name,
        introduction: normalized.intro,
        keyPoints: normalized.keyPoints,
        sections,
        studyBuddyHint: normalized.hint,
        video: normalized.videoUrl,
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=120',
        },
      }
    );

    logger.logAPI(req, res, { className: 'V1ContentTopicAPI', methodName: 'GET' }, start);
    return res;
  } catch (err) {
    logger.error('V1ContentTopicAPI.error', {
      event: 'v1_content_topic_failed',
      context: { error: err instanceof Error ? err.message : String(err), topicId },
    });
    const res = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    logger.logAPI(req, res, { className: 'V1ContentTopicAPI', methodName: 'GET' }, start);
    return res;
  }
}
