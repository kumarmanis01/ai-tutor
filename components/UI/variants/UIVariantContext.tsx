/**
 * FILE OBJECTIVE:
 * - React context provider for age-based UI variants.
 * - Provides variant configuration to all child components.
 * - Enables grade-aware rendering without prop drilling.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/ui/variants/UIVariantContext.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created UI variant context provider
 */

'use client';

import React, {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';

import type { Grade } from '@/lib/ai/prompts/schemas';
import {
  type UIVariantConfig,
  type GradeBand,
  type ComponentConfig,
  getUIVariant,
  getGradeBand,
  isFeatureEnabled,
} from './ageVariants';
import {
  type CSSVariables,
  generateVariablesForGrade,
  getThemeClassName,
} from './designTokens';

// ============================================================================
// CONTEXT TYPE
// ============================================================================

/**
 * UI Variant context value
 */
interface UIVariantContextValue {
  /** Current grade */
  readonly grade: Grade;
  /** Current grade band */
  readonly gradeBand: GradeBand;
  /** Full variant configuration */
  readonly config: UIVariantConfig;
  /** CSS variables for the variant */
  readonly cssVariables: CSSVariables;
  /** Theme class name */
  readonly themeClassName: string;
  /** Check if a feature is enabled */
  readonly isEnabled: (
    feature: 'celebrations' | 'timer' | 'hints' | 'descriptions' | 'speechHints'
  ) => boolean;
  /** Get component configuration */
  readonly getComponent: <K extends keyof ComponentConfig>(
    component: K
  ) => ComponentConfig[K];
}

// ============================================================================
// CONTEXT
// ============================================================================

const UIVariantContext = createContext<UIVariantContextValue | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================

interface UIVariantProviderProps {
  /** Student's grade (1-12) */
  grade: Grade;
  /** Child components */
  children: ReactNode;
}

/**
 * Provider component that supplies UI variant configuration to all children.
 * 
 * @example
 * ```tsx
 * <UIVariantProvider grade={studentGrade}>
 *   <Dashboard />
 * </UIVariantProvider>
 * ```
 */
export function UIVariantProvider({
  grade,
  children,
}: UIVariantProviderProps): JSX.Element {
  const value = useMemo<UIVariantContextValue>(() => {
    const config = getUIVariant(grade);
    const gradeBand = getGradeBand(grade);
    const cssVariables = generateVariablesForGrade(grade);
    const themeClassName = getThemeClassName(grade);
    
    return {
      grade,
      gradeBand,
      config,
      cssVariables,
      themeClassName,
      isEnabled: (feature) => isFeatureEnabled(grade, feature),
      getComponent: <K extends keyof ComponentConfig>(component: K) =>
        config.components[component],
    };
  }, [grade]);
  
  return (
    <UIVariantContext.Provider value={value}>
      {children}
    </UIVariantContext.Provider>
  );
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook to access the UI variant context
 * 
 * @throws Error if used outside of UIVariantProvider
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { config, isEnabled } = useUIVariant();
 *   
 *   return (
 *     <div>
 *       {isEnabled('celebrations') && <Confetti />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useUIVariant(): UIVariantContextValue {
  const context = useContext(UIVariantContext);
  
  if (!context) {
    throw new Error(
      'useUIVariant must be used within a UIVariantProvider. ' +
      'Wrap your component tree with <UIVariantProvider grade={studentGrade}>'
    );
  }
  
  return context;
}

/**
 * Hook to get just the grade band
 */
export function useGradeBand(): GradeBand {
  return useUIVariant().gradeBand;
}

/**
 * Hook to get typography configuration
 */
export function useTypography() {
  return useUIVariant().config.typography;
}

/**
 * Hook to get spacing configuration
 */
export function useSpacing() {
  return useUIVariant().config.spacing;
}

/**
 * Hook to get color configuration
 */
export function useColors() {
  return useUIVariant().config.colors;
}

/**
 * Hook to get animation configuration
 */
export function useAnimations() {
  return useUIVariant().config.animations;
}

/**
 * Hook to get component configuration
 */
export function useComponentConfig<K extends keyof ComponentConfig>(
  component: K
): ComponentConfig[K] {
  return useUIVariant().getComponent(component);
}

/**
 * Hook to check if a feature is enabled
 */
export function useFeatureEnabled(
  feature: 'celebrations' | 'timer' | 'hints' | 'descriptions' | 'speechHints'
): boolean {
  return useUIVariant().isEnabled(feature);
}

/**
 * Hook to get the theme class name
 */
export function useThemeClassName(): string {
  return useUIVariant().themeClassName;
}

/**
 * Hook to get CSS variables
 */
export function useCSSVariables(): CSSVariables {
  return useUIVariant().cssVariables;
}

// ============================================================================
// UTILITY COMPONENTS
// ============================================================================

interface ThemeWrapperProps {
  /** Child components */
  children: ReactNode;
  /** Additional class names */
  className?: string;
}

/**
 * Component that applies theme class and CSS variables to its children
 * 
 * @example
 * ```tsx
 * <UIVariantProvider grade={3}>
 *   <ThemeWrapper>
 *     <App />
 *   </ThemeWrapper>
 * </UIVariantProvider>
 * ```
 */
export function ThemeWrapper({
  children,
  className = '',
}: ThemeWrapperProps): JSX.Element {
  const { themeClassName, cssVariables } = useUIVariant();
  
  // Convert CSS variables to inline styles
  const style = Object.entries(cssVariables).reduce(
    (acc, [key, value]) => {
      acc[key as keyof React.CSSProperties] = value;
      return acc;
    },
    {} as React.CSSProperties
  );
  
  return (
    <div className={`${themeClassName} ${className}`.trim()} style={style}>
      {children}
    </div>
  );
}

// ============================================================================
// CONDITIONAL RENDERING HELPERS
// ============================================================================

interface ForJuniorProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Render children only for junior grade band (grades 1-3)
 */
export function ForJunior({ children, fallback = null }: ForJuniorProps): JSX.Element | null {
  const { gradeBand } = useUIVariant();
  return gradeBand === 'junior' ? <>{children}</> : <>{fallback}</>;
}

interface ForMiddleProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Render children only for middle grade band (grades 4-7)
 */
export function ForMiddle({ children, fallback = null }: ForMiddleProps): JSX.Element | null {
  const { gradeBand } = useUIVariant();
  return gradeBand === 'middle' ? <>{children}</> : <>{fallback}</>;
}

interface ForSeniorProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Render children only for senior grade band (grades 8-12)
 */
export function ForSenior({ children, fallback = null }: ForSeniorProps): JSX.Element | null {
  const { gradeBand } = useUIVariant();
  return gradeBand === 'senior' ? <>{children}</> : <>{fallback}</>;
}

interface WhenFeatureEnabledProps {
  feature: 'celebrations' | 'timer' | 'hints' | 'descriptions' | 'speechHints';
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Render children only when a feature is enabled for the current grade
 */
export function WhenFeatureEnabled({
  feature,
  children,
  fallback = null,
}: WhenFeatureEnabledProps): JSX.Element | null {
  const enabled = useFeatureEnabled(feature);
  return enabled ? <>{children}</> : <>{fallback}</>;
}
