/**
 * FILE OBJECTIVE:
 * - Centralize reusable UI class recipes for themed form and modal-like onboarding surfaces.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/theme/componentClasses.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-07T00:00:00Z | copilot | add shared onboarding form/modal theme class tokens
 */

export const ONBOARDING_THEME_CLASSES = {
  pageBackground: 'min-h-screen bg-background text-foreground',
  pageAccent:
    'pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-brand-primary-bg via-brand-primary-bg/40 to-transparent',
  container: 'relative w-full max-w-lg mx-auto space-y-6',
  fieldLabel: 'block text-sm font-medium text-foreground',
  input:
    'w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20',
  primaryButton:
    'w-full min-h-[44px] rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-brand-primary/20 transition-all hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50',
  secondaryAction:
    'text-sm font-medium text-primary transition-colors hover:text-primary-hover disabled:opacity-50',
  segmentBase:
    'rounded-xl border-2 border-border bg-background text-sm font-medium text-muted-foreground shadow-sm transition-all hover:border-brand-primary/40 hover:bg-brand-primary-bg/40',
  segmentSelected:
    'border-primary bg-primary-bg text-primary shadow-[0_10px_30px_-18px_rgba(83,74,183,0.7)]',
  subjectDisabled: 'border-border bg-muted text-muted-foreground/60 cursor-not-allowed',
  inlineError: 'text-xs text-error',
  bannerError: 'rounded-xl border border-brand-danger/20 bg-error-bg px-4 py-3 text-sm text-error',
  bannerWarning: 'rounded-2xl border border-brand-warning/20 bg-warning-bg px-4 py-3',
  bannerSuccessIcon: 'flex h-16 w-16 items-center justify-center rounded-full bg-success-bg shadow-sm',
  phoneWrapper:
    'flex overflow-hidden rounded-xl border border-input bg-background shadow-sm transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-brand-primary/20',
  phonePrefix:
    'flex items-center border-r border-input bg-muted px-3 text-sm font-medium text-muted-foreground select-none whitespace-nowrap',
  phoneInput:
    'flex-1 bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none',
  otpInput:
    'w-full rounded-2xl border border-input bg-card px-4 py-3 text-center text-2xl tracking-[0.5em] text-foreground shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20',
  decorativeCard:
    'rounded-3xl border border-brand-primary/10 bg-gradient-to-br from-card via-card to-brand-primary-bg/30 p-1',
  sectionCard:
    'space-y-5 rounded-[24px] border border-brand-primary/20 bg-card p-5 shadow-[0_20px_60px_-40px_rgba(26,26,26,0.35)] backdrop-blur',
} as const

const componentClasses = {
  onboarding: ONBOARDING_THEME_CLASSES,
}

export default componentClasses