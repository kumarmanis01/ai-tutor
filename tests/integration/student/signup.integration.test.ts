/**
 * Integration test: POST /api/auth/signup
 * - Verifies user creation via `prisma.user.create`
 * - Verifies `welcomeEmailSent` flag is updated via follow-up update
 */

// Mocks must be registered before importing the route module
const prismaMock: any = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    logAPI: jest.fn(),
  },
}));
jest.mock('@/lib/mailer', () => ({ sendMailSafe: jest.fn().mockResolvedValue(undefined) }));

// Import the route handler after mocks
const route = require('../../../app/api/auth/signup/route');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/auth/signup', () => {
  it('creates a user and sets welcomeEmailSent flag', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null); // no existing user
    const createdUser = { id: 'user-1', email: 'test@example.com', name: 'Test' };
    prismaMock.user.create.mockResolvedValueOnce(createdUser);
    prismaMock.user.update.mockResolvedValueOnce({ ...createdUser, welcomeEmailSent: true });

    const req = {
      json: async () => ({ name: 'Test', email: 'test@example.com', password: 'password123' }),
    };

    const res = await route.POST(req);

    // Ensure DB create was called with expected email
    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: 'test@example.com' }) })
    );

    // Wait a tick for the sendMailSafe().then(...) chain to execute
    await new Promise((r) => setImmediate(r));

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { welcomeEmailSent: true },
    });
  });
});
