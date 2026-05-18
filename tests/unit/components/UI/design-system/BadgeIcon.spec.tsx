import React from 'react'
import { render } from '@testing-library/react'
import BadgeIcon, { BADGE_ACCENT } from '@/components/UI/design-system/BadgeIcon'

describe('BadgeIcon', () => {
  it('renders an SVG glyph for a known badge id with correct accent (case-insensitive)', () => {
    const { container } = render(<BadgeIcon badgeId="streak_7" />)
    const span = container.querySelector('span')
    expect(span).toBeTruthy()
    // streak_7 mapped to amber accent
    expect(span!.className).toContain('bg-amber-bg')
    expect(span!.className).toContain('text-amber-text')
    // contains an svg element
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('is case-insensitive when looking up badge ids', () => {
    const { container } = render(<BadgeIcon badgeId="StReAk_7" />)
    const span = container.querySelector('span')
    expect(span).toBeTruthy()
    expect(span!.className).toContain('bg-amber-bg')
  })

  it('falls back to medal glyph for unknown id', () => {
    const { container } = render(<BadgeIcon badgeId="this_does_not_exist" />)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    // medal glyph contains a circle element for the head
    expect(svg!.innerHTML).toContain('<circle')
  })

  it('applies showcased ring classes when showcased=true', () => {
    const { container } = render(<BadgeIcon badgeId="mock_complete" showcased={true} />)
    const span = container.querySelector('span')
    expect(span).toBeTruthy()
    expect(span!.className).toContain('ring-2')
    expect(span!.className).toContain('ring-offset-card')
  })

  it('accepts explicit accent prop overriding default', () => {
    const { container } = render(<BadgeIcon badgeId="mock_complete" accent={'primary'} />)
    const span = container.querySelector('span')
    expect(span).toBeTruthy()
    expect(span!.className).toContain('bg-primary-bg')
    expect(span!.className).toContain('text-primary-text')
  })
})
