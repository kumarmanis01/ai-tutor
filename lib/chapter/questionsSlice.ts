/**
 * FILE OBJECTIVE:
 * - Pipeline slices extracted from prompts/topic-questions.ts (topicQuestionsPrompt).
 *   Three Markdown-output functions for per-topic questions in chapter sessions:
 *   chapterQuizSlice (MCQ), chapterPracticeSlice (open-ended), chapterHomeworkSlice.
 *
 * SOURCE PIPELINE: prompts/topic-questions.ts (stemQuestionsPrompt / topicQuestionsPrompt)
 *
 * EDIT LOG:
 * - 2026-06-09T19:00:00Z | claude | created as dedicated slice from questions pipeline
 */

export interface QuestionsSliceCtx {
  chapterName: string;
  subject: string;
  grade: string;
  board: string;
  topicTitle: string;
  /** 1-5 difficulty scale from the UI slider */
  difficultyLevel: number;
  count: number;
}

// ─── Shared helpers (mirroring topicQuestionsPrompt internals) ────────────────

// Maps UI slider 1-5 → pipeline difficulty label (easy / medium / hard)
const DIFF_LABEL: Record<number, string> = {
  1: 'easy', 2: 'easy', 3: 'medium', 4: 'hard', 5: 'hard',
};

// Maps UI slider 1-5 → human description matching pipeline difficultyDescription
const DIFF_DESC: Record<number, string> = {
  1: 'very easy -- recall and recognition, single step, no tricks',
  2: 'easy -- direct application, straightforward',
  3: 'medium -- 2-3 steps, standard curriculum level',
  4: 'hard -- multi-step, higher-order thinking, exam-level challenge',
  5: 'hard -- complex reasoning, deep understanding required, hardest board questions',
};

function examBoard(board: string): string {
  return board.toUpperCase() === 'ICSE'
    ? 'ICSE structured answer format (show all working).'
    : 'NCERT + CBSE board style.';
}

// ─── Slice 1: MCQ Quiz (Quiz tab) ─────────────────────────────────────────────
// Adapted from stemQuestionsPrompt (MCQ path)

export function chapterQuizSlice(ctx: QuestionsSliceCtx): { system: string; user: string } {
  const diff = DIFF_LABEL[ctx.difficultyLevel] ?? 'medium';
  const desc = DIFF_DESC[ctx.difficultyLevel] ?? 'medium difficulty';

  return {
    system: `You are an expert ${ctx.board} exam question writer for Grade ${ctx.grade} ${ctx.subject}.
Generate multiple-choice questions for a single topic. Difficulty: ${diff} -- ${desc}.

FORMAT for each question:
**Q[n].** [Question text] [1 mark]
- (a) [Option A]
- (b) [Option B]
- (c) [Option C]
- (d) [Option D]

After all questions:
**Answer Key**
Q1: (x) -- [explanation, max 30 words]
...

Rules (from topicQuestionsPrompt pipeline):
- Use Indian context in examples.
- All ${ctx.count} questions MUST be ${diff} difficulty.
- Exactly 4 options per question.
- Distractors must reflect genuine common student errors (not random wrong answers).
- At least one distractor per question ties to the most common student mistake.
- ${examBoard(ctx.board)}`,
    user: `Generate ${ctx.count} MCQ questions for topic "${ctx.topicTitle}" in chapter "${ctx.chapterName}" (${ctx.board} Grade ${ctx.grade} ${ctx.subject}), at ${diff} difficulty.`,
  };
}

// ─── Slice 2: Open-ended practice (Exercises tab) ─────────────────────────────
// Adapted from stemQuestionsPrompt (short/long answer path)

export function chapterPracticeSlice(ctx: QuestionsSliceCtx): { system: string; user: string } {
  const diff = DIFF_LABEL[ctx.difficultyLevel] ?? 'medium';
  const desc = DIFF_DESC[ctx.difficultyLevel] ?? 'medium difficulty';

  return {
    system: `You are an expert ${ctx.board} exam question writer for Grade ${ctx.grade} ${ctx.subject}.
Generate open-ended practice exercises for a single topic. Difficulty: ${diff} -- ${desc}.

FORMAT:
[N]. [Question text] [marks allocation]
Step hint: [One-line hint without giving the answer]
Answer: [Full solution with steps]

Rules (from topicQuestionsPrompt pipeline):
- Use Indian context: Indian names (Riya, Arjun, Neha), cities, INR amounts, cricket scores.
- All ${ctx.count} exercises MUST be ${diff} difficulty.
- Include marks allocation: [2 marks] / [3 marks] / [5 marks].
- Last question: a slightly harder "Challenge" variant.
- Show full solution after each question.
- ${examBoard(ctx.board)}`,
    user: `Generate ${ctx.count} practice exercises for topic "${ctx.topicTitle}" in chapter "${ctx.chapterName}" (${ctx.board} Grade ${ctx.grade} ${ctx.subject}), at ${diff} difficulty.`,
  };
}

// ─── Slice 3: Homework (Homework tab) ─────────────────────────────────────────
// Adapted from topicQuestionsPrompt -- homework variant

export function chapterHomeworkSlice(ctx: QuestionsSliceCtx): { system: string; user: string } {
  const diff = DIFF_LABEL[ctx.difficultyLevel] ?? 'medium';
  const desc = DIFF_DESC[ctx.difficultyLevel] ?? 'medium difficulty';

  return {
    system: `You are a ${ctx.board} Grade ${ctx.grade} ${ctx.subject} teacher creating take-home homework.
Topic: "${ctx.topicTitle}". Difficulty: ${diff} -- ${desc}.

FORMAT:
[N]. [Problem text] [marks allocation]
[Hint: one-line hint without revealing the answer]

After all problems, add:
**Reflection Prompt**
[One open-ended question to think about -- no right/wrong answer, builds curiosity.]

Rules (from topicQuestionsPrompt pipeline):
- Real-world Indian context: daily life, local examples, INR amounts, Indian names.
- ${ctx.count} problems, all calibrated to ${diff} difficulty.
- Appropriate for home study without a teacher.
- Mix of question types: numerical, conceptual, application, at least one higher-order.
- ${examBoard(ctx.board)}`,
    user: `Create ${ctx.count} homework problems for topic "${ctx.topicTitle}" in chapter "${ctx.chapterName}" (${ctx.board} Grade ${ctx.grade} ${ctx.subject}), at ${diff} difficulty.`,
  };
}
