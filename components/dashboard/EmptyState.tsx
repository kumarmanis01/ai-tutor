/**
 * FILE OBJECTIVE:
 * - Reusable empty-state block used wherever a list or card has no data.
 * - Accepts a preset name (maps to icon + default copy) or fully custom props.
 * - Keeps every screen looking intentional rather than broken.
 *
 * EDIT LOG:
 * - 2026-03-06 | Manish Kumar | created for professional empty states
 */
import React from "react";
import Link from "next/link";

// ─── Icons ───────────────────────────────────────────────────────────────────

const icons = {
  plan: (
    <svg className="w-10 h-10" fill="none" viewBox="0 0 48 48" stroke="currentColor" strokeWidth={1.5}>
      <rect x="8" y="8" width="32" height="32" rx="4" className="stroke-indigo-300" />
      <path d="M16 20h16M16 28h10" strokeLinecap="round" className="stroke-indigo-400" />
    </svg>
  ),
  homework: (
    <svg className="w-10 h-10" fill="none" viewBox="0 0 48 48" stroke="currentColor" strokeWidth={1.5}>
      <path d="M12 4h18l8 8v32H12V4z" className="stroke-emerald-300" strokeLinejoin="round" />
      <path d="M30 4v8h8" className="stroke-emerald-300" strokeLinejoin="round" />
      <path d="M18 28l4 4 8-8" className="stroke-emerald-400" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  practice: (
    <svg className="w-10 h-10" fill="none" viewBox="0 0 48 48" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="24" cy="24" r="16" className="stroke-violet-300" />
      <path d="M20 18l10 6-10 6V18z" className="stroke-violet-400" strokeLinejoin="round" />
    </svg>
  ),
  curriculum: (
    <svg className="w-10 h-10" fill="none" viewBox="0 0 48 48" stroke="currentColor" strokeWidth={1.5}>
      <path d="M8 12h32M8 24h20M8 36h14" className="stroke-blue-300" strokeLinecap="round" />
      <circle cx="36" cy="32" r="8" className="stroke-blue-400" />
      <path d="M33 32l2 2 4-4" className="stroke-blue-400" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  assignments: (
    <svg className="w-10 h-10" fill="none" viewBox="0 0 48 48" stroke="currentColor" strokeWidth={1.5}>
      <rect x="10" y="6" width="28" height="36" rx="3" className="stroke-amber-300" />
      <path d="M17 18h14M17 26h10" className="stroke-amber-400" strokeLinecap="round" />
      <path d="M17 34h6" className="stroke-amber-300" strokeLinecap="round" />
    </svg>
  ),
  topics: (
    <svg className="w-10 h-10" fill="none" viewBox="0 0 48 48" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="24" cy="24" r="14" className="stroke-emerald-300" />
      <path d="M24 16v8l5 5" className="stroke-emerald-400" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
} as const;

export type EmptyStatePreset = keyof typeof icons;

// ─── Component ───────────────────────────────────────────────────────────────

export interface EmptyStateProps {
  /** Built-in icon preset. Ignored when `icon` is provided. */
  preset?: EmptyStatePreset;
  /** Custom icon node -- overrides preset icon. */
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  /** Extra wrapper class names. */
  className?: string;
}

export default function EmptyState({
  preset,
  icon,
  title,
  subtitle,
  action,
  className = "",
}: EmptyStateProps) {
  const renderedIcon = icon ?? (preset ? icons[preset] : null);

  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-xl bg-gray-50 px-6 py-10 text-center ${className}`}
    >
      {renderedIcon && (
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm">
          {renderedIcon}
        </div>
      )}

      <div className="space-y-1">
        <p className="text-sm font-semibold text-gray-700">{title}</p>
        {subtitle && (
          <p className="text-xs text-gray-400 max-w-[260px] leading-relaxed">{subtitle}</p>
        )}
      </div>

      {action && (
        <>
          {action.href ? (
            <Link
              href={action.href}
              className="mt-1 inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {action.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="mt-1 inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {action.label}
            </button>
          )}
        </>
      )}
    </div>
  );
}
