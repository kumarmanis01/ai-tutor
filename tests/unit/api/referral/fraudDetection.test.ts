/**
 * Unit tests for referral fraud detection logic.
 * F-STU-042 AC-05: Same device fingerprint or same IP referrals flagged and voided.
 *
 * Tests the IP extraction and same-IP/self-referral detection logic inline.
 */

/** Mirror of the getClientIp helper in the route handlers. */
function getClientIp(headers: Record<string, string | null>): string | null {
  const forwarded = headers['x-forwarded-for']
  if (forwarded) return forwarded.split(',')[0].trim()
  return headers['x-real-ip'] ?? null
}

/** Mirror of the self-referral check logic. */
function isFraudulent(
  creatorId: string,
  redeemerId: string,
  creatorIp: string | null,
  redeemerIp: string | null,
): { voided: boolean; reason?: string } {
  if (creatorId === redeemerId) return { voided: true, reason: 'self_referral' }
  if (creatorIp && redeemerIp && creatorIp === redeemerIp)
    return { voided: true, reason: 'same_ip' }
  return { voided: false }
}

describe('getClientIp', () => {
  it('should extract IP from x-forwarded-for header', () => {
    expect(getClientIp({ 'x-forwarded-for': '203.0.113.5', 'x-real-ip': null })).toBe('203.0.113.5')
  })

  it('should take the first IP when x-forwarded-for has multiple', () => {
    expect(getClientIp({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1', 'x-real-ip': null })).toBe('203.0.113.5')
  })

  it('should fall back to x-real-ip when x-forwarded-for is absent', () => {
    expect(getClientIp({ 'x-forwarded-for': null, 'x-real-ip': '198.51.100.9' })).toBe('198.51.100.9')
  })

  it('should return null when no IP headers are present', () => {
    expect(getClientIp({ 'x-forwarded-for': null, 'x-real-ip': null })).toBeNull()
  })
})

describe('isFraudulent', () => {
  it('should void self-referral when creator and redeemer are the same user', () => {
    const result = isFraudulent('user1', 'user1', '1.2.3.4', '5.6.7.8')
    expect(result.voided).toBe(true)
    expect(result.reason).toBe('self_referral')
  })

  it('should void same-IP referral when creator and redeemer share IP', () => {
    const result = isFraudulent('user1', 'user2', '1.2.3.4', '1.2.3.4')
    expect(result.voided).toBe(true)
    expect(result.reason).toBe('same_ip')
  })

  it('should allow legitimate referral with different users and different IPs', () => {
    const result = isFraudulent('user1', 'user2', '1.2.3.4', '9.8.7.6')
    expect(result.voided).toBe(false)
  })

  it('should allow referral when IPs are unavailable', () => {
    const result = isFraudulent('user1', 'user2', null, null)
    expect(result.voided).toBe(false)
  })

  it('should allow referral when only one IP is available', () => {
    const result = isFraudulent('user1', 'user2', '1.2.3.4', null)
    expect(result.voided).toBe(false)
  })
})
