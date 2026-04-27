'use client';

import { useState, useEffect } from 'react';
import type { SizedLoaderProps, BaseLoaderProps, ProgressLoaderProps } from './types';

const DEFAULT_COLOR = '#534AB7';

const DOT_SIZES = {
  small:  { dot: 6,  gap: 5 },
  medium: { dot: 10, gap: 7 },
  large:  { dot: 14, gap: 9 },
} as const;

const SPINNER_SIZES = {
  small:  { outer: 20, border: 2 },
  medium: { outer: 32, border: 3 },
  large:  { outer: 48, border: 4 },
} as const;

const VIDYA_TIPS = [
  'Vidya is preparing your lesson...',
  'Loading your personalised content...',
  'Your next topic is just a moment away...',
  'Reviewing your learning progress...',
  'Building the perfect lesson for you...',
  'Getting your study materials ready...',
];

export function DotPulseLoader({ size = 'medium', color = DEFAULT_COLOR, className }: SizedLoaderProps) {
  const { dot, gap } = DOT_SIZES[size];
  const delays = ['0s', '0.16s', '0.32s'];

  return (
    <div
      className={`flex items-center${className ? ` ${className}` : ''}`}
      style={{ gap }}
      role="img"
      aria-label="Loading"
    >
      {delays.map((delay, i) => (
        <span
          key={i}
          className="rounded-full inline-block"
          style={{
            width: dot,
            height: dot,
            backgroundColor: color,
            animation: `loader-dot-bounce 0.8s ease-in-out ${delay} infinite`,
          }}
        />
      ))}
    </div>
  );
}

export function SpinnerLoader({ size = 'medium', color = DEFAULT_COLOR, className }: SizedLoaderProps) {
  const { outer, border } = SPINNER_SIZES[size];

  return (
    <span
      role="img"
      aria-label="Loading"
      className={`inline-block rounded-full${className ? ` ${className}` : ''}`}
      style={{
        width: outer,
        height: outer,
        borderWidth: border,
        borderStyle: 'solid',
        borderColor: `${color}33`,
        borderTopColor: color,
        animation: 'loader-spin 0.75s linear infinite',
      }}
    />
  );
}

export function BookLoader({ color = DEFAULT_COLOR, className }: BaseLoaderProps) {
  return (
    <div
      className={`flex items-center justify-center${className ? ` ${className}` : ''}`}
      role="img"
      aria-label="Loading"
    >
      <svg width="64" height="56" viewBox="0 0 64 56" fill="none" aria-hidden="true">
        {/* Left cover */}
        <rect x="2" y="8" width="28" height="40" rx="3" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.5" />
        {/* Right cover */}
        <rect x="34" y="8" width="28" height="40" rx="3" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.5" />
        {/* Spine */}
        <rect x="29" y="8" width="6" height="40" rx="2" fill={color} />
        {/* Left page lines */}
        <rect x="7"  y="16" width="18" height="2" rx="1" fill={color} fillOpacity="0.5" />
        <rect x="7"  y="21" width="18" height="2" rx="1" fill={color} fillOpacity="0.5" />
        <rect x="7"  y="26" width="14" height="2" rx="1" fill={color} fillOpacity="0.5" />
        {/* Right page lines -- animated flip around spine edge */}
        <g className="loader-book-page-anim" style={{ transformOrigin: '48px 28px' }}>
          <rect x="38" y="16" width="18" height="2" rx="1" fill={color} fillOpacity="0.5" />
          <rect x="38" y="21" width="18" height="2" rx="1" fill={color} fillOpacity="0.5" />
          <rect x="38" y="26" width="14" height="2" rx="1" fill={color} fillOpacity="0.5" />
        </g>
      </svg>
    </div>
  );
}

export function ProgressLoader({
  progress,
  showProgress = false,
  color = DEFAULT_COLOR,
  className,
}: ProgressLoaderProps) {
  const clamped = Math.min(100, Math.max(0, progress));

  return (
    <div
      className={`w-full${className ? ` ${className}` : ''}`}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Loading progress"
    >
      <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300 ease-out"
          style={{ width: `${clamped}%`, backgroundColor: color }}
        />
      </div>
      {showProgress && (
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 text-right">
          {clamped}%
        </p>
      )}
    </div>
  );
}

export function MascotLoader({ color = DEFAULT_COLOR, className }: BaseLoaderProps) {
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex(prev => (prev + 1) % VIDYA_TIPS.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={`flex flex-col items-center gap-3${className ? ` ${className}` : ''}`}
      role="img"
      aria-label="Loading"
    >
      <span
        className="text-5xl select-none loader-mascot-bounce-anim"
        aria-hidden="true"
        style={{ color }}
      >
        {'👩‍🏫'}
      </span>
      <p className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-[200px]">
        {VIDYA_TIPS[tipIndex]}
      </p>
    </div>
  );
}
