/**
 * FILE OBJECTIVE:
 * - Barrel export for age-based UI variant system.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/ui/variants/index.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created barrel export
 */

// Core variant configuration
export {
  // Types
  type GradeBand,
  type UIDensity,
  type InteractionDepth,
  type TypographyScale,
  type SpacingScale,
  type ColorConfig,
  type AnimationConfig,
  type ComponentConfig,
  type ContentConfig,
  type AccessibilityConfig,
  type UIVariantConfig,
  // Configurations
  JUNIOR_VARIANT,
  MIDDLE_VARIANT,
  SENIOR_VARIANT,
  UI_VARIANTS,
  // Functions
  getGradeBand,
  getUIVariant,
  getComponentConfig,
  getTypography,
  getSpacing,
  getColors,
  isFeatureEnabled,
} from './ageVariants';

// Design tokens and CSS generation
export {
  type CSSVariables,
  type ThemeClassNames,
  generateTypographyVariables,
  generateSpacingVariables,
  generateColorVariables,
  generateAnimationVariables,
  generateComponentVariables,
  generateAllVariables,
  generateVariablesForGrade,
  getThemeClassNames,
  getThemeClassNamesForGrade,
  getThemeClassName,
  variablesToCSS,
  generateThemeCSS,
  variablesToStyleObject,
  getInlineStylesForGrade,
} from './designTokens';

// React context and hooks
export {
  UIVariantProvider,
  useUIVariant,
  useGradeBand,
  useTypography,
  useSpacing,
  useColors,
  useAnimations,
  useComponentConfig,
  useFeatureEnabled,
  useThemeClassName,
  useCSSVariables,
  // Utility components
  ThemeWrapper,
  ForJunior,
  ForMiddle,
  ForSenior,
  WhenFeatureEnabled,
} from './UIVariantContext';
