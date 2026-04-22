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
