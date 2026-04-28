'use client';
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  open: boolean;
  title?: string;
  onClose: () => void;
  children?: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
}

export default function ContentModal({
  open,
  title = '',
  onClose,
  children,
  className = '',
  footer,
}: Props) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const prevActiveRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    prevActiveRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus the close button when modal opens
    setTimeout(() => closeRef.current?.focus(), 0);

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        // Simple focus trap
        const container = modalRef.current;
        if (!container) return;
        const focusable = Array.from(
          container.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      try {
        prevActiveRef.current?.focus();
      } catch {
        /* ignore */
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      aria-modal="true"
      role="dialog"
      aria-labelledby="modal-title"
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        ref={modalRef}
        className={`relative z-10 w-full max-w-2xl md:rounded-lg rounded-t-lg bg-white dark:bg-slate-800 p-4 md:p-6 shadow-xl max-h-[80vh] overflow-auto ${className}`}
      >
        <div className="flex items-start justify-between">
          <h3 id="modal-title" className="text-lg font-semibold text-gray-900 dark:text-gray-50">
            {title}
          </h3>
          <button
            ref={closeRef}
            aria-label="Close"
            className="ml-4 rounded p-1 text-gray-600 hover:bg-gray-100"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="mt-3">{children}</div>
        {footer && <div className="mt-4 border-t pt-3">{footer}</div>}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
