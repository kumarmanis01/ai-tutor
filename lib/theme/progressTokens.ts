/**
 * Progress-screen design tokens.
 *
 * Extracted from the wireframe (520e3de8-Student_Progress__offline_.html).
 * These map 1-to-1 to Tailwind utility classes -- use the class names
 * in components, not the raw values here.
 *
 * Any value used only in JS (e.g. SVG stroke) may reference these constants.
 */

// ── Page chrome ───────────────────────────────────────────────────────────────
export const PG_BG         = 'bg-page-bg dark:bg-background';      // #F1EFE8 light
export const PG_CONTENT    = 'px-4 pb-24';                         // v-content equivalent

// ── Card surface ─────────────────────────────────────────────────────────────
export const CARD_SURFACE  = 'bg-white dark:bg-slate-900';
export const CARD_BORDER   = 'border border-[#D3D1C7] dark:border-slate-700';
export const CARD_RADIUS   = 'rounded-2xl';                         // --r-3xl = 16px
export const CARD_PAD      = 'p-5';                                 // --card-pad = 20px
export const CARD_CLASS    = `${CARD_SURFACE} ${CARD_BORDER} ${CARD_RADIUS} ${CARD_PAD}`;

// ── Section stack gap ─────────────────────────────────────────────────────────
export const STACK         = 'mb-6';                               // --stack = 24px

// ── Typography ───────────────────────────────────────────────────────────────
export const TEXT_PRIMARY   = 'text-[#2C2C2A] dark:text-[#E6EEF8]';
export const TEXT_SECONDARY = 'text-[#5F5E5A] dark:text-[#9AA6B2]';
export const TEXT_TERTIARY  = 'text-[#888780] dark:text-[#6B7280]';
export const EYEBROW        = `text-[11px] font-semibold tracking-[0.08em] uppercase ${TEXT_TERTIARY}`;
export const SEC_TITLE      = `text-[17px] font-semibold tracking-tight ${TEXT_PRIMARY}`;
export const PANEL_TITLE    = `text-base font-semibold tracking-tight ${TEXT_PRIMARY}`;
export const META_LABEL     = `text-xs ${TEXT_TERTIARY}`;

// ── Readiness tier fill colours (for SVG stroke / bar fills) ─────────────────
export const TIER_FILLS: Record<string, string> = {
  critical: '#E24B4A',
  weak:     '#EF9F27',
  fair:     '#EF9F27',
  ontrack:  '#534AB7',
  strong:   '#639922',
};

export const TIER_CHIP: Record<string, string> = {
  critical: 'bg-[#FCEBEB] text-[#A32D2D] border-[#F09595]',
  weak:     'bg-[#FAEEDA] text-[#633806] border-[#EF9F27]',
  fair:     'bg-[#FAEEDA] text-[#633806] border-[#EF9F27]',
  ontrack:  'bg-[#EEEDFE] text-[#3C3489] border-[#AFA9EC]',
  strong:   'bg-[#EAF3DE] text-[#27500A] border-[#97C459]',
};

// ── Metric card delta colours ─────────────────────────────────────────────────
export const DELTA_UP   = 'text-[#27500A]';
export const DELTA_DOWN = 'text-[#A32D2D]';
