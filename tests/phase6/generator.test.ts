import { generateSyllabus } from '@/lib/syllabus/generator';
import { validateSyllabusJson } from '@/lib/syllabus/schema';

describe('generateSyllabus', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns a valid CourseSyllabus for valid input', async () => {
    const res = await generateSyllabus({ title: 'Algebra Basics' });
    expect(res).toBeDefined();
    expect(res.title).toBe('Algebra Basics');
    expect(Array.isArray(res.modules)).toBe(true);
    expect(res.modules.length).toBeGreaterThan(0);
  });

  it('generated JSON passes Zod schema validation', async () => {
    const res = await generateSyllabus({ title: 'Geometry 101' });
    expect(() => validateSyllabusJson(res)).not.toThrow();
  });

  it('throws a readable validation error when LLM returns invalid JSON', async () => {
    const badLLM = jest.fn().mockResolvedValue({ foo: 'bar' });
    await expect(generateSyllabus({ title: 'Broken Syllabus' }, badLLM)).rejects.toThrow(/Syllabus schema validation failed/);
  });

  it('fails clearly when required fields are missing from LLM output', async () => {
    // return object missing `modules` and `title`
    const incompleteLLM = jest.fn().mockResolvedValue({ description: 'no title or modules' });
    await expect(generateSyllabus({ title: 'Incomplete' }, incompleteLLM)).rejects.toThrow();
  });
});
