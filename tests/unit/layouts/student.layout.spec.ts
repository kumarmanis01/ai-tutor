import { jest } from '@jest/globals';

// Mocks for Next internals
jest.unstable_mockModule('next-auth/next', () => ({
  getServerSession: jest.fn(),
}));

jest.unstable_mockModule('next/navigation', () => ({
  redirect: jest.fn(),
}));

jest.unstable_mockModule('next/headers', () => ({
  headers: jest.fn(() => new Map()),
}));

describe('Student layout server-side session handling', () => {
  it('redirects to sign-in when there is no session', async () => {
    const { getServerSession } = await import('next-auth/next');
    const { redirect } = await import('next/navigation');

    // session absent
    (getServerSession as any).mockResolvedValue(null);

    // Import the layout after mocking to ensure mocks are used
    const mod = await import('../../../app/(student)/layout');
    // Call the default export (server component function)
    try {
      // layout is an async function that will call redirect('/'), which
      // we've mocked to throw to short-circuit. Call and ignore errors.
      await (mod.default as any)({ children: null });
    } catch (e) {
      // ignore
    }

    expect((redirect as any)).toHaveBeenCalledWith('/');
  });
});
