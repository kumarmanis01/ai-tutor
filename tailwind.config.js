/** @type {import('tailwindcss').Config} */

/**
 * TAILWIND CONFIGURATION -- KEEP IN SYNC WITH lib/theme/brand.ts
 *
 * Two colour layers:
 *
 *  1. CSS-variable colours (bg-primary, text-success, etc.)
 *     -- Dynamic: can be overridden at runtime by the age-variant system.
 *     -- Limitation: Tailwind opacity modifiers (bg-primary/10) do NOT work
 *        with CSS variable colours in Tailwind v3.
 *
 *  2. Static brand colours (bg-brand-primary, bg-brand-success, etc.)
 *     -- Static hex values matching lib/theme/brand.ts BRAND_COLORS.
 *     -- Opacity modifiers work: bg-brand-primary/10, bg-brand-success/20, etc.
 *     -- Use these in components that need opacity variants.
 *
 * Rule: when changing brand colours, update BOTH lib/theme/brand.ts
 * AND the `brand` object below.
 */
const config = {
  darkMode: 'class',
  // Exclude API route files from content scanning to avoid stat() errors
  // when API route files are removed during refactors.
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    '!./app/api/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        // Consolidated font tokens: Inter for UI, JetBrains Mono for numerics
        sans:  ['var(--font-sans)', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono:  ['var(--font-mono)', 'SF Mono', 'Consolas', 'monospace'],
      },
      colors: {
        // ── CSS-variable-based semantic colours ──────────────────────────────
        // Dynamic, overridable at runtime. Opacity modifiers NOT supported.
        background:           'var(--color-background)',
        foreground:           'var(--color-foreground)',
        muted:                'var(--color-muted)',
        'muted-foreground':   'var(--color-muted-foreground)',
        border:               'var(--color-border)',
        input:                'var(--color-input)',
        ring:                 'var(--color-ring)',
        primary:              'var(--color-primary)',
        'primary-hover':      'var(--color-primary-hover)',
        'primary-foreground': 'var(--color-primary-foreground)',
        'primary-bg':         'var(--color-primary-bg)',
        secondary:            'var(--color-secondary)',
        'secondary-foreground': 'var(--color-secondary-foreground)',
        accent:               'var(--color-accent)',
        'accent-foreground':  'var(--color-accent-foreground)',
        success:              'var(--color-success)',
        'success-foreground': 'var(--color-success-foreground)',
        'success-bg':         'var(--color-success-bg)',
        warning:              'var(--color-warning)',
        'warning-foreground': 'var(--color-warning-foreground)',
        'warning-bg':         'var(--color-warning-bg)',
        error:                'var(--color-error)',
        'error-foreground':   'var(--color-error-foreground)',
        'error-bg':           'var(--color-error-bg)',
        destructive:          'var(--color-destructive)',
        'destructive-foreground': 'var(--color-destructive-foreground)',
        card:                 'var(--color-card)',
        'card-foreground':    'var(--color-card-foreground)',
        popover:              'var(--color-popover)',
        'popover-foreground': 'var(--color-popover-foreground)',

        // ── Static brand colours (opacity modifiers work here) ────────────
        // Mirror of lib/theme/brand.ts BRAND_COLORS.
        // Update BOTH files when rebranding.
        brand: {
          primary:        '#534AB7',
          'primary-hover': '#4239A0',
          'primary-fg':   '#FFFFFF',
          'primary-bg':   '#EEEDFE',
          secondary:      '#000080',
          success:        '#1D9E75',
          'success-bg':   '#EAF3DE',
          warning:        '#BA7517',
          'warning-bg':   '#FAEEDA',
          danger:         '#E24B4A',
          'danger-bg':    '#FCEBEB',
        },

        // Subject identity tokens (consume CSS variables)
        'subject-mathematics': 'var(--subject-mathematics)',
        'subject-mathematics-bg': 'var(--subject-mathematics-bg)',
        'subject-physics': 'var(--subject-physics)',
        'subject-physics-bg': 'var(--subject-physics-bg)',
        'subject-chemistry': 'var(--subject-chemistry)',
        'subject-chemistry-bg': 'var(--subject-chemistry-bg)',
        'subject-biology': 'var(--subject-biology)',
        'subject-biology-bg': 'var(--subject-biology-bg)',
        'subject-english': 'var(--subject-english)',
        'subject-english-bg': 'var(--subject-english-bg)',
        'subject-social': 'var(--subject-social)',
        'subject-social-bg': 'var(--subject-social-bg)',

        // Status tokens (text and fill variants)
        'status-critical-text': 'var(--color-critical-text)',
        'status-critical-fill': 'var(--color-critical-fill)',
        'status-weak-text': 'var(--color-weak-text)',
        'status-weak-fill': 'var(--color-weak-fill)',
        'status-success-text': 'var(--color-success-text)',
        'status-success-fill': 'var(--color-success-fill)',

        // ── Chat bubble colours ────────────────────────────────────────────
        userBubble: '#DCF8C6',
        aiBubble:   '#F1F0F0',

        // Design system additions
        'surface-warm': 'var(--color-surface-warm)',
        'surface-sunk': 'var(--color-surface-sunk)',
        'page-bg':      'var(--color-page-bg)',
        'ink-2':        'var(--color-ink-2)',
        'ink-4':        'var(--color-ink-4)',
        'subject-hindi':    'var(--subject-hindi)',
        'subject-hindi-bg': 'var(--subject-hindi-bg)',
        'status-fair-text':     'var(--color-fair-text)',
        'status-fair-fill':     'var(--color-fair-fill)',
        'status-on-track-text': 'var(--color-on-track-text)',
        'status-on-track-fill': 'var(--color-on-track-fill)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius-md)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': '1.5rem',
      },
      boxShadow: {
        // Only allow the focus shadow via Tailwind utilities
        focus: 'var(--shadow-focus)',
        'press-primary': 'var(--shadow-press-primary)',
        'press-warning': 'var(--shadow-press-warning)',
        'press-success': 'var(--shadow-press-success)',
        'pop':           'var(--shadow-pop)',
      },
      maxWidth: {
        'page': '1120px',
      },
    },
  },
  plugins: [],
};

export default config;
