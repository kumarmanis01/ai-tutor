/**
 * FILE OBJECTIVE:
 * - Validate shared onboarding theme class tokens exposed from lib/theme/componentClasses.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/theme/componentClasses.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-07T00:00:00Z | copilot | add tests for centralized onboarding class recipes
 */

import componentClasses, { ONBOARDING_THEME_CLASSES } from '@/lib/theme/componentClasses'

describe('theme component classes', () => {
  it('exposes onboarding class recipes through named and default exports', () => {
    expect(componentClasses.onboarding).toBe(ONBOARDING_THEME_CLASSES)
    expect(ONBOARDING_THEME_CLASSES.pageBackground).toContain('bg-background')
    expect(ONBOARDING_THEME_CLASSES.primaryButton).toContain('bg-primary')
    expect(ONBOARDING_THEME_CLASSES.decorativeCard).toContain('border-brand-primary/10')
  })

  it('uses brand colors for opacity variants in shared recipes', () => {
    expect(ONBOARDING_THEME_CLASSES.input).toContain('focus:ring-brand-primary/20')
    expect(ONBOARDING_THEME_CLASSES.bannerWarning).toContain('border-brand-warning/20')
    expect(ONBOARDING_THEME_CLASSES.sectionCard).toContain('border-brand-primary/20')
  })
})