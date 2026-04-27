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
