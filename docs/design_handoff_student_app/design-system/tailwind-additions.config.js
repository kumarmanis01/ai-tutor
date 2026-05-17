/**
 * Tailwind config additions — MERGE into tailwind.config.js theme.extend
 *
 * Don't replace your existing config. Take the entries below and add them to
 * the matching sections in your tailwind.config.js. Each token here pairs with
 * a CSS variable in design-system/tokens-additions.css.
 *
 * After merging, the new utilities work like any other:
 *   bg-surface-warm    bg-surface-sunk    text-ink-2     text-ink-4
 *   bg-subject-hindi-bg                   text-subject-hindi
 *   text-status-fair-text                 bg-status-fair-fill
 *   text-status-on-track-text             bg-status-on-track-fill
 *   shadow-press-primary  shadow-press-warning  shadow-press-success
 *   shadow-pop
 */

module.exports = {
  theme: {
    extend: {
      colors: {
        // Surface layer (warm cream tones used on hero / sidebar cards)
        'surface-warm': 'var(--color-surface-warm)',
        'surface-sunk': 'var(--color-surface-sunk)',

        // Ink scale (mid-tones — repo already has foreground + muted-foreground)
        'ink-2': 'var(--color-ink-2)',
        'ink-4': 'var(--color-ink-4)',

        // Subject identity — Hindi (joins existing math/physics/etc.)
        'subject-hindi':    'var(--subject-hindi)',
        'subject-hindi-bg': 'var(--subject-hindi-bg)',

        // Readiness tiers — fair + on-track (rounding out the 5-tier scale)
        'status-fair-text':     'var(--color-fair-text)',
        'status-fair-fill':     'var(--color-fair-fill)',
        'status-on-track-text': 'var(--color-on-track-text)',
        'status-on-track-fill': 'var(--color-on-track-fill)',
      },

      boxShadow: {
        // Press-down "hardware lift" — used on Button + DayDot
        'press-primary': 'var(--shadow-press-primary)',
        'press-warning': 'var(--shadow-press-warning)',
        'press-success': 'var(--shadow-press-success)',

        // Floating elements (popovers, dropdowns)
        pop: 'var(--shadow-pop)',
      },

      borderRadius: {
        // The repo's brand.ts already exports sm/md/lg/xl/full.
        // Add 2xl for hero banners and identity hero (24 px).
        '2xl': '1.5rem',
      },

      maxWidth: {
        // Centralized page content max — used by every authenticated student page.
        'page': '1120px',
      },

      // No new font families — keep BRAND_TYPOGRAPHY (Poppins + Inter).
      // Animations / keyframes — only add via brand if needed.
    },
  },
};
