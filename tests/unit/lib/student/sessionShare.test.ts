import { buildWhatsAppShareUrl } from '@/lib/student/sessionShare'

describe('buildWhatsAppShareUrl', () => {
  test('returns wa.me url with encoded text', () => {
    const text = 'Hello world! 80% mastery'
    const url = buildWhatsAppShareUrl(text)
    expect(url.startsWith('https://wa.me/?text=')).toBe(true)
    const encoded = url.split('?text=')[1]
    expect(decodeURIComponent(encoded)).toBe(text)
  })

  test('encodes newlines and special characters', () => {
    const text = 'Line1\nLine2 & symbols #?'
    const url = buildWhatsAppShareUrl(text)
    expect(url).toContain('%0A')
    expect(url).toContain('%26')
  })
})
