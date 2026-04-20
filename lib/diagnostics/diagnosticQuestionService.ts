  import { prisma } from '@/lib/prisma';
  import { ensureQuestions, type QuestionFilters } from '@/lib/tests';
  import { logger } from '@/lib/logger';
  import { diagnosticConfig, computeDifficultyCounts } from '@/lib/config';
  import OpenAI from 'openai';

  export type DiagnosticDifficulty = 'easy' | 'medium' | 'hard';

  export interface DiagnosticQuestionOption {
    key: string;
    label: string;
  }

  export interface DiagnosticQuestion {
    id: string;
    questionText: string;
    options: DiagnosticQuestionOption[];
    correctAnswer: string;
    topicId: string;
    difficulty: DiagnosticDifficulty;
  }

  export interface GenerateDiagnosticTestParams {
    /**
     * Board slug (e.g. "cbse"). Required to resolve the SubjectDef.
     */
    boardSlug: string;
    /**
    * Grade (e.g. 8 or "8"). Accepts number or string; will be coerced to an integer.
    */
    grade: number | string;
    /**
     * Subject slug (e.g. "math"). Must match SubjectDef.slug.
     */
    subjectSlug: string;
    /**
     * Language code used for question generation / selection, when available.
     * Optional for now; the underlying question bank may fall back gracefully.
     */
    languageCode?: string;
    /**
     * When the caller already holds the SubjectDef.id (e.g. the diagnostic page),
     * pass it here to bypass the slug/board/grade re-lookup in getCurriculumTopics.
     * This prevents failures caused by ClassLevel.lifecycle mismatches.
     */
    subjectId?: string;
  }

  export interface DiagnosticTest {
    subjectId: string;
    subjectName: string;
    boardSlug: string;
    grade: number;
    questions: DiagnosticQuestion[];
  }

  // Counts driven by diagnosticConfig so they respect env-var overrides.
  const { totalItems: TOTAL_QUESTIONS, easy: EASY_COUNT, medium: MEDIUM_COUNT, hard: HARD_COUNT } =
    computeDifficultyCounts(diagnosticConfig.minItems);

  function parseChoices(raw: unknown): DiagnosticQuestionOption[] {
    try {
      if (!raw) return [];
      const value =
        typeof raw === 'string'
          ? // choices may be stored as a JSON string
            JSON.parse(raw)
          : raw;
      if (!Array.isArray(value)) return [];
      return value
        .map((c: unknown, idx: number) => {
          // Plain string array format (most common): ["Option A", "Option B", ...]
          if (typeof c === 'string') {
            return { key: String(idx), label: c };
          }
          // Object format: { key, label } or { id, text } or similar
          if (c !== null && typeof c === 'object') {
            const obj = c as Record<string, unknown>;
            return {
              key: String(obj.key ?? obj.id ?? obj.value ?? idx),
              label: String(obj.label ?? obj.text ?? obj.value ?? ''),
            };
          }
          return { key: String(idx), label: String(c ?? '') };
        })
        .filter((c) => c.label.trim().length > 0);
    } catch {
      return [];
    }
  }

  async function getCurriculumTopics(params: GenerateDiagnosticTestParams) {
    // Explicit shape of the selected Subject with nested chapters/topics
    type SubjectWithChapters = {
      id: string;
      name: string;
      chapters: {
        id: string;
        name: string;
        order: number;
        topics: { id: string; name: string }[];
      }[];
    };

    const subjectSelect = {
      id: true,
      name: true,
      chapters: {
        where: { lifecycle: 'active' as const },
        orderBy: { order: 'asc' as const },
        select: {
          id: true,
          name: true,
          order: true,
          topics: {
            where: { lifecycle: 'active' as const },
            orderBy: { order: 'asc' as const },
            select: { id: true, name: true },
          },
        },
      },
    };

    let subject: SubjectWithChapters | null = null;

    // Fast path: caller already holds the SubjectDef.id -- skip the slug/board/grade
    // re-lookup that can fail when ClassLevel.lifecycle is not 'active'.
    if (params.subjectId) {
      subject = (await prisma.subjectDef.findUnique({
        where: { id: params.subjectId },
        select: subjectSelect,
      })) as SubjectWithChapters | null;

      if (!subject) {
        throw new Error(
          `DiagnosticQuestionService: SubjectDef not found for id=${params.subjectId}`,
        );
      }
    } else {
      // Slug-based lookup -- requires ClassLevel.lifecycle = 'active'.
      // Tries exact match first; falls back to relaxed ClassLevel lifecycle filter
      // to handle cases where ClassLevel was not explicitly activated after seeding.
      subject = (await prisma.subjectDef.findFirst({
        where: {
          slug: params.subjectSlug,
          lifecycle: 'active',
          class: {
            lifecycle: 'active',
            grade: Number(params.grade),
            board: {
              lifecycle: 'active',
              slug: { equals: params.boardSlug, mode: 'insensitive' },
            },
          },
        },
        select: subjectSelect,
      })) as SubjectWithChapters | null;

      if (!subject) {
        // Fallback: ignore ClassLevel lifecycle -- some seeds omit it
        subject = (await prisma.subjectDef.findFirst({
          where: {
            slug: params.subjectSlug,
            lifecycle: 'active',
            class: {
              grade: Number(params.grade),
              board: {
                slug: { equals: params.boardSlug, mode: 'insensitive' },
              },
            },
          },
          select: subjectSelect,
        })) as SubjectWithChapters | null;
      }

      if (!subject) {
        throw new Error(
          `DiagnosticQuestionService: Subject not found for board=${params.boardSlug}, grade=${params.grade}, subject=${params.subjectSlug}`,
        );
      }
    }

    const topicIds: string[] = [];
    for (const chapter of subject.chapters) {
      for (const topic of chapter.topics) {
        topicIds.push(topic.id);
      }
    }

    if (topicIds.length === 0) {
      throw new Error(
        `DiagnosticQuestionService: No active topics found for subject=${params.subjectSlug}`,
      );
    }

    return {
      subjectId: subject.id,
      subjectName: subject.name,
      topicIds,
    };
  }

  async function pickQuestionsForDifficulty(
    params: GenerateDiagnosticTestParams,
    topicIds: string[],
    difficulty: DiagnosticDifficulty,
    count: number,
    excludeIds?: Set<string>,
  ) {
    const results: DiagnosticQuestion[] = [];
    // Track IDs already selected in this band to prevent within-band duplicates
    // (e.g. same question returned on a second topic cycle when the bank is thin).
    const seenIds = new Set<string>();

    // Round-robin across topics: try to pick at most one question per topic
    // before falling back to a broader subject-level selection.
    const filtersBase: QuestionFilters = {
      subject: params.subjectSlug,
      grade: String(params.grade),
      board: params.boardSlug,
      difficulty,
      type: 'mcq',
    };

    let topicIndex = 0;
    const maxTopicCycles = topicIds.length * 2; // avoid infinite loops
    let cycles = 0;

    while (results.length < count && topicIds.length > 0 && cycles < maxTopicCycles) {
      const topicId = topicIds[topicIndex];
      topicIndex = (topicIndex + 1) % topicIds.length;
      cycles += 1;

      try {
        const questions = await ensureQuestions({ ...filtersBase, topicId }, 1, excludeIds);
        if (questions.length === 0) continue;
        const q = questions[0];
        if (!q.id || !q.prompt) continue;
        // Skip if already selected in this difficulty band.
        if (seenIds.has(q.id)) continue;

        const options = parseChoices(q.choices as unknown);
        // We require at least 2 options for a usable diagnostic MCQ.
        if (options.length < 2) continue;

        seenIds.add(q.id);
        results.push({
          id: q.id,
          questionText: q.prompt,
          options,
          correctAnswer: q.correctAnswer ?? '',
          topicId: q.topicId ?? topicId,
          difficulty,
        });

        if (results.length >= count) break;
      } catch (err) {
        logger.warn('DiagnosticQuestionService.ensureQuestions.topic_failed', {
          error: String(err),
          topicId,
          difficulty,
        });
      }
    }

    if (results.length >= count) {
      return results.slice(0, count);
    }

    // Fallback: subject-level selection to fill remaining slots.
    const remaining = count - results.length;
    try {
      const extra = await ensureQuestions(filtersBase, remaining, excludeIds);
      for (const q of extra) {
        if (!q.id || !q.prompt) continue;
        // Skip duplicates in the fallback path too.
        if (seenIds.has(q.id)) continue;
        const options = parseChoices(q.choices as unknown);
        if (options.length < 2) continue;
        seenIds.add(q.id);
        results.push({
          id: q.id,
          questionText: q.prompt,
          options,
          correctAnswer: q.correctAnswer ?? '',
          topicId: q.topicId ?? '',
          difficulty,
        });
        if (results.length >= count) break;
      }
    } catch (err) {
      logger.error('DiagnosticQuestionService.ensureQuestions.subject_failed', {
        error: String(err),
        difficulty,
        subjectSlug: params.subjectSlug,
      });
    }

    return results.slice(0, count);
  }

  /**
   * Generates the initial diagnostic test for a subject during onboarding.
   *
   * Behaviour:
   * - Resolves the SubjectDef via board/grade/subjectSlug.
   * - Walks the curriculum (ChapterDef → TopicDef) to collect active topicIds.
   * - For each difficulty band (easy/medium/hard), uses ensureQuestions() to
   *   select or generate questions that are mapped to existing topics.
   * - Returns exactly 15 questions per subject with mix:
   *   - 6 easy, 6 medium, 3 hard.
   *
   * Question metadata is persisted via the existing Question / GeneratedQuestion
   * pipelines used by ensureQuestions; this service only orchestrates selection
   * and shaping of the diagnostic test payload.
   */
  export async function generateSubjectDiagnosticTest(
    params: GenerateDiagnosticTestParams,
    excludeQuestionIds?: Set<string>,
  ): Promise<DiagnosticTest> {
    logger.info('DiagnosticQuestionService.generate.start', { params });

    // Normalize grade early: callers (DB rows, query params) sometimes supply
    // the grade as a string ("10"). Prisma expects an integer on the
    // curriculum `class.grade` field, so coerce and validate here.
    const gradeNum = typeof params.grade === 'string' ? parseInt(params.grade, 10) : params.grade;
    if (Number.isNaN(Number(gradeNum))) {
      throw new Error(`DiagnosticQuestionService: Invalid grade value: ${params.grade}`);
    }

    const normalizedParams: GenerateDiagnosticTestParams = { ...params, grade: Number(gradeNum) };

    const { subjectId, subjectName, topicIds } = await getCurriculumTopics(normalizedParams);
    logger.info('DiagnosticQuestionService.generate.curriculum', {
      subjectId,
      subjectName,
      topicCount: topicIds.length,
      topicIdsSample: topicIds.slice(0, 20),
    });

    const [easy, medium, hard] = await Promise.all([
      pickQuestionsForDifficulty(normalizedParams, topicIds, 'easy', EASY_COUNT, excludeQuestionIds),
      pickQuestionsForDifficulty(normalizedParams, topicIds, 'medium', MEDIUM_COUNT, excludeQuestionIds),
      pickQuestionsForDifficulty(normalizedParams, topicIds, 'hard', HARD_COUNT, excludeQuestionIds),
    ]);

    try {
      logger.info('DiagnosticQuestionService.generate.difficulty_counts', {
        easyCount: easy.length,
        mediumCount: medium.length,
        hardCount: hard.length,
        easyIds: easy.map((q) => q.id).slice(0, 50),
        mediumIds: medium.map((q) => q.id).slice(0, 50),
        hardIds: hard.map((q) => q.id).slice(0, 50),
      });
    } catch (e) {
      logger.warn('DiagnosticQuestionService.generate.logging_failed', { error: String(e) });
    }

    // Post-hoc deduplication across bands: the three bands ran in parallel so they
    // cannot share a seenIds set. Remove any cross-band duplicate by question ID,
    // preserving the first occurrence (easy wins over medium wins over hard).
    const crossBandSeen = new Set<string>();
    const questions = [...easy, ...medium, ...hard].filter((q) => {
      if (crossBandSeen.has(q.id)) return false;
      crossBandSeen.add(q.id);
      return true;
    });

    // In the unlikely event that we could not source enough questions,
    // trim or pad as needed so callers always receive TOTAL_QUESTIONS.
    if (questions.length > TOTAL_QUESTIONS) {
      return {
        subjectId,
        subjectName,
        boardSlug: normalizedParams.boardSlug,
        grade: Number(normalizedParams.grade),
        questions: questions.slice(0, TOTAL_QUESTIONS),
      };
    }

    if (questions.length < TOTAL_QUESTIONS) {
      logger.warn('DiagnosticQuestionService.insufficient_questions', {
        have: questions.length,
        expected: TOTAL_QUESTIONS,
        subjectSlug: params.subjectSlug,
        boardSlug: params.boardSlug,
        grade: Number(normalizedParams.grade),
        questionIds: questions.map((q) => q.id).slice(0, 100),
      });

      // Last-resort: generate questions on-demand via LLM when the bank is completely empty.
      // This ensures the student always sees a test rather than a "not ready" screen.
      // Generated questions are persisted so subsequent loads are instant.
      if (questions.length === 0) {
        try {
          logger.info('DiagnosticQuestionService.onDemandGeneration.start', {
            subjectId, subjectName, grade: normalizedParams.grade, boardSlug: normalizedParams.boardSlug,
          });
          const onDemand = await generateDiagnosticQuestionsOnDemand({
            subjectId,
            subjectName,
            boardSlug: normalizedParams.boardSlug,
            grade: Number(normalizedParams.grade),
            topicIds,
            languageCode: normalizedParams.languageCode,
            totalCount: TOTAL_QUESTIONS,
          });
          if (onDemand.length > 0) {
            logger.info('DiagnosticQuestionService.onDemandGeneration.success', {
              generated: onDemand.length,
            });
            return {
              subjectId,
              subjectName,
              boardSlug: params.boardSlug,
              grade: Number(normalizedParams.grade),
              questions: onDemand,
            };
          }
        } catch (genErr) {
          logger.error('DiagnosticQuestionService.onDemandGeneration.failed', {
            error: String(genErr),
            subjectId,
          });
        }
      }
    }

    const sampleQuestions = questions.slice(0, 10).map((q) => ({
      id: q.id,
      topicId: q.topicId,
      difficulty: q.difficulty,
      questionTextSnippet: q.questionText?.slice(0, 200),
    }));

    logger.info('DiagnosticQuestionService.generate.complete', {
      subjectId,
      subjectName,
      boardSlug: normalizedParams.boardSlug,
      grade: Number(normalizedParams.grade),
      totalQuestions: questions.length,
      sampleQuestions,
    });

    return {
      subjectId,
      subjectName,
      boardSlug: params.boardSlug,
      grade: Number(normalizedParams.grade),
      questions,
    };
  }

  // ── On-demand LLM question generation ────────────────────────────────────────

  interface OnDemandParams {
    subjectId: string;
    subjectName: string;
    boardSlug: string;
    grade: number;
    topicIds: string[];
    languageCode?: string;
    totalCount: number;
  }

  /**
   * Generates diagnostic MCQ questions via LLM when the question bank is empty.
   *
   * Makes a single OpenAI call for all required questions (no per-topic loop).
   * Persists each question to the Question table so future loads hit the bank.
   * Returns up to totalCount questions; returns [] on any failure.
   *
   * Uses gpt-4o-mini (fast, cheap) with a 30s timeout.
   * Falls back gracefully: any parse/persist error is skipped, not thrown.
   */
  async function generateDiagnosticQuestionsOnDemand(
    params: OnDemandParams,
  ): Promise<DiagnosticQuestion[]> {
    if (process.env.LLM_MODE === 'mock') {
      return [];
    }
    if (!process.env.OPENAI_API_KEY) {
      logger.warn('DiagnosticQuestionService.onDemand.noApiKey');
      return [];
    }

    const { subjectId, subjectName, boardSlug, grade, topicIds, languageCode, totalCount } = params;

    // Fetch topic names for context (up to 20 topics)
    const topicNames = await prisma.topicDef
      .findMany({
        where: { id: { in: topicIds.slice(0, 20) } },
        select: { id: true, name: true },
      })
      .then((rows) => rows.map((r) => r.name).join(', '))
      .catch(() => '');

    const langNote = languageCode && languageCode !== 'en'
      ? `Write all questions in ${languageCode === 'hi' ? 'Hindi' : languageCode} language.`
      : '';

    const { easy: easyCount, medium: mediumCount, hard: hardCount } = computeDifficultyCounts(totalCount);

    const prompt = [
      `You are generating a diagnostic assessment for an Indian ${boardSlug.toUpperCase()} Grade ${grade} ${subjectName} student.`,
      langNote,
      `Generate exactly ${totalCount} multiple-choice questions (MCQs):`,
      `- ${easyCount} easy questions`,
      `- ${mediumCount} medium questions`,
      `- ${hardCount} hard questions`,
      `Topics to cover: ${topicNames || subjectName}`,
      '',
      'Rules:',
      '- Each question must have exactly 4 options labelled A, B, C, D',
      '- correctAnswer must be exactly one of: "A", "B", "C", or "D"',
      '- Questions must be curriculum-appropriate for the grade level',
      '- No trick questions -- test genuine understanding',
      '',
      'Return ONLY a valid JSON array with no markdown:',
      '[{"prompt":"question text","choices":["Option A","Option B","Option C","Option D"],"correctAnswer":"A","difficulty":"easy"},...]',
    ].filter(Boolean).join('\n');

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    let rawText = '';
    try {
      const completion = await Promise.race([
        openai.chat.completions.create({
          model: process.env.MODEL_SMALL ?? 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 4000,
        }),
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error('onDemand_llm_timeout')), 30_000),
        ),
      ]) as Awaited<ReturnType<typeof openai.chat.completions.create>>;
      rawText = completion.choices?.[0]?.message?.content ?? '';
    } catch (llmErr) {
      logger.error('DiagnosticQuestionService.onDemand.llmCallFailed', { error: String(llmErr) });
      return [];
    }

    let parsed: unknown[];
    try {
      const match = rawText.match(/\[[\s\S]*\]/);
      if (!match) return [];
      parsed = JSON.parse(match[0]);
      if (!Array.isArray(parsed)) return [];
    } catch {
      logger.warn('DiagnosticQuestionService.onDemand.parseError', { rawText: rawText.slice(0, 300) });
      return [];
    }

    const results: DiagnosticQuestion[] = [];
    const topicIdsCycle = topicIds.length > 0 ? topicIds : [null];

    for (let i = 0; i < parsed.length && results.length < totalCount; i++) {
      const item = parsed[i] as Record<string, unknown>;
      const questionText = typeof item.prompt === 'string' ? item.prompt.trim() : '';
      const rawChoices = Array.isArray(item.choices) ? item.choices : [];
      const correctAnswer = typeof item.correctAnswer === 'string' ? item.correctAnswer.trim() : '';
      const difficulty = (['easy', 'medium', 'hard'].includes(String(item.difficulty ?? ''))
        ? String(item.difficulty)
        : 'medium') as DiagnosticDifficulty;

      if (!questionText || rawChoices.length < 2 || !correctAnswer) continue;

      const options: DiagnosticQuestionOption[] = rawChoices.map((c: unknown, idx: number) => ({
        key: ['A', 'B', 'C', 'D'][idx] ?? String(idx),
        label: String(c ?? ''),
      })).filter((o) => o.label.trim().length > 0);

      if (options.length < 2) continue;

      // Assign to a topic in round-robin fashion
      const topicId = topicIdsCycle[i % topicIdsCycle.length] ?? null;

      try {
        const persisted = await prisma.question.create({
          data: {
            type: 'mcq',
            prompt: questionText,
            choices: JSON.stringify(rawChoices),
            correctAnswer,
            difficulty,
            subject: subjectName,
            grade: String(grade),
            board: boardSlug,
            topicId,
            source: 'ai',
          } as any,
        });
        results.push({
          id: persisted.id,
          questionText,
          options,
          correctAnswer,
          topicId: topicId ?? '',
          difficulty,
        });
      } catch (persistErr) {
        // Skip individual persist errors -- include the question anyway with a temp ID
        logger.warn('DiagnosticQuestionService.onDemand.persistFailed', {
          error: String(persistErr),
          questionText: questionText.slice(0, 80),
        });
        results.push({
          id: `tmp-${Date.now()}-${i}`,
          questionText,
          options,
          correctAnswer,
          topicId: topicId ?? '',
          difficulty,
        });
      }
    }

    return results;
  }

