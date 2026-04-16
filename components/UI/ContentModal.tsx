"use client";
import React from 'react';

interface Props {
  open: boolean;
  title?: string;
  onClose: () => void;
  children?: React.ReactNode;
  className?: string;
}

export default function ContentModal({ open, title = '', onClose, children, className = '' }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative z-10 w-full max-w-2xl rounded-lg bg-white dark:bg-slate-800 p-4 shadow-xl ${className}`}>
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50">{title}</h3>
          <button
            aria-label="Close"
            className="ml-4 rounded p-1 text-gray-600 hover:bg-gray-100"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}
