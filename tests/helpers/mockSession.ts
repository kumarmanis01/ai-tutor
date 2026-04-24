/**
 * Mock session helper for unit tests.
 * Provides a mock NextAuth session for testing admin endpoints.
 */
import { jest } from '@jest/globals';

export const mockSession = {
  user: {
    id: 'test-user-id',
    email: 'admin@test.com',
    name: 'Test Admin',
    role: 'admin' as string,
  },
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

// Auto-mock next-auth so getServerSession returns our mock
jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue(mockSession),
}));
// Also mock next-auth/next which is used by server route imports
jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn().mockImplementation(() => {
    const v = (global as any).__TEST_SESSION__;
    if (typeof v !== 'undefined') return Promise.resolve(v);
    return Promise.resolve(mockSession);
  }),
}));
