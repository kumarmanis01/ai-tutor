import { GET, PUT, DELETE } from '../../app/api/admin/regeneration-jobs/route';
import { requireAdminOrModerator } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/auth', () => ({
  requireAdminOrModerator: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    regenerationJob: {
      findMany: jest.fn(),
    },
  },
}));

const mockedRequireAdmin = requireAdminOrModerator as jest.MockedFunction<any>;
const mockedFindMany = (prisma as any).regenerationJob.findMany as jest.MockedFunction<any>;

beforeEach(() => {
  jest.clearAllMocks();
});

test('non-admin access is rejected', async () => {
  mockedRequireAdmin.mockImplementationOnce(() => { throw new Error('Unauthorized'); });

  const res = await GET({} as Request);
  expect(res.status).toBe(403);
  const body = JSON.parse(await res.text());
  expect(body).toEqual({ error: 'forbidden' });
  expect(mockedFindMany).not.toHaveBeenCalled();
});

test('unsupported methods return 405', async () => {
  const put = await PUT();
  expect(put.status).toBe(405);

  const del = await DELETE();
  expect(del.status).toBe(405);
});

test('returns job metadata sorted by createdAt DESC', async () => {
  mockedRequireAdmin.mockResolvedValue(undefined);

  const row1 = {
    id: 'j1',
    status: 'PENDING',
    targetType: 'LESSON',
    targetId: 't1',
    createdAt: new Date('2025-01-01').toISOString(),
    createdBy: 'admin1',
  };
  const row2 = {
    id: 'j2',
    status: 'RUNNING',
    targetType: 'QUIZ',
    targetId: 't2',
    createdAt: new Date('2025-02-01').toISOString(),
    createdBy: 'admin2',
  };

  // DB returns sorted DESC as enforced by query
  mockedFindMany.mockResolvedValue([row2, row1]);

  const res = await GET({} as Request);
  expect(mockedFindMany).toHaveBeenCalledWith(expect.objectContaining({
    select: expect.any(Object),
    orderBy: { createdAt: 'desc' },
  }));

  expect(res.status).toBe(200);
  const body = JSON.parse(await res.text());
  expect(Array.isArray(body.jobs)).toBe(true);
  expect(body.jobs.length).toBe(2);
  expect(body.jobs[0].id).toBe('j2');
  expect(body.jobs[1].id).toBe('j1');

  // verify minimal fields only
  expect(body.jobs[0]).toEqual({
    id: 'j2',
    status: 'RUNNING',
    targetType: 'QUIZ',
    targetId: 't2',
    createdAt: row2.createdAt,
    createdBy: 'admin2',
  });
});
