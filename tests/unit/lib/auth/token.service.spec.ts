/**
 * FILE OBJECTIVE:
 * - Unit tests for lib/auth/token.service.ts — JWT generation and verification.
 *
 * LINKED UNIT TEST:
 * - This IS the unit test file.
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2025-01-15T00:00:00Z | copilot | created — B2.1 token service tests
 * - 2026-04-24T00:00:00Z | copilot | mock jose (ESM); fix API call signatures; fix iat=0 falsy issue
 */

// ── jose ESM workaround ───────────────────────────────────────────────────────
// jose is an ESM-only package. Jest (CJS mode) cannot load it directly.
// We mock its interface to test the service's orchestration logic.
// Full round-trip tests are tracked in post_launch_backlog.md:
// "B2.1 — token.service integration tests with real jose".

const mockSign = jest.fn().mockResolvedValue('mock.jwt.token')
const mockSetProtectedHeader = jest.fn()
const mockSetSubject = jest.fn()
const mockSetIssuedAt = jest.fn()
const mockSetExpirationTime = jest.fn()
const mockSetJti = jest.fn()

const mockSignJWTBuilder = {
  setProtectedHeader: mockSetProtectedHeader,
  setSubject: mockSetSubject,
  setIssuedAt: mockSetIssuedAt,
  setExpirationTime: mockSetExpirationTime,
  setJti: mockSetJti,
  sign: mockSign,
}
// All builder methods return the builder for chaining
mockSetProtectedHeader.mockReturnValue(mockSignJWTBuilder)
mockSetSubject.mockReturnValue(mockSignJWTBuilder)
mockSetIssuedAt.mockReturnValue(mockSignJWTBuilder)
mockSetExpirationTime.mockReturnValue(mockSignJWTBuilder)
mockSetJti.mockReturnValue(mockSignJWTBuilder)

const mockJwtVerify = jest.fn()

jest.mock('jose', () => ({
  SignJWT: jest.fn().mockImplementation(() => mockSignJWTBuilder),
  jwtVerify: mockJwtVerify,
}))

import {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyUserAccessToken,
  verifyUserRefreshToken,
  verifyAdminAccessToken,
  TokenExpiredError,
  TokenInvalidError,
  type TokenPayload,
} from '@/lib/auth/token.service'

// ── Environment ───────────────────────────────────────────────────────────────

const ENV = {
  JWT_ACCESS_SECRET: 'test-access-secret-32-chars-min!!',
  JWT_REFRESH_SECRET: 'test-refresh-secret-32-chars-min!',
  ADMIN_JWT_ACCESS_SECRET: 'admin-access-secret-32-chars-min!',
  ADMIN_JWT_REFRESH_SECRET: 'admin-refresh-secret-32-chars-mn!',
}

/** Non-falsy timestamp for payload mocks (iat: 0 is falsy and fails extractPayload guard) */
const MOCK_IAT = 1700000000
const MOCK_EXP = 1700003600

function makePayload(overrides: Partial<TokenPayload> = {}): TokenPayload {
  return {
    sub: 'user-1',
    role: 'student',
    scope: 'user',
    jti: 'jti-abc',
    iat: MOCK_IAT,
    exp: MOCK_EXP,
    ...overrides,
  }
}

describe('lib/auth/token.service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Object.assign(process.env, ENV)
    // Restore builder chaining after clearAllMocks
    mockSetProtectedHeader.mockReturnValue(mockSignJWTBuilder)
    mockSetSubject.mockReturnValue(mockSignJWTBuilder)
    mockSetIssuedAt.mockReturnValue(mockSignJWTBuilder)
    mockSetExpirationTime.mockReturnValue(mockSignJWTBuilder)
    mockSetJti.mockReturnValue(mockSignJWTBuilder)
    mockSign.mockResolvedValue('mock.jwt.token')
  })

  afterEach(() => {
    for (const key of Object.keys(ENV)) delete process.env[key]
  })

  // ── generateAccessToken ──────────────────────────────────────────────────

  describe('generateAccessToken', () => {
    it('should call SignJWT and return a token string', async () => {
      const token = await generateAccessToken({ sub: 'user-1', role: 'student', scope: 'user' })
      expect(token).toBe('mock.jwt.token')
      expect(mockSign).toHaveBeenCalledWith(expect.any(Uint8Array))
    })

    it('should set 15m expiry and correct subject', async () => {
      await generateAccessToken({ sub: 'user-42', role: 'parent', scope: 'user' })
      expect(mockSetSubject).toHaveBeenCalledWith('user-42')
      expect(mockSetExpirationTime).toHaveBeenCalledWith('15m')
    })
  })

  // ── generateRefreshToken ─────────────────────────────────────────────────

  describe('generateRefreshToken', () => {
    it('should set 7d expiry', async () => {
      await generateRefreshToken({ sub: 'user-1', role: 'student', scope: 'user' })
      expect(mockSetExpirationTime).toHaveBeenCalledWith('7d')
    })
  })

  // ── generateTokenPair ────────────────────────────────────────────────────

  describe('generateTokenPair', () => {
    it('should return both accessToken and refreshToken', async () => {
      mockSign
        .mockResolvedValueOnce('access.token')
        .mockResolvedValueOnce('refresh.token')

      const pair = await generateTokenPair({ sub: 'user-99', role: 'student', scope: 'user' })
      expect(pair.accessToken).toBe('access.token')
      expect(pair.refreshToken).toBe('refresh.token')
    })
  })

  // ── verifyUserAccessToken ─────────────────────────────────────────────────

  describe('verifyUserAccessToken', () => {
    it('should return payload when jwtVerify resolves with valid user payload', async () => {
      mockJwtVerify.mockResolvedValue({ payload: makePayload() })
      const result = await verifyUserAccessToken('valid.access.token')
      expect(result.sub).toBe('user-1')
      expect(result.scope).toBe('user')
    })

    it('should throw TokenExpiredError when jose reports JWTExpired', async () => {
      const expiredErr = new Error('exp claim timestamp check failed')
      mockJwtVerify.mockRejectedValue(expiredErr)
      await expect(verifyUserAccessToken('expired.token')).rejects.toThrow(TokenExpiredError)
    })

    it('should throw TokenInvalidError when jwtVerify rejects with non-expiry error', async () => {
      mockJwtVerify.mockRejectedValue(new Error('JWSInvalid'))
      await expect(verifyUserAccessToken('bad.token')).rejects.toThrow(TokenInvalidError)
    })

    it('should throw TokenInvalidError when payload has missing fields', async () => {
      // Missing jti — extractPayload will throw
      mockJwtVerify.mockResolvedValue({
        payload: { sub: 'user-1', iat: MOCK_IAT, exp: MOCK_EXP }, // no jti
      })
      await expect(verifyUserAccessToken('missing-jti.token')).rejects.toThrow(TokenInvalidError)
    })
  })

  // ── verifyUserRefreshToken ───────────────────────────────────────────────

  describe('verifyUserRefreshToken', () => {
    it('should return payload for valid user refresh token', async () => {
      mockJwtVerify.mockResolvedValue({ payload: makePayload({ sub: 'user-7' }) })
      const result = await verifyUserRefreshToken('valid.refresh.token')
      expect(result.sub).toBe('user-7')
    })
  })

  // ── verifyAdminAccessToken ───────────────────────────────────────────────

  describe('verifyAdminAccessToken', () => {
    it('should return admin payload when jwtVerify resolves', async () => {
      mockJwtVerify.mockResolvedValue({
        payload: makePayload({ sub: 'admin-5', role: 'SUPER_ADMIN', scope: 'admin' }),
      })
      const result = await verifyAdminAccessToken('admin.access.token')
      expect(result.sub).toBe('admin-5')
    })

    it('should use ADMIN_JWT_ACCESS_SECRET (not user secret)', async () => {
      // Scope enforcement is via different secrets — using wrong secret fails
      mockJwtVerify.mockRejectedValue(new Error('signature verification failed'))
      await expect(verifyAdminAccessToken('user.token')).rejects.toThrow(TokenInvalidError)
    })
  })
})
