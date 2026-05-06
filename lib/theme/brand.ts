/**
 * FILE OBJECTIVE:
 * - Single source of truth for all brand/cosmetic configuration.
 * - WHITE-LABELING ENTRY POINT: change values here to rebrand the app.
 *
 * HOW TO WHITE-LABEL:
 *   1. Update BRAND_META  -- product name, tutor persona, pricing
 *   2. Update BRAND_COLORS -- primary palette + semantic states
 *   3. Update BRAND_DARK_COLORS -- dark-mode overrides
 *   4. Update BRAND_TYPOGRAPHY -- font stack
 *   5. Update CSS variables in styles/tailwind.css to match (grep: "KEEP IN SYNC WITH brand.ts")
 *   6. Replace logo assets in public/logos/ and public/favicon*.png
 *   7. Run: npm run build && npm test
 *
 * CONSTRAINT: Never hard-code any of these values in component files.
 *   Use Tailwind classes (bg-primary, text-success, etc.) or reference
 *   these exports for runtime JS usage (e.g., chart colours).
 */

// ============================================================================
// BRAND META
// ============================================================================

export const BRAND_META = {
  name: 'Spinzy',
  productName: 'Spinzy AI Tutor',
  tutorName: 'Vidya',
  tagline: 'Turn doubts into confidence',
  supportEmail: 'support@spinzy.in',
  pricing: { amount: '399', currency: 'INR', symbol: '₹' },
  logoPath: '/logos/spinzy-logo.svg',
  logoIconPath: '/logos/icon-192.png',
  faviconPath: '/favicon.ico',
  themeColor: '#534AB7',          // meta theme-color and PWA tile color
} as const;

// ============================================================================
// BRAND COLORS  (light mode)
// ============================================================================

/**
 * Core palette -- change these hex values to re-theme the entire app.
 *
 * Each color has a matching CSS variable in styles/tailwind.css:
 *   primary        -> --color-primary
 *   primaryHover   -> --color-primary-hover
 *   primaryFg      -> --color-primary-foreground
 *   primaryBg      -> --color-primary-bg
 *   ... etc.
 */
export const BRAND_COLORS = {
  // Primary: buttons, active states, progress fills, focus rings
  primary: '#534AB7',
  primaryHover: '#4239A0',
  primaryForeground: '#FFFFFF',
  primaryBg: '#EEEDFE',           // light purple tint for primary accent backgrounds

  // Secondary: headings, trust elements, dark text on marketing pages
  secondary: '#000080',
  secondaryForeground: '#FFFFFF',

  // Success: correct answers, streaks, caught-up states
  success: '#1D9E75',
  successForeground: '#FFFFFF',
  successBg: '#EAF3DE',

  // Warning: partial mastery, incomplete prerequisites
  warning: '#BA7517',
  warningForeground: '#FFFFFF',
  warningBg: '#FAEEDA',

  // Error / Danger: critical gaps, wrong answers, validation errors
  error: '#E24B4A',
  errorForeground: '#FFFFFF',
  errorBg: '#FCEBEB',

  // Neutrals
  background: '#FFFFFF',
  foreground: '#1A1A1A',
  card: '#FFFFFF',
  cardForeground: '#1A1A1A',
  popover: '#FFFFFF',
  popoverForeground: '#1A1A1A',
  muted: '#F8F9FA',
  mutedForeground: '#666666',
  border: '#E5E7EB',
  input: '#E5E7EB',
  ring: '#534AB7',

  // AI chat bubble colours
  userBubble: '#DCF8C6',
  aiBubble: '#F1F0F0',
} as const;

// ============================================================================
// BRAND DARK COLORS
// ============================================================================

export const BRAND_DARK_COLORS = {
  background: '#0B1220',
  foreground: '#E6EEF8',
  card: '#0F1724',
  cardForeground: '#E6EEF8',
  popover: '#071025',
  popoverForeground: '#E6EEF8',
  muted: '#071025',
  mutedForeground: '#9AA6B2',
  border: '#122031',
  input: '#122831',
  ring: '#7B74D4',
  primary: '#7B74D4',             // lighter indigo for dark-mode legibility
  primaryForeground: '#FFFFFF',
  primaryBg: '#1A1845',
  secondary: '#1E293B',
  secondaryForeground: '#E6EEF8',
  success: '#22C55E',
  successBg: '#14532D',
  warning: '#F59E0B',
  warningBg: '#451A03',
  error: '#EF4444',
  errorBg: '#450A0A',
} as const;

// ============================================================================
// BRAND TYPOGRAPHY
// ============================================================================

export const BRAND_TYPOGRAPHY = {
  fontHeadline: "'Poppins', sans-serif",
  fontBody: "'Inter', sans-serif",
  fontCta: "'Poppins', sans-serif",
  fontAccent: "'Noto Sans Devanagari', sans-serif",
} as const;

// ============================================================================
// BRAND RADIUS
// ============================================================================

export const BRAND_RADIUS = {
  sm: '0.25rem',    // 4px  -- tags, badges
  md: '0.5rem',     // 8px  -- inputs, cards (default)
  lg: '0.75rem',    // 12px -- modals, large cards
  xl: '1rem',       // 16px -- hero cards
  full: '9999px',   // pill -- chips, avatar rings
} as const;

// ============================================================================
// AGE-BAND PALETTES
// ============================================================================

/**
 * Per-grade-band colour overrides applied by UIVariantProvider.
 * Junior (grades 1-3) gets a playful palette; middle/senior use brand colours.
 * Used by components/UI/variants/designTokens.ts.
 */
export const AGE_PALETTES = {
  vibrant: {
    // Junior grades (1-3): playful, high saturation
    primary: '#FF6B6B',
    primaryHover: '#FF5252',
    secondary: '#4ECDC4',
    accent: '#FFE66D',
    success: '#51CF66',
    warning: '#FFD43B',
    error: '#FF6B6B',
    background: '#FFF9E6',
    surface: '#FFFFFF',
    text: '#2D3436',
    textMuted: '#636E72',
  },
  balanced: {
    // Middle grades (4-7): brand palette with teal accent
    primary: '#534AB7',
    primaryHover: '#4239A0',
    secondary: '#06B6D4',
    accent: '#F59E0B',
    success: '#1D9E75',
    warning: '#BA7517',
    error: '#E24B4A',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    text: '#1E293B',
    textMuted: '#64748B',
  },
  professional: {
    // Senior grades (8-12): brand palette, compact, focused
    primary: '#534AB7',
    primaryHover: '#4239A0',
    secondary: '#64748B',
    accent: '#8B5CF6',
    success: '#1D9E75',
    warning: '#BA7517',
    error: '#E24B4A',
    background: '#F1F5F9',
    surface: '#FFFFFF',
    text: '#0F172A',
    textMuted: '#475569',
  },
} as const;

export type AgePaletteName = keyof typeof AGE_PALETTES;

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

const brand = {
  meta: BRAND_META,
  colors: BRAND_COLORS,
  darkColors: BRAND_DARK_COLORS,
  typography: BRAND_TYPOGRAPHY,
  radius: BRAND_RADIUS,
  agePalettes: AGE_PALETTES,
};

export default brand;
