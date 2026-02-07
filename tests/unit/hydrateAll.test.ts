jest.mock('@/hydrators/hydrateSyllabus', () => ({
  enqueueSyllabusHydration: jest.fn().mockResolvedValue({ created: true })
}));
jest.mock('@/hydrators/hydrateNotes', () => ({ hydrateNotes: jest.fn().mockResolvedValue({ created: true }) }));
jest.mock('@/hydrators/hydrateQuestions', () => ({ hydrateQuestions: jest.fn().mockResolvedValue({ created: true }) }));

const mockedPrisma = {
  subjectDef: { findMany: jest.fn() },
  topicDef: { findMany: jest.fn() }
};

jest.mock('@/lib/prisma', () => ({ prisma: mockedPrisma }));

// import after mocks so imports of hydrateAll pick up mocked prisma
import runHydrateAll from '@/scripts/hydrateAll'

describe('runHydrateAll', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('enqueues syllabus for each subject and hydrates topics', async () => {
    const subjects = [ { id: 's1', name: 'Math', class: { grade: 5, board: { name: 'CBSE' } } } ];
    const topics = [ { id: 't1' }, { id: 't2' } ];

    mockedPrisma.subjectDef.findMany.mockResolvedValue(subjects);
    mockedPrisma.topicDef.findMany.mockResolvedValue(topics);

    const syllabusMod = await import('@/hydrators/hydrateSyllabus');
    const notesMod = await import('@/hydrators/hydrateNotes');
    const qMod = await import('@/hydrators/hydrateQuestions');

    await runHydrateAll({});

    expect(syllabusMod.enqueueSyllabusHydration).toHaveBeenCalledTimes(subjects.length);
    // hydrateNotes called twice per topic (en + hi)
    expect(notesMod.hydrateNotes).toHaveBeenCalledTimes(topics.length * 2);
    // hydrateQuestions called 6 times per topic (3 diffs x 2 langs)
    expect(qMod.hydrateQuestions).toHaveBeenCalledTimes(topics.length * 6);
  });
});
