/**
 * FILE OBJECTIVE:
 * - Validate that /auth/signin permanently redirects to /auth/login.
 *   The old interactive sign-in UI was replaced with a redirect shim in Step 3
 *   of the auth route refactor.
 *
 * LINKED UNIT TEST:
 * - __tests__/app/public/auth/signin/page.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-11T00:00:00Z | copilot | add coverage for Google error banner retry-label and safe callbackUrl/parent-intent routing
 * - 2026-05-18T00:00:00Z | claude | replace interactive-page tests with redirect assertion
 */

const redirectMock = jest.fn()

jest.mock('next/navigation', () => ({
  redirect: (url: string) => {
    redirectMock(url)
    throw new Error('NEXT_REDIRECT')
  },
}))

describe('/auth/signin redirect', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should redirect to /auth/login', () => {
    const SigninRedirect = require('@/app/(public)/auth/signin/page').default

    expect(() => SigninRedirect()).toThrow('NEXT_REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/auth/login')
  })
})
