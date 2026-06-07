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

// The factory is called once per test file (the jest.mock is hoisted to the
// top of the file when ts-jest compiles it). Specs that need to override the
// mock (e.g. give redirect() a throwing implementation) can re-mock locally
// with their own jest.mock('next/navigation', ...) -- this default only fills
// the gap for components that incidentally call useRouter / usePathname /
// useSearchParams during SSR or first render.
jest.mock('next/navigation', () => buildNavigationMock());

export {};
