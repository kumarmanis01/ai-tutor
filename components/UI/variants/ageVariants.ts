/**
 * FILE OBJECTIVE:
 * - Age-based UI variant configuration for K-12 student dashboard.
 * - Differentiates Grade 1-3 (junior) and Grade 8-10 (senior) experiences.
 * - Configuration-driven UI behavior (not conditionals).
 * - Design tokens and component adaptations per age group.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/ui/variants/ageVariants.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created age-based UI variant configuration
 */

import type { Grade } from '@/lib/ai/prompts/schemas';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Grade bands for UI variants
 */
export type GradeBand = 'junior' | 'middle' | 'senior';

/**
 * UI density levels
 * - spacious: Large spacing, fewer items per view (junior)
 * - comfortable: Moderate spacing, balanced items
 * - compact: Minimal spacing, more information density (senior)
 */
export type UIDensity = 'spacious' | 'comfortable' | 'compact';

/**
 * Interaction depth levels
 * - simple: Single-tap actions, minimal menus
 * - moderate: Some nested actions, dropdowns
 * - complex: Full feature access, keyboard shortcuts
 */
export type InteractionDepth = 'simple' | 'moderate' | 'complex';

/**
 * Typography scale configuration
 */
export interface TypographyScale {
  /** Base font size in pixels */
  readonly baseFontSize: number;
  /** Heading scale multipliers */
  readonly headingScale: {
    readonly h1: number;
    readonly h2: number;
    readonly h3: number;
    readonly h4: number;
  };
  /** Line height */
  readonly lineHeight: number;
  /** Letter spacing */
  readonly letterSpacing: number;
  /** Font weight for body text */
  readonly bodyWeight: number;
  /** Font weight for headings */
  readonly headingWeight: number;
}

/**
 * Spacing scale configuration
 */
export interface SpacingScale {
  /** Base unit in pixels */
  readonly baseUnit: number;
  /** Component padding multiplier */
  readonly componentPadding: number;
  /** Section gap multiplier */
  readonly sectionGap: number;
  /** Card padding multiplier */
  readonly cardPadding: number;
  /** Button padding multiplier */
  readonly buttonPadding: number;
}

/**
 * Color configuration for age groups
 */
export interface ColorConfig {
  /** Primary color palette name */
  readonly primaryPalette: 'vibrant' | 'balanced' | 'professional';
  /** Saturation level (0-100) */
  readonly saturation: number;
  /** Use gradients */
  readonly useGradients: boolean;
  /** Icon color style */
  readonly iconStyle: 'colorful' | 'monotone' | 'subtle';
  /** Background style */
  readonly backgroundStyle: 'playful' | 'clean' | 'minimal';
}

/**
 * Animation configuration
 */
export interface AnimationConfig {
  /** Enable animations */
  readonly enabled: boolean;
  /** Animation duration multiplier */
  readonly durationMultiplier: number;
  /** Enable celebration animations (confetti, etc.) */
  readonly celebrations: boolean;
  /** Enable micro-interactions */
  readonly microInteractions: boolean;
  /** Transition style */
  readonly transitionStyle: 'bouncy' | 'smooth' | 'quick';
}

/**
 * Component-specific configurations
 */
export interface ComponentConfig {
  /** Button configuration */
  readonly button: {
    readonly size: 'large' | 'medium' | 'small';
    readonly shape: 'pill' | 'rounded' | 'square';
    readonly showIcon: boolean;
    readonly iconPosition: 'left' | 'right';
  };
  /** Card configuration */
  readonly card: {
    readonly showImage: boolean;
    readonly imageSize: 'large' | 'medium' | 'small' | 'none';
    readonly borderRadius: number;
    readonly elevation: number;
  };
  /** Navigation configuration */
  readonly navigation: {
    readonly style: 'bottom-tab' | 'side-rail' | 'top-nav';
    readonly showLabels: boolean;
    readonly iconSize: number;
  };
  /** Question display configuration */
  readonly question: {
    readonly optionStyle: 'card' | 'list' | 'inline';
    readonly showHints: boolean;
    readonly showTimer: boolean;
    readonly confirmBeforeSubmit: boolean;
  };
  /** Progress display configuration */
  readonly progress: {
    readonly style: 'stars' | 'bar' | 'percentage' | 'steps';
    readonly showNumbers: boolean;
    readonly celebrateCompletion: boolean;
  };
}

/**
 * Content configuration
 */
export interface ContentConfig {
  /** Maximum items to show in lists */
  readonly maxListItems: number;
  /** Text truncation length */
  readonly truncateLength: number;
  /** Show descriptions */
  readonly showDescriptions: boolean;
  /** Reading level (1-12) */
  readonly readingLevel: number;
  /** Use simplified vocabulary */
  readonly simplifiedVocabulary: boolean;
}

/**
 * Accessibility configuration
 */
export interface AccessibilityConfig {
  /** Minimum touch target size */
  readonly minTouchTarget: number;
  /** Focus indicator style */
  readonly focusStyle: 'ring' | 'outline' | 'highlight';
  /** High contrast mode available */
  readonly highContrastAvailable: boolean;
  /** Text-to-speech hints */
  readonly speechHints: boolean;
}

/**
 * Complete UI variant configuration
 */
export interface UIVariantConfig {
  /** Grade band this config applies to */
  readonly gradeBand: GradeBand;
  /** Grade range (min-max) */
  readonly gradeRange: { min: Grade; max: Grade };
  /** UI density */
  readonly density: UIDensity;
  /** Interaction depth */
  readonly interactionDepth: InteractionDepth;
  /** Typography settings */
  readonly typography: TypographyScale;
  /** Spacing settings */
  readonly spacing: SpacingScale;
  /** Color settings */
  readonly colors: ColorConfig;
  /** Animation settings */
  readonly animations: AnimationConfig;
  /** Component settings */
  readonly components: ComponentConfig;
  /** Content settings */
  readonly content: ContentConfig;
  /** Accessibility settings */
  readonly accessibility: AccessibilityConfig;
  /** Educational reasoning for this configuration */
  readonly educationalReasoning: string;
}

// ============================================================================
// VARIANT CONFIGURATIONS
// ============================================================================

/**
 * Junior variant (Grades 1-3)
 * 
 * EDUCATIONAL REASONING:
 * - Children ages 6-8 are developing motor skills and have shorter attention spans
 * - Large touch targets and minimal cognitive load are essential
 * - Visual feedback and celebrations reinforce positive learning behaviors
 * - Simple navigation prevents frustration and getting lost
 * - Playful colors and animations maintain engagement
 */
export const JUNIOR_VARIANT: UIVariantConfig = {
  gradeBand: 'junior',
  gradeRange: { min: 1, max: 3 },
  density: 'spacious',
  interactionDepth: 'simple',
  
  typography: {
    baseFontSize: 18,
    headingScale: { h1: 2.0, h2: 1.75, h3: 1.5, h4: 1.25 },
    lineHeight: 1.8,
    letterSpacing: 0.5,
    bodyWeight: 400,
    headingWeight: 700,
  },
  
  spacing: {
    baseUnit: 8,
    componentPadding: 3,    // 24px
    sectionGap: 4,          // 32px
    cardPadding: 3,         // 24px
    buttonPadding: 2.5,     // 20px
  },
  
  colors: {
    primaryPalette: 'vibrant',
    saturation: 85,
    useGradients: true,
    iconStyle: 'colorful',
    backgroundStyle: 'playful',
  },
  
  animations: {
    enabled: true,
    durationMultiplier: 1.2,  // Slightly slower for visual processing
    celebrations: true,
    microInteractions: true,
    transitionStyle: 'bouncy',
  },
  
  components: {
    button: {
      size: 'large',
      shape: 'pill',
      showIcon: true,
      iconPosition: 'left',
    },
    card: {
      showImage: true,
      imageSize: 'large',
      borderRadius: 20,
      elevation: 3,
    },
    navigation: {
      style: 'bottom-tab',
      showLabels: true,
      iconSize: 32,
    },
    question: {
      optionStyle: 'card',
      showHints: true,
      showTimer: false,      // Timers create anxiety in young children
      confirmBeforeSubmit: true,
    },
    progress: {
      style: 'stars',
      showNumbers: false,
      celebrateCompletion: true,
    },
  },
  
  content: {
    maxListItems: 4,         // Limit choices to reduce cognitive load
    truncateLength: 50,
    showDescriptions: false, // Minimize text
    readingLevel: 2,
    simplifiedVocabulary: true,
  },
  
  accessibility: {
    minTouchTarget: 56,      // Larger touch targets for developing motor skills
    focusStyle: 'highlight',
    highContrastAvailable: true,
    speechHints: true,       // Audio feedback for early readers
  },
  
  educationalReasoning: `
    Junior students (grades 1-3, ages 6-8) are in early developmental stages with:
    - Emerging reading skills requiring larger text and visual cues
    - Developing fine motor skills needing larger touch targets
    - Shorter attention spans benefiting from playful, engaging UI
    - Need for positive reinforcement through celebrations
    - Anxiety reduction by hiding timers and complex metrics
  `,
};

/**
 * Middle variant (Grades 4-7)
 * 
 * EDUCATIONAL REASONING:
 * - Pre-teens are developing independence and can handle more complexity
 * - Balance between engagement and information density
 * - Introduction to more structured academic interfaces
 * - Moderate feedback without being overly childish
 */
export const MIDDLE_VARIANT: UIVariantConfig = {
  gradeBand: 'middle',
  gradeRange: { min: 4, max: 7 },
  density: 'comfortable',
  interactionDepth: 'moderate',
  
  typography: {
    baseFontSize: 16,
    headingScale: { h1: 1.75, h2: 1.5, h3: 1.25, h4: 1.1 },
    lineHeight: 1.6,
    letterSpacing: 0.25,
    bodyWeight: 400,
    headingWeight: 600,
  },
  
  spacing: {
    baseUnit: 8,
    componentPadding: 2.5,  // 20px
    sectionGap: 3,          // 24px
    cardPadding: 2.5,       // 20px
    buttonPadding: 2,       // 16px
  },
  
  colors: {
    primaryPalette: 'balanced',
    saturation: 70,
    useGradients: true,
    iconStyle: 'colorful',
    backgroundStyle: 'clean',
  },
  
  animations: {
    enabled: true,
    durationMultiplier: 1.0,
    celebrations: true,
    microInteractions: true,
    transitionStyle: 'smooth',
  },
  
  components: {
    button: {
      size: 'medium',
      shape: 'rounded',
      showIcon: true,
      iconPosition: 'left',
    },
    card: {
      showImage: true,
      imageSize: 'medium',
      borderRadius: 12,
      elevation: 2,
    },
    navigation: {
      style: 'bottom-tab',
      showLabels: true,
      iconSize: 28,
    },
    question: {
      optionStyle: 'card',
      showHints: true,
      showTimer: true,       // Can handle time awareness
      confirmBeforeSubmit: true,
    },
    progress: {
      style: 'bar',
      showNumbers: true,
      celebrateCompletion: true,
    },
  },
  
  content: {
    maxListItems: 6,
    truncateLength: 80,
    showDescriptions: true,
    readingLevel: 6,
    simplifiedVocabulary: false,
  },
  
  accessibility: {
    minTouchTarget: 48,
    focusStyle: 'ring',
    highContrastAvailable: true,
    speechHints: false,
  },
  
  educationalReasoning: `
    Middle school students (grades 4-7, ages 9-12) are transitioning:
    - From concrete to abstract thinking
    - Developing organizational skills
    - Can process more information per screen
    - Benefit from both engagement and academic structure
    - Ready for performance metrics and time management
  `,
};

/**
 * Senior variant (Grades 8-12)
 * 
 * EDUCATIONAL REASONING:
 * - Teenagers can handle complex, information-dense interfaces
 * - Academic-style UI prepares for higher education tools
 * - Efficient workflows support exam preparation
 * - Reduced visual distractions allow focus on content
 * - Full feature access supports independent learning
 */
export const SENIOR_VARIANT: UIVariantConfig = {
  gradeBand: 'senior',
  gradeRange: { min: 8, max: 12 },
  density: 'compact',
  interactionDepth: 'complex',
  
  typography: {
    baseFontSize: 14,
    headingScale: { h1: 1.5, h2: 1.35, h3: 1.2, h4: 1.1 },
    lineHeight: 1.5,
    letterSpacing: 0,
    bodyWeight: 400,
    headingWeight: 600,
  },
  
  spacing: {
    baseUnit: 8,
    componentPadding: 2,    // 16px
    sectionGap: 2.5,        // 20px
    cardPadding: 2,         // 16px
    buttonPadding: 1.5,     // 12px
  },
  
  colors: {
    primaryPalette: 'professional',
    saturation: 55,
    useGradients: false,
    iconStyle: 'subtle',
    backgroundStyle: 'minimal',
  },
  
  animations: {
    enabled: true,
    durationMultiplier: 0.8,  // Faster for efficiency
    celebrations: false,      // Mature enough to not need confetti
    microInteractions: true,
    transitionStyle: 'quick',
  },
  
  components: {
    button: {
      size: 'small',
      shape: 'rounded',
      showIcon: false,        // Text labels sufficient
      iconPosition: 'left',
    },
    card: {
      showImage: false,       // Focus on content
      imageSize: 'none',
      borderRadius: 8,
      elevation: 1,
    },
    navigation: {
      style: 'side-rail',     // More efficient for desktop use
      showLabels: false,
      iconSize: 24,
    },
    question: {
      optionStyle: 'list',    // More efficient for reading
      showHints: true,
      showTimer: true,
      confirmBeforeSubmit: false,  // Trust user actions
    },
    progress: {
      style: 'percentage',
      showNumbers: true,
      celebrateCompletion: false,
    },
  },
  
  content: {
    maxListItems: 10,
    truncateLength: 150,
    showDescriptions: true,
    readingLevel: 10,
    simplifiedVocabulary: false,
  },
  
  accessibility: {
    minTouchTarget: 44,
    focusStyle: 'outline',
    highContrastAvailable: true,
    speechHints: false,
  },
  
  educationalReasoning: `
    Senior students (grades 8-12, ages 13-18) are approaching adulthood:
    - Capable of handling complex, dense information
    - Preparing for competitive exams and higher education
    - Need efficient, distraction-free interfaces
    - Value speed and keyboard shortcuts
    - Academic aesthetic prepares for college/university tools
  `,
};

// ============================================================================
// VARIANT SELECTOR
// ============================================================================

/**
 * All variants indexed by grade band
 */
export const UI_VARIANTS: Record<GradeBand, UIVariantConfig> = {
  junior: JUNIOR_VARIANT,
  middle: MIDDLE_VARIANT,
  senior: SENIOR_VARIANT,
};

/**
 * Get grade band from grade number
 */
export function getGradeBand(grade: Grade): GradeBand {
  if (grade <= 3) return 'junior';
  if (grade <= 7) return 'middle';
  return 'senior';
}

/**
 * Get UI variant configuration for a grade
 */
export function getUIVariant(grade: Grade): UIVariantConfig {
  const band = getGradeBand(grade);
  return UI_VARIANTS[band];
}

/**
 * Get specific component configuration
 */
export function getComponentConfig<K extends keyof ComponentConfig>(
  grade: Grade,
  component: K
): ComponentConfig[K] {
  const variant = getUIVariant(grade);
  return variant.components[component];
}

/**
 * Get typography configuration
 */
export function getTypography(grade: Grade): TypographyScale {
  return getUIVariant(grade).typography;
}

/**
 * Get spacing configuration
 */
export function getSpacing(grade: Grade): SpacingScale {
  return getUIVariant(grade).spacing;
}

/**
 * Get color configuration
 */
export function getColors(grade: Grade): ColorConfig {
  return getUIVariant(grade).colors;
}

/**
 * Check if feature should be enabled for grade
 */
export function isFeatureEnabled(
  grade: Grade,
  feature: 'celebrations' | 'timer' | 'hints' | 'descriptions' | 'speechHints'
): boolean {
  const variant = getUIVariant(grade);
  
  switch (feature) {
    case 'celebrations':
      return variant.animations.celebrations;
    case 'timer':
      return variant.components.question.showTimer;
    case 'hints':
      return variant.components.question.showHints;
    case 'descriptions':
      return variant.content.showDescriptions;
    case 'speechHints':
      return variant.accessibility.speechHints;
    default:
      return false;
  }
}
