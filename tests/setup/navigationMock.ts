/**
 * FILE OBJECTIVE:
 * - Global jest mock for next/navigation so components calling useRouter /
 *   usePathname / useSearchParams during render do not throw under jsdom/node
 *   test environments. Loaded by both jest projects via setupFilesAfterEach.
 *
 * LINKED UNIT TEST:
 * - (test-infra; covered indirectly by every component spec.)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-06-07T00:00:00Z | claude | initial creation with standard header.
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
