/**
 * Global mock for next/navigation so components that call useRouter /
 * usePathname / useSearchParams during render don't throw
 * "invariant expected app router to be mounted" in unit tests.
 *
 * Loaded in setupFilesAfterEach of both node and jsdom Jest projects.
 */

// Build the navigation mock as a stable factory so we can re-establish it
// before every test. Some specs call jest.resetAllMocks() in beforeEach which
// would otherwise wipe the implementation of our useRouter stub.

function buildNavigationMock() {
  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  };
  return {
    __esModule: true,
    useRouter: () => router,
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(),
    useParams: () => ({}),
    redirect: jest.fn(),
    notFound: jest.fn(),
  };
}

jest.mock('next/navigation', () => buildNavigationMock());

// Re-establish the mock after any spec that runs jest.resetAllMocks() in
// beforeEach -- otherwise useRouter would resolve to an empty jest.fn() and
// crash with "(0 , navigation_1.useRouter) is not a function".
beforeEach(() => {
  jest.doMock('next/navigation', () => buildNavigationMock());
});

export {};
