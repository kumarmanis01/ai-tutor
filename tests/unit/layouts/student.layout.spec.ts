/**
 * @jest-environment node
 */

// Mock all heavy deps before any imports
jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}));

const redirectMock = jest.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});

jest.mock('next/navigation', () => ({
  redirect: (...args: any[]) => redirectMock(...args),
}));

jest.mock('next/headers', () => ({
  headers: jest.fn(() => ({ get: jest.fn(() => null) })),
}));

jest.mock('@/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/lib/student/parentGate', () => ({
  checkParentGate: jest.fn().mockResolvedValue({ required: false, verified: false }),
}));
jest.mock('@/lib/student/accountStatus', () => ({
  requiresParentOTPGate: jest.fn().mockResolvedValue(false),
}));
jest.mock('@/components/student/StudentLayoutShell', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/student/layout/Topbar', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/ClientOnly/GoogleTagManagerClient', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/ClientOnly/AppModalClient', () => ({ __esModule: true, default: () => null }));
jest.mock('@/app/providers', () => ({ __esModule: true, default: ({ children }: any) => children }));
jest.mock('@/context/GlobalLoaderProvider', () => ({ GlobalLoaderProvider: ({ children }: any) => children }));
jest.mock('@/components/NavigationProgress', () => ({ NavigationProgress: () => null }));
jest.mock('@/components/AuthSessionLoader', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/ToastHost', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/pwa/InstallPrompt', () => ({ __esModule: true, default: () => null }));
jest.mock('@/app/fonts', () => ({ inter: { variable: '--font-inter' }, nunito: { variable: '--font-nunito' } }));
jest.mock('@/styles/index.css', () => ({}), { virtual: true });

import { getServerSession } from 'next-auth/next';
import StudentLayout from '../../../app/(student)/layout';

describe('Student layout server-side session handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    redirectMock.mockImplementation((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    });
  });

  it('redirects to sign-in when there is no session', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    await expect((StudentLayout as any)({ children: null })).rejects.toThrow('NEXT_REDIRECT:/');

    expect(redirectMock).toHaveBeenCalledWith('/');
  });

  it('redirects parent role to parent dashboard', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'u-parent', role: 'parent' },
    });

    await expect((StudentLayout as any)({ children: null })).rejects.toThrow('NEXT_REDIRECT:/parent/dashboard');

    expect(redirectMock).toHaveBeenCalledWith('/parent/dashboard');
  });
});
