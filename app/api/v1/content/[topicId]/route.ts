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
 * - 2026-04-25T01:45:00Z | copilot | added locale-aware content selection, hint placement metadata, and stronger cache headers
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
  en?: NoteLikeContent;
  hi?: NoteLikeContent;
  // New schema from topic-notes prompt: metadata + top-level sections with type/title/content
  metadata?: {
    topic?: string;
    conceptsIntroduced?: string[];
    estimatedReadingMinutes?: number;
    difficultyLevel?: string;
  };
  // Shared sections field -- old format uses heading/explanation/body; new format uses title/content
  sections?: Array<{
    heading?: string;
    explanation?: string;
    body?: string;
    imageUrl?: string;
    imageAlt?: string;
    // New format fields
    type?: string;
    title?: string;
    content?: string;
  }>;
  // New schema concept fields
  keyConcepts?: Array<{ term?: string; definition?: string; formula?: string | null }>;
  examTips?: string[];
  bridgeToNext?: string;
  // Old wrapped format
  content?: {
    introduction?: string;
    learningObjectives?: string[];
    sections?: Array<{
      heading?: string;
      explanation?: string;
      body?: string;
      imageUrl?: string;
      imageAlt?: string;
    }>;
    keyTerms?: Array<{ term?: string; definition?: string }>;
    summary?: string;
    commonMistakes?: Array<{ correction?: string }>;
    videoUrl?: string;
  };
  // Old flat format
  introduction?: string;
  learningObjectives?: string[];
  keyTerms?: Array<{ term?: string; definition?: string }>;
  summary?: string;
  commonMistakes?: Array<{ correction?: string }>;
  videoUrl?: string;
}

function resolveLocalizedContent(raw: unknown, locale: 'en' | 'hi'): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const candidate = raw as NoteLikeContent;
  if (locale === 'hi' && candidate.hi) return candidate.hi;
  if (locale === 'en' && candidate.en) return candidate.en;
  return raw;
}

function normalizeContent(raw: unknown): {
  title: string | null;
  intro: string;
  keyPoints: string[];
  sections: Array<{ heading: string; body: string; imageUrl: string | null; imageAlt: string | null }>;
  hint: string;
  hintPlacements: Array<{ sectionIndex: number; hintText: string }>;
  videoUrl: string | null;
} {
  const content = (raw ?? {}) as NoteLikeContent;

  // Detect new schema: top-level sections array where items have a 'content' string field
  // (produced by topic-notes.ts prompt via notesWorker). Old schema wraps under content.* or
  // uses heading/explanation/body field names.
  const topLevelSections = Array.isArray(content.sections) ? content.sections : [];
  const isNewSchema =
    topLevelSections.length > 0 &&
    typeof topLevelSections[0]?.content === 'string' &&
    !topLevelSections[0]?.explanation &&
    !topLevelSections[0]?.body;

  if (isNewSchema) {
    // New schema: { metadata, sections:[{type, title, content}], keyConcepts, examTips, bridgeToNext }
    const sections = topLevelSections
      .map((s) => ({
        heading: (s?.title ?? s?.heading ?? '').trim(),
        body: (s?.content ?? s?.explanation ?? s?.body ?? '').trim(),
        imageUrl: null as string | null,
        imageAlt: null as string | null,
      }))
      .filter((s) => s.heading.length > 0 || s.body.length > 0);

    const keyConceptPoints = Array.isArray(content.keyConcepts)
      ? content.keyConcepts
          .map((k) => {
            const term = (k?.term ?? '').trim();
            const def = (k?.definition ?? '').trim();
            return term && def ? `${term}: ${def}` : '';
          })
          .filter(Boolean)
      : [];

    const conceptsIntroduced = Array.isArray(content.metadata?.conceptsIntroduced)
      ? (content.metadata!.conceptsIntroduced as string[]).filter(
          (c): c is string => typeof c === 'string'
        )
      : [];

    const keyPoints = [...conceptsIntroduced, ...keyConceptPoints].slice(0, 4);

    // Intro: prefer hook section body, fall back to first section body
    const hookSection = topLevelSections.find((s) => s?.type === 'hook');
    const intro =
      (hookSection?.content ?? '').trim() ||
      (sections[0]?.body ?? '').trim() ||
      'Review the key ideas below before practicing.';

    const hint =
      (content.bridgeToNext ?? '').trim() ||
      (Array.isArray(content.examTips) && content.examTips[0]
        ? String(content.examTips[0]).trim()
        : '') ||
      'Take it step by step and verify each part.';

    const titleRaw =
      (content.metadata?.topic ?? content.title ?? '') as string;
    return {
      title: titleRaw.trim() || null,
      intro,
      keyPoints,
      sections,
      hint,
      hintPlacements: [],
      videoUrl: null,
    };
  }

  // Old schema: content wrapped under content.* object or flat at root level
  const nested = content.content ?? content;
  const commonMistakes = Array.isArray(nested.commonMistakes) ? nested.commonMistakes : [];

  const sections = Array.isArray(nested.sections)
    ? nested.sections
        .map((section) => ({
          heading: (section?.heading ?? section?.title ?? '').trim(),
          // Support old 'explanation' and 'body' field names
          body: (section?.explanation ?? section?.body ?? section?.content ?? '').trim(),
          imageUrl:
            typeof section?.imageUrl === 'string' && section.imageUrl.trim().length > 0
              ? section.imageUrl.trim()
              : null,
          imageAlt:
            typeof section?.imageAlt === 'string' && section.imageAlt.trim().length > 0
              ? section.imageAlt.trim()
              : null,
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
    commonMistakes.length > 0
      ? (commonMistakes[0]?.correction ?? '').trim() || 'Take it step by step and verify each part.'
      : 'Take it step by step and verify each part.';

  const hintPlacements = commonMistakes
    .map((mistake, index) => ({
      sectionIndex: sections.length === 0 ? 0 : Math.min(index, sections.length - 1),
      hintText: (mistake?.correction ?? '').trim(),
    }))
    .filter((placement) => placement.hintText.length > 0)
    .slice(0, 2);

  const intro =
    (nested.introduction ?? '').trim() ||
    (nested.summary ?? '').trim() ||
    (sections[0]?.body ?? '').trim() ||
    'Review the key ideas below before practicing.';

  const videoUrl =
    typeof nested.videoUrl === 'string' && nested.videoUrl.trim() ? nested.videoUrl : null;

  return {
    title: typeof content.title === 'string' && content.title.trim() ? content.title.trim() : null,
    intro,
    keyPoints,
    sections,
    hint,
    hintPlacements,
    videoUrl,
  };
}

export async function GET(req: Request, { params }: Params) {
  const start = Date.now();
  const { topicId } = await params;
  const url = new URL(req.url);
  const locale = url.searchParams.get('locale') === 'hi' ? 'hi' : 'en';

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
          select: {
            id: true,
            title: true,
            contentJson: true,
            status: true,
            language: true,
          },
        },
      },
    });

    if (!topic) {
      const res = NextResponse.json({ error: 'Topic not found' }, { status: 404 });
      logger.logAPI(req, res, { className: 'V1ContentTopicAPI', methodName: 'GET' }, start);
      return res;
    }

    const availableLocales = Array.from(
      new Set(topic.notes.map((note) => String(note.language).toLowerCase()).filter(Boolean))
    );
    const note =
      topic.notes.find((item) => String(item.language).toLowerCase() === locale) ??
      topic.notes.find((item) => String(item.language).toLowerCase() === 'en') ??
      topic.notes[0] ??
      null;
    let normalized = normalizeContent(resolveLocalizedContent(note?.contentJson, locale));

    if (!note) {
      const fallback = await prisma.generatedStudyContent.findFirst({
        where: {
          lifecycle: 'active',
          topic: { equals: topic.name, mode: 'insensitive' },
          subject: topic.chapter.subject.name,
          language: locale,
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          contentJson: true,
          language: true,
        },
      });
      const englishFallback =
        fallback ??
        (await prisma.generatedStudyContent.findFirst({
          where: {
            lifecycle: 'active',
            topic: { equals: topic.name, mode: 'insensitive' },
            subject: topic.chapter.subject.name,
            language: 'en',
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            contentJson: true,
            language: true,
          },
        }));
      normalized = normalizeContent(resolveLocalizedContent(englishFallback?.contentJson, locale));
    }

    const sections =
      normalized.sections.length > 0
        ? normalized.sections
        : [{ heading: 'Overview', body: normalized.intro, imageUrl: null, imageAlt: null }];

    const res = NextResponse.json(
      {
        topicId: topic.id,
        locale,
        availableLocales,
        chapterId: topic.chapter.id,
        chapterName: topic.chapter.name,
        subjectId: topic.chapter.subject.id,
        subjectName: topic.chapter.subject.name,
        title: normalized.title ?? topic.name,
        introduction: normalized.intro,
        keyPoints: normalized.keyPoints,
        sections,
        studyBuddyHint: normalized.hint,
        hintPlacements: normalized.hintPlacements,
        video: normalized.videoUrl,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
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
