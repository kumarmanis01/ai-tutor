/**
 * FILE OBJECTIVE:
 * - CSS custom properties (design tokens) generator for age-based UI variants.
 * - Generates CSS variables from UI variant configurations.
 * - Provides theme classes for grade bands.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/ui/variants/designTokens.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created design tokens generator
 */

import type { Grade } from '@/lib/ai/prompts/schemas';
import {
  type UIVariantConfig,
  type GradeBand,
  getUIVariant,
  getGradeBand,
  JUNIOR_VARIANT,
  MIDDLE_VARIANT,
  SENIOR_VARIANT,
} from './ageVariants';

// ============================================================================
// TYPES
// ============================================================================

/**
 * CSS variable map
 */
export type CSSVariables = Record<string, string | number>;

/**
 * Theme class names
 */
export interface ThemeClassNames {
  readonly root: string;
  readonly typography: string;
  readonly spacing: string;
  readonly colors: string;
  readonly animations: string;
  readonly density: string;
}

// ============================================================================
// COLOR PALETTES
// ============================================================================

/**
 * Color palette definitions
 */
const COLOR_PALETTES = {
  vibrant: {
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
    primary: '#6366F1',
    primaryHover: '#4F46E5',
    secondary: '#06B6D4',
    accent: '#F59E0B',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    text: '#1E293B',
    textMuted: '#64748B',
  },
  professional: {
    primary: '#3B82F6',
    primaryHover: '#2563EB',
    secondary: '#64748B',
    accent: '#8B5CF6',
    success: '#22C55E',
    warning: '#EAB308',
    error: '#DC2626',
    background: '#F1F5F9',
    surface: '#FFFFFF',
    text: '#0F172A',
    textMuted: '#475569',
  },
} as const;

/**
 * Background pattern styles
 */
const BACKGROUND_STYLES = {
  playful: {
    pattern: 'radial-gradient(circle at 20% 80%, rgba(255, 107, 107, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(78, 205, 196, 0.1) 0%, transparent 50%)',
    hasBubbles: true,
  },
  clean: {
    pattern: 'linear-gradient(180deg, rgba(99, 102, 241, 0.02) 0%, transparent 100%)',
    hasBubbles: false,
  },
  minimal: {
    pattern: 'none',
    hasBubbles: false,
  },
} as const;

// ============================================================================
// CSS VARIABLE GENERATORS
// ============================================================================

/**
 * Generate typography CSS variables
 */
export function generateTypographyVariables(config: UIVariantConfig): CSSVariables {
  const { typography } = config;
  
  return {
    '--font-size-base': `${typography.baseFontSize}px`,
    '--font-size-h1': `${typography.baseFontSize * typography.headingScale.h1}px`,
    '--font-size-h2': `${typography.baseFontSize * typography.headingScale.h2}px`,
    '--font-size-h3': `${typography.baseFontSize * typography.headingScale.h3}px`,
    '--font-size-h4': `${typography.baseFontSize * typography.headingScale.h4}px`,
    '--font-size-small': `${typography.baseFontSize * 0.875}px`,
    '--font-size-xs': `${typography.baseFontSize * 0.75}px`,
    '--line-height': typography.lineHeight,
    '--letter-spacing': `${typography.letterSpacing}px`,
    '--font-weight-body': typography.bodyWeight,
    '--font-weight-heading': typography.headingWeight,
  };
}

/**
 * Generate spacing CSS variables
 */
export function generateSpacingVariables(config: UIVariantConfig): CSSVariables {
  const { spacing } = config;
  const base = spacing.baseUnit;
  
  return {
    '--spacing-unit': `${base}px`,
    '--spacing-xs': `${base * 0.5}px`,
    '--spacing-sm': `${base}px`,
    '--spacing-md': `${base * 2}px`,
    '--spacing-lg': `${base * 3}px`,
    '--spacing-xl': `${base * 4}px`,
    '--spacing-2xl': `${base * 6}px`,
    '--padding-component': `${base * spacing.componentPadding}px`,
    '--gap-section': `${base * spacing.sectionGap}px`,
    '--padding-card': `${base * spacing.cardPadding}px`,
    '--padding-button': `${base * spacing.buttonPadding}px`,
  };
}

/**
 * Generate color CSS variables
 */
export function generateColorVariables(config: UIVariantConfig): CSSVariables {
  const { colors } = config;
  const palette = COLOR_PALETTES[colors.primaryPalette];
  const background = BACKGROUND_STYLES[colors.backgroundStyle];
  
  return {
    '--color-primary': palette.primary,
    '--color-primary-hover': palette.primaryHover,
    '--color-secondary': palette.secondary,
    '--color-accent': palette.accent,
    '--color-success': palette.success,
    '--color-warning': palette.warning,
    '--color-error': palette.error,
    '--color-background': palette.background,
    '--color-surface': palette.surface,
    '--color-text': palette.text,
    '--color-text-muted': palette.textMuted,
    '--color-saturation': `${colors.saturation}%`,
    '--background-pattern': background.pattern,
    '--use-gradients': colors.useGradients ? '1' : '0',
  };
}

/**
 * Generate animation CSS variables
 */
export function generateAnimationVariables(config: UIVariantConfig): CSSVariables {
  const { animations } = config;
  const baseDuration = 200; // ms
  
  // Transition timing functions by style
  const timingFunctions = {
    bouncy: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
    quick: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
  };
  
  return {
    '--animation-enabled': animations.enabled ? '1' : '0',
    '--animation-duration-fast': `${Math.round(baseDuration * 0.5 * animations.durationMultiplier)}ms`,
    '--animation-duration-normal': `${Math.round(baseDuration * animations.durationMultiplier)}ms`,
    '--animation-duration-slow': `${Math.round(baseDuration * 2 * animations.durationMultiplier)}ms`,
    '--animation-timing': timingFunctions[animations.transitionStyle],
    '--celebrations-enabled': animations.celebrations ? '1' : '0',
    '--micro-interactions-enabled': animations.microInteractions ? '1' : '0',
  };
}

/**
 * Generate component CSS variables
 */
export function generateComponentVariables(config: UIVariantConfig): CSSVariables {
  const { components, accessibility } = config;
  
  // Button sizes
  const buttonSizes = {
    large: { height: 56, fontSize: 18, iconSize: 24 },
    medium: { height: 44, fontSize: 16, iconSize: 20 },
    small: { height: 36, fontSize: 14, iconSize: 16 },
  };
  
  // Border radius by shape
  const buttonRadius = {
    pill: 9999,
    rounded: 8,
    square: 4,
  };
  
  const btn = buttonSizes[components.button.size];
  
  return {
    // Button
    '--button-height': `${btn.height}px`,
    '--button-font-size': `${btn.fontSize}px`,
    '--button-icon-size': `${btn.iconSize}px`,
    '--button-radius': `${buttonRadius[components.button.shape]}px`,
    
    // Card
    '--card-radius': `${components.card.borderRadius}px`,
    '--card-elevation': components.card.elevation,
    '--card-image-size': components.card.imageSize === 'large' ? '200px' : 
                         components.card.imageSize === 'medium' ? '150px' :
                         components.card.imageSize === 'small' ? '100px' : '0px',
    
    // Navigation
    '--nav-icon-size': `${components.navigation.iconSize}px`,
    
    // Accessibility
    '--min-touch-target': `${accessibility.minTouchTarget}px`,
  };
}

/**
 * Generate all CSS variables for a variant
 */
export function generateAllVariables(config: UIVariantConfig): CSSVariables {
  return {
    ...generateTypographyVariables(config),
    ...generateSpacingVariables(config),
    ...generateColorVariables(config),
    ...generateAnimationVariables(config),
    ...generateComponentVariables(config),
  };
}

/**
 * Generate CSS variables for a specific grade
 */
export function generateVariablesForGrade(grade: Grade): CSSVariables {
  const variant = getUIVariant(grade);
  return generateAllVariables(variant);
}

// ============================================================================
// THEME CLASS NAMES
// ============================================================================

/**
 * Get theme class names for a grade band
 */
export function getThemeClassNames(gradeBand: GradeBand): ThemeClassNames {
  return {
    root: `theme-${gradeBand}`,
    typography: `typography-${gradeBand}`,
    spacing: `spacing-${gradeBand}`,
    colors: `colors-${gradeBand}`,
    animations: `animations-${gradeBand}`,
    density: `density-${getUIVariant(gradeBand === 'junior' ? 1 : gradeBand === 'middle' ? 5 : 9).density}`,
  };
}

/**
 * Get theme class names for a grade
 */
export function getThemeClassNamesForGrade(grade: Grade): ThemeClassNames {
  return getThemeClassNames(getGradeBand(grade));
}

/**
 * Get combined theme class string for a grade
 */
export function getThemeClassName(grade: Grade): string {
  const classes = getThemeClassNamesForGrade(grade);
  return Object.values(classes).join(' ');
}

// ============================================================================
// CSS GENERATION
// ============================================================================

/**
 * Generate CSS string from variables
 */
export function variablesToCSS(variables: CSSVariables, selector: string = ':root'): string {
  const lines = Object.entries(variables).map(
    ([key, value]) => `  ${key}: ${value};`
  );
  return `${selector} {\n${lines.join('\n')}\n}`;
}

/**
 * Generate complete theme CSS for all variants
 */
export function generateThemeCSS(): string {
  const css: string[] = [];
  
  // Junior theme
  css.push(variablesToCSS(generateAllVariables(JUNIOR_VARIANT), '.theme-junior'));
  
  // Middle theme
  css.push(variablesToCSS(generateAllVariables(MIDDLE_VARIANT), '.theme-middle'));
  
  // Senior theme
  css.push(variablesToCSS(generateAllVariables(SENIOR_VARIANT), '.theme-senior'));
  
  // Utility classes for density
  css.push(`
.density-spacious {
  --content-max-width: 800px;
  --grid-gap: var(--spacing-xl);
}

.density-comfortable {
  --content-max-width: 1024px;
  --grid-gap: var(--spacing-lg);
}

.density-compact {
  --content-max-width: 1280px;
  --grid-gap: var(--spacing-md);
}
  `.trim());
  
  return css.join('\n\n');
}

// ============================================================================
// INLINE STYLES HELPER
// ============================================================================

/**
 * Convert CSS variables to inline style object for React
 */
export function variablesToStyleObject(
  variables: CSSVariables
): React.CSSProperties {
  const style: Record<string, string | number> = {};
  
  for (const [key, value] of Object.entries(variables)) {
    // Convert CSS variable format to camelCase
    const _camelKey = key.replace(/^--/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    style[key] = value; // Keep original CSS variable format for style prop
  }
  
  return style as React.CSSProperties;
}

/**
 * Get inline styles for a grade
 */
export function getInlineStylesForGrade(grade: Grade): React.CSSProperties {
  const variables = generateVariablesForGrade(grade);
  return variablesToStyleObject(variables);
}
