/**
 * FILE OBJECTIVE:
 * - Shared TypeScript interfaces and type aliases for the global loader system
 *   (loader variants, sizes, component props, hook return types, context shape).
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/loaders/LoaderVariants.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-22T00:00:00Z | claude | created for global loader system
 */

import type { ReactNode } from 'react';

export type LoaderSize = 'small' | 'medium' | 'large';
export type LoaderVariant = 'mascot' | 'dots' | 'spinner' | 'book' | 'progress';

export interface BaseLoaderProps {
  color?: string;
  className?: string;
}

export interface SizedLoaderProps extends BaseLoaderProps {
  size?: LoaderSize;
}

export interface ProgressLoaderProps extends BaseLoaderProps {
  progress: number;
  showProgress?: boolean;
}

export interface FullScreenLoaderProps {
  visible: boolean;
  variant?: LoaderVariant;
  message?: string;
  progress?: number;
  showProgress?: boolean;
  minimumDisplayTime?: number;
}

export interface UseLoadingReturn {
  isLoading: boolean;
  startLoading: () => void;
  stopLoading: () => void;
  withLoading: <T>(promise: Promise<T>) => Promise<T>;
  progress: number;
  setProgress: (value: number) => void;
}

export interface WithSkeletonProps {
  isLoading: boolean;
  skeleton: ReactNode;
  children: ReactNode;
  delay?: number;
}

export interface GlobalLoaderState {
  visible: boolean;
  message?: string;
  variant: LoaderVariant;
  progress: number;
}

export interface GlobalLoaderContextValue {
  showLoader: (message?: string, variant?: LoaderVariant) => void;
  hideLoader: () => void;
  updateProgress: (progress: number) => void;
  loaderState: GlobalLoaderState;
}
