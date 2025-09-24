// components/ui/button.tsx
"use client";

import React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
  variant?: "primary" | "outline" | "ghost";
};

/**
 * Tiny Button component used across the app.
 * - Minimal, accessible, and easy to replace with a design system later.
 */
export default function Button({ children, variant = "primary", className = "", ...props }: Props) {
  const base = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";
  const variants: Record<string, string> = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 px-3 py-1.5",
    outline: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 px-3 py-1.5",
    ghost: "bg-transparent text-gray-700 hover:bg-gray-100 px-2 py-1",
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
