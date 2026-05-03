import { buildOnDemandQuizPrompt } from '@/lib/quiz/onDemandQuizPrompt';

const BASE_PARAMS = {
  topics: [{ name: 'The Cell', chapterName: 'Basic Unit of Life' }],
  subjectName: 'Science',
  board: 'CBSE',
  grade: 8,
  difficulty: 'easy' as const,
  language: 'en' as const,
  totalQuestions: 10,
  scopeLabel: 'single topic',
};

describe('buildOnDemandQuizPrompt', () => {
  it('should include board, grade, and subject', () => {
    const prompt = buildOnDemandQuizPrompt(BASE_PARAMS);
    expect(prompt).toContain('CBSE');
    expect(prompt).toContain('Grade 8');
    expect(prompt).toContain('Science');
  });

  it('should include the topic name', () => {
    const prompt = buildOnDemandQuizPrompt(BASE_PARAMS);
    expect(prompt).toContain('The Cell');
  });

  it('should specify total question count', () => {
    const prompt = buildOnDemandQuizPrompt(BASE_PARAMS);
    expect(prompt).toContain('10');
  });

  it('should include difficulty label', () => {
    const prompt = buildOnDemandQuizPrompt(BASE_PARAMS);
    expect(prompt).toContain('easy');
  });

  it('should include JSON format spec', () => {
    const prompt = buildOnDemandQuizPrompt(BASE_PARAMS);
    expect(prompt).toContain('"questions"');
    expect(prompt).toContain('"correctAnswer"');
  });

  it('should inject grammar section for Hindi subject', () => {
    const prompt = buildOnDemandQuizPrompt({
      ...BASE_PARAMS,
      subjectName: 'Hindi',
      totalQuestions: 10,
    });
    expect(prompt).toContain('GRAMMAR QUESTIONS');
    expect(prompt).toContain('grammarCategory');
  });

  it('should inject grammar section for English subject', () => {
    const prompt = buildOnDemandQuizPrompt({
      ...BASE_PARAMS,
      subjectName: 'English Language',
      totalQuestions: 10,
    });
    expect(prompt).toContain('GRAMMAR QUESTIONS');
    expect(prompt).toContain('Tenses');
  });

  it('should NOT inject grammar section for non-language subject', () => {
    const prompt = buildOnDemandQuizPrompt(BASE_PARAMS);
    expect(prompt).not.toContain('GRAMMAR QUESTIONS');
  });

  it('should list multiple topics for chapter scope', () => {
    const prompt = buildOnDemandQuizPrompt({
      ...BASE_PARAMS,
      topics: [
        { name: 'Topic A', chapterName: 'Chapter 1' },
        { name: 'Topic B', chapterName: 'Chapter 1' },
      ],
      scopeLabel: 'entire chapter (2 topics)',
    });
    expect(prompt).toContain('Topic A');
    expect(prompt).toContain('Topic B');
  });

  it('should say Hindi for language=hi', () => {
    const prompt = buildOnDemandQuizPrompt({ ...BASE_PARAMS, language: 'hi' });
    expect(prompt).toContain('Hindi');
  });

  it('should say English for language=en', () => {
    const prompt = buildOnDemandQuizPrompt({ ...BASE_PARAMS, language: 'en' });
    expect(prompt).toContain('English');
  });
});
