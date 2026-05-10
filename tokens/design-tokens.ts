/**
 * =============================================================================
 * VIDYA LEARNING PLATFORM — DESIGN TOKEN SPECIFICATION
 * =============================================================================
 *
 * SOURCE OF TRUTH for all colours, typography, spacing, radii, shadows,
 * motion, and component-level tokens used in the Student Dashboard.
 *
 * RULES FOR CLAUDE CODE:
 *  1. NEVER hardcode a hex value, font size, or spacing value anywhere in
 *     component code. Always reference a token from this file.
 *  2. NEVER add a new colour without adding it here first.
 *  3. All Tailwind classes that encode colour, spacing, radius, or shadow
 *     must map 1-to-1 to a token below. Use the CSS custom properties via
 *     the `tw()` helpers or className strings listed in COMPONENT_TOKENS.
 *  4. Dark mode: every semantic token has a light and dark value. Use the
 *     CSS variable form (var(--color-*)) in inline styles; use the Tailwind
 *     dark: variant for utility classes.
 *  5. This file is imported by tailwind.config.ts to extend the theme.
 * =============================================================================
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. PRIMITIVE PALETTE  (raw colour ramps — not used directly in components)
// ─────────────────────────────────────────────────────────────────────────────

export const primitives = {

  // Brand purple — primary action, active states, XP bar, subject: Mathematics
  purple: {
    50:  '#EEEDFE',  // lightest fill  — hover bg, selected row bg
    100: '#CECBF6',  // light fill     — progress track (passive)
    200: '#AFA9EC',  // mid-light      — border on purple cards
    400: '#7F77DD',  // mid            — icon tint
    600: '#534AB7',  // PRIMARY        — buttons, active highlights, XP fill
    800: '#3C3489',  // dark           — text on purple-50 bg
    900: '#26215C',  // darkest        — heading text in dark mode
  },

  // Subject: Physics
  blue: {
    50:  '#E6F1FB',
    100: '#B5D4F4',
    200: '#85B7EB',
    400: '#378ADD',
    600: '#185FA5',  // PRIMARY
    800: '#0C447C',
    900: '#042C53',
  },

  // Subject: Chemistry  |  Amber semantic = "Weak"
  amber: {
    50:  '#FAEEDA',
    100: '#FAC775',
    200: '#EF9F27',
    400: '#BA7517',
    600: '#854F0B',  // PRIMARY
    800: '#633806',
    900: '#412402',
  },

  // Semantic: success / "On track" / "Good" / "Strong"  |  Subject: Biology
  green: {
    50:  '#EAF3DE',
    100: '#C0DD97',
    200: '#97C459',
    400: '#639922',
    600: '#3B6D11',  // PRIMARY
    800: '#27500A',
    900: '#173404',
  },

  // Semantic: danger / "Critical"  |  DO NOT use as a subject colour
  red: {
    50:  '#FCEBEB',
    100: '#F7C1C1',
    200: '#F09595',
    400: '#E24B4A',
    600: '#A32D2D',  // PRIMARY
    800: '#791F1F',
    900: '#501313',
  },

  // Semantic: warning (softer than red)  — same ramp as amber above
  // Use amber.600 for warning primary.

  // Neutral / structural — backgrounds, borders, muted text
  gray: {
    50:  '#F1EFE8',  // page background (light mode)
    100: '#D3D1C7',  // subtle dividers
    200: '#B4B2A9',  // disabled text
    400: '#888780',  // placeholder text
    600: '#5F5E5A',  // secondary body text
    800: '#444441',  // primary body text
    900: '#2C2C2A',  // headings (light mode)
  },

  // Pure values
  white: '#FFFFFF',
  black: '#000000',
} as const;


// ─────────────────────────────────────────────────────────────────────────────
// 2. SEMANTIC COLOUR TOKENS
//    Maps intent → primitive. These are what components MUST use.
//    Format: { light: string, dark: string }
// ─────────────────────────────────────────────────────────────────────────────

export const semanticColors = {

  // ── Backgrounds ──────────────────────────────────────────────────────────
  bg: {
    page:          { light: primitives.gray[50],   dark: '#1A1918' },  // outermost page
    surface:       { light: primitives.white,       dark: '#26241F' },  // cards, panels
    surfaceRaised: { light: primitives.white,       dark: '#2E2C27' },  // elevated cards
    subtle:        { light: primitives.gray[50],    dark: '#201F1B' },  // zebra rows, code bg
    overlay:       { light: 'rgba(0,0,0,0.40)',    dark: 'rgba(0,0,0,0.60)' },
  },

  // ── Text ─────────────────────────────────────────────────────────────────
  text: {
    primary:   { light: primitives.gray[900],  dark: '#E8E6DF' },
    secondary: { light: primitives.gray[600],  dark: '#A8A69F' },
    tertiary:  { light: primitives.gray[400],  dark: '#6E6C67' },
    disabled:  { light: primitives.gray[200],  dark: '#4A4844' },
    onBrand:   { light: primitives.white,      dark: primitives.white },  // text on purple-600 bg
    link:      { light: primitives.purple[600],dark: primitives.purple[400] },
  },

  // ── Borders ──────────────────────────────────────────────────────────────
  border: {
    subtle:    { light: primitives.gray[100],  dark: '#3A3830' },  // 0.5px lines
    default:   { light: primitives.gray[200],  dark: '#4A4840' },  // 1px standard
    strong:    { light: primitives.gray[400],  dark: '#6E6C60' },  // emphasis
    brand:     { light: primitives.purple[600],dark: primitives.purple[400] },
  },

  // ── Brand / Primary action ────────────────────────────────────────────────
  brand: {
    bg:        { light: primitives.purple[600], dark: primitives.purple[600] },
    bgHover:   { light: primitives.purple[800], dark: primitives.purple[400] },
    bgSubtle:  { light: primitives.purple[50],  dark: primitives.purple[900] },
    border:    { light: primitives.purple[200], dark: primitives.purple[800] },
    text:      { light: primitives.purple[800], dark: primitives.purple[200] },
    textStrong:{ light: primitives.purple[600], dark: primitives.purple[400] },
  },

  // ── Status: Critical (red) ────────────────────────────────────────────────
  critical: {
    bg:       { light: primitives.red[50],  dark: '#3D1515' },
    border:   { light: primitives.red[200], dark: primitives.red[800] },
    text:     { light: primitives.red[600], dark: primitives.red[200] },
    textStrong:{ light: primitives.red[600],dark: primitives.red[100] },
    fill:     { light: primitives.red[400], dark: primitives.red[400] },  // progress bars
  },

  // ── Status: Weak (amber) ─────────────────────────────────────────────────
  weak: {
    bg:       { light: primitives.amber[50],  dark: '#3A2005' },
    border:   { light: primitives.amber[200], dark: primitives.amber[800] },
    text:     { light: primitives.amber[800], dark: primitives.amber[200] },
    textStrong:{ light: primitives.amber[800],dark: primitives.amber[100] },
    fill:     { light: primitives.amber[200], dark: primitives.amber[400] },
  },

  // ── Status: On track / Good / Strong (green) ─────────────────────────────
  success: {
    bg:       { light: primitives.green[50],  dark: '#0D2208' },
    border:   { light: primitives.green[200], dark: primitives.green[800] },
    text:     { light: primitives.green[800], dark: primitives.green[100] },
    textStrong:{ light: primitives.green[600],dark: primitives.green[200] },
    fill:     { light: primitives.green[400], dark: primitives.green[400] },
  },

  // ── Subject identity colours ──────────────────────────────────────────────
  // Used for: subject dot, chip bg, progress bar fill, card accent border
  subject: {
    mathematics: {
      dot:    primitives.purple[600],
      chipBg: primitives.purple[50],
      chipBorder: primitives.purple[200],
      chipText:   primitives.purple[800],
      progressFill: primitives.purple[600],
      cardAccent: primitives.purple[200],
    },
    physics: {
      dot:    primitives.blue[600],
      chipBg: primitives.blue[50],
      chipBorder: primitives.blue[200],
      chipText:   primitives.blue[800],
      progressFill: primitives.blue[600],
      cardAccent: primitives.blue[200],
    },
    chemistry: {
      dot:    primitives.amber[400],   // amber-400 for chemistry (not the "weak" amber-600)
      chipBg: primitives.amber[50],
      chipBorder: primitives.amber[200],
      chipText:   primitives.amber[800],
      progressFill: primitives.amber[400],
      cardAccent: primitives.amber[200],
    },
    biology: {
      dot:    primitives.green[600],
      chipBg: primitives.green[50],
      chipBorder: primitives.green[200],
      chipText:   primitives.green[800],
      progressFill: primitives.green[600],
      cardAccent: primitives.green[200],
    },
    // Fallback for a 5th+ subject — cycle back using this palette
    fallback: [
      { dot: '#D4537E', chipBg: '#FBEAF0', chipBorder: '#ED93B1', chipText: '#72243E', progressFill: '#D4537E', cardAccent: '#ED93B1' }, // pink
      { dot: '#1D9E75', chipBg: '#E1F5EE', chipBorder: '#5DCAA5', chipText: '#085041', progressFill: '#1D9E75', cardAccent: '#5DCAA5' }, // teal
    ],
  },
} as const;


// ─────────────────────────────────────────────────────────────────────────────
// 3. CSS CUSTOM PROPERTY MAP
//    Injected into :root and .dark in globals.css
//    Every token above maps to a CSS variable consumed by Tailwind + components
// ─────────────────────────────────────────────────────────────────────────────

export const cssVariables = {
  light: {
    '--color-bg-page':          semanticColors.bg.page.light,
    '--color-bg-surface':       semanticColors.bg.surface.light,
    '--color-bg-surface-raised':semanticColors.bg.surfaceRaised.light,
    '--color-bg-subtle':        semanticColors.bg.subtle.light,

    '--color-text-primary':     semanticColors.text.primary.light,
    '--color-text-secondary':   semanticColors.text.secondary.light,
    '--color-text-tertiary':    semanticColors.text.tertiary.light,
    '--color-text-disabled':    semanticColors.text.disabled.light,
    '--color-text-on-brand':    semanticColors.text.onBrand.light,
    '--color-text-link':        semanticColors.text.link.light,

    '--color-border-subtle':    semanticColors.border.subtle.light,
    '--color-border-default':   semanticColors.border.default.light,
    '--color-border-strong':    semanticColors.border.strong.light,
    '--color-border-brand':     semanticColors.border.brand.light,

    '--color-brand-bg':         semanticColors.brand.bg.light,
    '--color-brand-bg-hover':   semanticColors.brand.bgHover.light,
    '--color-brand-bg-subtle':  semanticColors.brand.bgSubtle.light,
    '--color-brand-border':     semanticColors.brand.border.light,
    '--color-brand-text':       semanticColors.brand.text.light,

    '--color-critical-bg':      semanticColors.critical.bg.light,
    '--color-critical-border':  semanticColors.critical.border.light,
    '--color-critical-text':    semanticColors.critical.text.light,
    '--color-critical-fill':    semanticColors.critical.fill.light,

    '--color-weak-bg':          semanticColors.weak.bg.light,
    '--color-weak-border':      semanticColors.weak.border.light,
    '--color-weak-text':        semanticColors.weak.text.light,
    '--color-weak-fill':        semanticColors.weak.fill.light,

    '--color-success-bg':       semanticColors.success.bg.light,
    '--color-success-border':   semanticColors.success.border.light,
    '--color-success-text':     semanticColors.success.text.light,
    '--color-success-fill':     semanticColors.success.fill.light,
  },
  dark: {
    '--color-bg-page':          semanticColors.bg.page.dark,
    '--color-bg-surface':       semanticColors.bg.surface.dark,
    '--color-bg-surface-raised':semanticColors.bg.surfaceRaised.dark,
    '--color-bg-subtle':        semanticColors.bg.subtle.dark,

    '--color-text-primary':     semanticColors.text.primary.dark,
    '--color-text-secondary':   semanticColors.text.secondary.dark,
    '--color-text-tertiary':    semanticColors.text.tertiary.dark,
    '--color-text-disabled':    semanticColors.text.disabled.dark,
    '--color-text-on-brand':    semanticColors.text.onBrand.dark,
    '--color-text-link':        semanticColors.text.link.dark,

    '--color-border-subtle':    semanticColors.border.subtle.dark,
    '--color-border-default':   semanticColors.border.default.dark,
    '--color-border-strong':    semanticColors.border.strong.dark,
    '--color-border-brand':     semanticColors.border.brand.dark,

    '--color-brand-bg':         semanticColors.brand.bg.dark,
    '--color-brand-bg-hover':   semanticColors.brand.bgHover.dark,
    '--color-brand-bg-subtle':  semanticColors.brand.bgSubtle.dark,
    '--color-brand-border':     semanticColors.brand.border.dark,
    '--color-brand-text':       semanticColors.brand.text.dark,

    '--color-critical-bg':      semanticColors.critical.bg.dark,
    '--color-critical-border':  semanticColors.critical.border.dark,
    '--color-critical-text':    semanticColors.critical.text.dark,
    '--color-critical-fill':    semanticColors.critical.fill.dark,

    '--color-weak-bg':          semanticColors.weak.bg.dark,
    '--color-weak-border':      semanticColors.weak.border.dark,
    '--color-weak-text':        semanticColors.weak.text.dark,
    '--color-weak-fill':        semanticColors.weak.fill.dark,

    '--color-success-bg':       semanticColors.success.bg.dark,
    '--color-success-border':   semanticColors.success.border.dark,
    '--color-success-text':     semanticColors.success.text.dark,
    '--color-success-fill':     semanticColors.success.fill.dark,
  },
} as const;


// ─────────────────────────────────────────────────────────────────────────────
// 4. TYPOGRAPHY SCALE
// ─────────────────────────────────────────────────────────────────────────────

export const typography = {
  fontFamily: {
    sans:  ['Inter', 'system-ui', 'sans-serif'],       // body, UI labels
    mono:  ['JetBrains Mono', 'Consolas', 'monospace'],// code, scores
  },
  fontSize: {
    '2xs': ['10px', { lineHeight: '14px', letterSpacing: '0.04em' }],
    xs:    ['11px', { lineHeight: '16px', letterSpacing: '0.02em' }],
    sm:    ['12px', { lineHeight: '18px' }],
    base:  ['13px', { lineHeight: '20px' }],
    md:    ['14px', { lineHeight: '22px' }],
    lg:    ['15px', { lineHeight: '24px' }],
    xl:    ['16px', { lineHeight: '26px' }],
    '2xl': ['18px', { lineHeight: '28px' }],
    '3xl': ['20px', { lineHeight: '30px' }],
    '4xl': ['24px', { lineHeight: '34px' }],
    '5xl': ['28px', { lineHeight: '38px' }],
  },
  fontWeight: {
    regular: '400',
    medium:  '500',  // primary weight for UI labels
    semibold:'600',  // headings only
  },
} as const;


// ─────────────────────────────────────────────────────────────────────────────
// 5. SPACING SCALE (used for padding, margin, gap)
//    Base unit = 4px. Use multiples: 1=4, 2=8, 3=12, 4=16, 5=20, 6=24…
// ─────────────────────────────────────────────────────────────────────────────

export const spacing = {
  0:   '0px',
  0.5: '2px',
  1:   '4px',
  1.5: '6px',
  2:   '8px',
  2.5: '10px',
  3:   '12px',
  3.5: '14px',
  4:   '16px',
  5:   '20px',
  6:   '24px',
  7:   '28px',
  8:   '32px',
  10:  '40px',
  12:  '48px',
  16:  '64px',
} as const;


// ─────────────────────────────────────────────────────────────────────────────
// 6. BORDER RADIUS
// ─────────────────────────────────────────────────────────────────────────────

export const borderRadius = {
  none:  '0px',
  sm:    '4px',   // chips, badges, small elements
  md:    '6px',   // inputs, buttons
  lg:    '8px',   // inner cards, topic rows
  xl:    '10px',  // subject cards, panels
  '2xl': '12px',  // main dashboard cards
  full:  '9999px',// avatars, day dots, round buttons
} as const;


// ─────────────────────────────────────────────────────────────────────────────
// 7. BORDER WIDTH
// ─────────────────────────────────────────────────────────────────────────────

export const borderWidth = {
  hairline: '0.5px',  // default card border
  thin:     '1px',    // standard
  medium:   '1.5px',  // active/selected state
  thick:    '2px',    // featured card accent (P0 only)
} as const;


// ─────────────────────────────────────────────────────────────────────────────
// 8. ELEVATION / SHADOW
//    Flat design — shadows encode elevation level only.
//    NO decorative shadows, glow, or colour shadows.
// ─────────────────────────────────────────────────────────────────────────────

export const shadow = {
  none:  'none',
  sm:    '0 1px 2px rgba(0,0,0,0.06)',  // card resting state
  md:    '0 2px 6px rgba(0,0,0,0.08)',  // card hover
  focus: '0 0 0 3px rgba(83,74,183,0.35)',  // keyboard focus ring (brand purple)
} as const;


// ─────────────────────────────────────────────────────────────────────────────
// 9. MOTION / TRANSITION
// ─────────────────────────────────────────────────────────────────────────────

export const motion = {
  duration: {
    instant:  '0ms',
    fast:     '100ms',
    base:     '150ms',  // default: hover/focus colour changes
    moderate: '200ms',  // card entrance, expand/collapse
    slow:     '300ms',  // page-level transitions
    xslow:    '500ms',  // skeleton fade-in
  },
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',   // most UI transitions
    decelerate:'cubic-bezier(0, 0, 0.2, 1)',  // elements entering the screen
    accelerate:'cubic-bezier(0.4, 0, 1, 1)',  // elements leaving
    spring:   'cubic-bezier(0.34, 1.56, 0.64, 1)', // progress bar fill
  },
} as const;


// ─────────────────────────────────────────────────────────────────────────────
// 10. COMPONENT-LEVEL TOKENS
//     Pre-composed className strings and style objects for each dashboard
//     component. Claude Code MUST use these — do NOT compose ad-hoc.
// ─────────────────────────────────────────────────────────────────────────────

export const COMPONENT_TOKENS = {

  // ── Dashboard layout ─────────────────────────────────────────────────────
  layout: {
    page:         'min-h-screen bg-[--color-bg-page] p-3',
    grid:         'grid grid-cols-3 gap-2.5',            // 3-col; responsive overrides in component
    gridTablet:   'grid grid-cols-2 gap-2.5',            // 768–1023px
    gridMobile:   'grid grid-cols-1 gap-2.5',            // <768px
  },

  // ── Card ─────────────────────────────────────────────────────────────────
  card: {
    base:  'bg-[--color-bg-surface] border border-[--color-border-subtle] rounded-2xl p-3.5',
    // border-width: hairline (0.5px) — set via inline style or custom Tailwind plugin
    // border: 0.5px solid var(--color-border-subtle)
  },

  // ── Typography ───────────────────────────────────────────────────────────
  text: {
    pageLabel:   'text-[10px] font-medium tracking-[0.04em] uppercase text-[--color-text-tertiary]',
    sectionTitle:'text-sm font-medium text-[--color-text-primary]',   // 14px/500
    sectionSub:  'text-xs text-[--color-text-secondary]',             // 12px/400
    cardHeading: 'text-[15px] font-medium text-[--color-text-primary]',
    body:        'text-[13px] text-[--color-text-primary]',
    bodyMuted:   'text-[13px] text-[--color-text-secondary]',
    caption:     'text-xs text-[--color-text-tertiary]',              // 11px
    metricLarge: 'text-[20px] font-medium',                           // readiness %
    metricXL:    'text-[18px] font-medium text-[--color-text-primary]',// XP value
  },

  // ── Buttons ──────────────────────────────────────────────────────────────
  button: {
    primary:  [
      'inline-flex items-center justify-center gap-1.5',
      'bg-[--color-brand-bg] hover:bg-[--color-brand-bg-hover]',
      'text-[--color-text-on-brand] text-[13px] font-medium',
      'px-3.5 py-2 rounded-lg',
      'transition-colors duration-150',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600/40',
    ].join(' '),
    ghost: [
      'inline-flex items-center justify-center gap-1.5',
      'bg-transparent hover:bg-[--color-bg-subtle]',
      'text-[--color-text-secondary] text-[13px] font-medium',
      'border border-[--color-border-default]',
      'px-3 py-1.5 rounded-lg',
      'transition-colors duration-150',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600/40',
    ].join(' '),
    icon: [
      'inline-flex items-center justify-center',
      'w-7 h-7 rounded-lg',
      'hover:bg-[--color-bg-subtle]',
      'text-[--color-text-secondary]',
      'transition-colors duration-150',
    ].join(' '),
  },

  // ── Chips / Badges ────────────────────────────────────────────────────────
  // Usage: <span className={COMPONENT_TOKENS.chip.critical}>Critical</span>
  chip: {
    base: 'inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border',
    // Status chips
    critical: 'inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[--color-critical-bg] border border-[--color-critical-border] text-[--color-critical-text]',
    weak:     'inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[--color-weak-bg] border border-[--color-weak-border] text-[--color-weak-text]',
    success:  'inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[--color-success-bg] border border-[--color-success-border] text-[--color-success-text]',
    brand:    'inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[--color-brand-bg-subtle] border border-[--color-brand-border] text-[--color-brand-text]',
    // Subject chips — use subjectChip() helper below
  },

  // ── Progress bar ─────────────────────────────────────────────────────────
  progress: {
    track: 'h-1.5 w-full bg-[--color-border-subtle] rounded-full overflow-hidden',
    // Fill colour is determined by mastery level — use progressFillClass() helper
    fillBase: 'h-full rounded-full transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
    // Mini (inside chapter rows): h-1
    trackMini: 'h-1 w-[60px] bg-[--color-border-subtle] rounded-full overflow-hidden',
    fillMini:  'h-full rounded-full',
  },

  // ── Topic row (Today's plan) ──────────────────────────────────────────────
  topicCard: {
    base:    'border border-[--color-border-subtle] rounded-xl p-2.5 mb-2 last:mb-0',
    active:  'border border-purple-300 bg-[--color-brand-bg-subtle] rounded-xl p-2.5 mb-2',
    counter: 'w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium flex-shrink-0',
    counterActive: 'bg-[--color-brand-bg] text-white',
    counterDefault:'bg-[--color-bg-subtle] text-[--color-text-secondary]',
  },

  // ── Readiness card ───────────────────────────────────────────────────────
  readinessCard: {
    base:   'border border-[--color-border-subtle] rounded-xl p-3',
    row:    'flex items-center gap-2 py-1.5 border-b border-[--color-border-subtle] last:border-b-0 last:pb-0',
    score: {
      critical: 'text-[20px] font-medium text-[--color-critical-text]',
      weak:     'text-[20px] font-medium text-[--color-weak-text]',
      success:  'text-[20px] font-medium text-[--color-success-text]',
    },
  },

  // ── Focus priority row ───────────────────────────────────────────────────
  focusRow: {
    base:   'flex items-center gap-2 py-2 border-b border-[--color-border-subtle] last:border-b-0',
    rank: {
      critical: 'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium bg-[--color-critical-bg] text-[--color-critical-text] flex-shrink-0',
      weak:     'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium bg-[--color-weak-bg] text-[--color-weak-text] flex-shrink-0',
      default:  'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium bg-[--color-bg-subtle] text-[--color-text-secondary] flex-shrink-0',
    },
  },

  // ── Day dot (weekly calendar) ────────────────────────────────────────────
  dayDot: {
    wrapper:   'flex flex-col items-center gap-1',
    label:     'text-[10px] text-[--color-text-tertiary]',
    circle: {
      base:      'w-[26px] h-[26px] rounded-full flex items-center justify-center text-[11px]',
      today:     'bg-[--color-brand-bg] text-white font-medium',
      done:      'bg-[--color-success-bg] text-[--color-success-text]',
      future:    'bg-[--color-bg-subtle] text-[--color-text-tertiary]',
      target:    'border-[1.5px] border-[--color-border-brand] text-[--color-brand-text] bg-transparent',
    },
  },

  // ── Skeleton loader ──────────────────────────────────────────────────────
  skeleton: {
    base:  'bg-[--color-border-subtle] rounded animate-pulse',
    line:  'h-3 bg-[--color-border-subtle] rounded animate-pulse',
    circle:'rounded-full bg-[--color-border-subtle] animate-pulse',
  },

} as const;


// ─────────────────────────────────────────────────────────────────────────────
// 11. HELPER FUNCTIONS  (pure — no React dependency)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the correct status chip className based on mastery percentage.
 * Thresholds: < 30 → critical, 30–65 → weak, > 65 → success
 */
export function statusChipClass(mastery: number): string {
  if (mastery < 30) return COMPONENT_TOKENS.chip.critical;
  if (mastery < 65) return COMPONENT_TOKENS.chip.weak;
  return COMPONENT_TOKENS.chip.success;
}

/**
 * Returns the status label string for a given mastery score.
 */
export function statusLabel(mastery: number): string {
  if (mastery < 30) return 'Critical';
  if (mastery < 65) return 'Weak';
  if (mastery < 85) return 'Good';
  return 'Strong';
}

/**
 * Returns the progress bar fill colour hex based on mastery %.
 * Use as: style={{ background: progressFillColor(mastery) }}
 */
export function progressFillColor(mastery: number): string {
  if (mastery < 30) return primitives.red[400];
  if (mastery < 65) return primitives.amber[200];
  return primitives.green[400];
}

/**
 * Returns subject chip className + dot colour for a given subject key.
 * Falls back gracefully for unknown subjects.
 */
export type SubjectKey = 'mathematics' | 'physics' | 'chemistry' | 'biology';

export function subjectChipClass(subject: SubjectKey): string {
  const t = semanticColors.subject[subject] ?? semanticColors.subject.mathematics;
  // Returns inline-style-ready string — apply via style attribute
  return [
    'inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border',
  ].join(' ');
}

export function subjectChipStyle(subject: SubjectKey): React.CSSProperties {
  const t = semanticColors.subject[subject as keyof typeof semanticColors.subject];
  if (!t || typeof t !== 'object' || !('chipBg' in t)) {
    return { background: primitives.gray[50], borderColor: primitives.gray[200], color: primitives.gray[800] };
  }
  const s = t as typeof semanticColors.subject.mathematics;
  return { background: s.chipBg, borderColor: s.chipBorder, color: s.chipText };
}

export function subjectDotColor(subject: SubjectKey): string {
  const t = semanticColors.subject[subject as keyof typeof semanticColors.subject];
  if (!t || typeof t !== 'object' || !('dot' in t)) return primitives.gray[400];
  return (t as typeof semanticColors.subject.mathematics).dot;
}

/**
 * Days-to-exam colour: red ≤ 30d, amber 31–60d, default > 60d
 */
export function daysToExamColor(days: number): string {
  if (days <= 30) return 'var(--color-critical-text)';
  if (days <= 60) return 'var(--color-weak-text)';
  return 'var(--color-text-secondary)';
}


// ─────────────────────────────────────────────────────────────────────────────
// 12. TAILWIND CONFIG EXTENSION  (paste into tailwind.config.ts → theme.extend)
// ─────────────────────────────────────────────────────────────────────────────

export const tailwindExtend = {
  colors: {
    // Primitive ramps (for one-off use only — prefer semantic tokens)
    purple: primitives.purple,
    blue:   primitives.blue,
    amber:  primitives.amber,
    green:  primitives.green,
    red:    primitives.red,
    gray:   primitives.gray,
  },
  borderRadius,
  spacing,
  fontSize: typography.fontSize,
  fontFamily: typography.fontFamily,
  boxShadow: shadow,
  transitionDuration: motion.duration,
  transitionTimingFunction: motion.easing,
} as const;


// ─────────────────────────────────────────────────────────────────────────────
// 13. GLOBALS.CSS INJECTION TEMPLATE
//     Copy this into your globals.css — do NOT modify the variable names.
// ─────────────────────────────────────────────────────────────────────────────
//
//  :root {
//    --color-bg-page:           #F1EFE8;
//    --color-bg-surface:        #FFFFFF;
//    --color-bg-surface-raised: #FFFFFF;
//    --color-bg-subtle:         #F1EFE8;
//    --color-text-primary:      #2C2C2A;
//    --color-text-secondary:    #5F5E5A;
//    --color-text-tertiary:     #888780;
//    --color-text-disabled:     #B4B2A9;
//    --color-text-on-brand:     #FFFFFF;
//    --color-text-link:         #534AB7;
//    --color-border-subtle:     #D3D1C7;
//    --color-border-default:    #B4B2A9;
//    --color-border-strong:     #888780;
//    --color-border-brand:      #534AB7;
//    --color-brand-bg:          #534AB7;
//    --color-brand-bg-hover:    #3C3489;
//    --color-brand-bg-subtle:   #EEEDFE;
//    --color-brand-border:      #AFA9EC;
//    --color-brand-text:        #3C3489;
//    --color-critical-bg:       #FCEBEB;
//    --color-critical-border:   #F09595;
//    --color-critical-text:     #A32D2D;
//    --color-critical-fill:     #E24B4A;
//    --color-weak-bg:           #FAEEDA;
//    --color-weak-border:       #EF9F27;
//    --color-weak-text:         #633806;
//    --color-weak-fill:         #EF9F27;
//    --color-success-bg:        #EAF3DE;
//    --color-success-border:    #97C459;
//    --color-success-text:      #27500A;
//    --color-success-fill:      #639922;
//  }
//
//  .dark {
//    --color-bg-page:           #1A1918;
//    --color-bg-surface:        #26241F;
//    --color-bg-surface-raised: #2E2C27;
//    --color-bg-subtle:         #201F1B;
//    --color-text-primary:      #E8E6DF;
//    --color-text-secondary:    #A8A69F;
//    --color-text-tertiary:     #6E6C67;
//    --color-text-disabled:     #4A4844;
//    --color-text-on-brand:     #FFFFFF;
//    --color-text-link:         #7F77DD;
//    --color-border-subtle:     #3A3830;
//    --color-border-default:    #4A4840;
//    --color-border-strong:     #6E6C60;
//    --color-border-brand:      #7F77DD;
//    --color-brand-bg:          #534AB7;
//    --color-brand-bg-hover:    #7F77DD;
//    --color-brand-bg-subtle:   #26215C;
//    --color-brand-border:      #3C3489;
//    --color-brand-text:        #AFA9EC;
//    --color-critical-bg:       #3D1515;
//    --color-critical-border:   #791F1F;
//    --color-critical-text:     #F09595;
//    --color-critical-fill:     #E24B4A;
//    --color-weak-bg:           #3A2005;
//    --color-weak-border:       #633806;
//    --color-weak-text:         #EF9F27;
//    --color-weak-fill:         #EF9F27;
//    --color-success-bg:        #0D2208;
//    --color-success-border:    #27500A;
//    --color-success-text:      #C0DD97;
//    --color-success-fill:      #639922;
//  }
