'use client';
import React, { useState, useEffect, useRef } from 'react';

const langs = ['English', 'Hindi', 'Tamil', 'Bengali', 'French', 'Spanish'];

export default function LanguageSelector({
  lang,
  setLang,
}: {
  lang: string;
  setLang: (s: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  // always render as sheet; no state needed

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!btnRef.current) return;
      // don't close when clicking the button or the menu itself
      if (e.target instanceof Node) {
        if (btnRef.current.contains(e.target)) return;
        if (menuRef.current && menuRef.current.contains(e.target)) return;
      }
      setOpen(false);
    }
    if (open) document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [open]);

  // Keep using sheet mode for all screen sizes (no resize handling)

  function handleSelect(value: string) {
    // resolve concrete language: for 'auto' use browser locale mapping
    function mapBrowser(tag?: string) {
      if (!tag) return 'English';
      const t = tag.toLowerCase();
      if (t.startsWith('hi')) return 'Hindi';
      if (t.startsWith('ta')) return 'Tamil';
      if (t.startsWith('bn')) return 'Bengali';
      if (t.startsWith('fr')) return 'French';
      if (t.startsWith('es')) return 'Spanish';
      return 'English';
    }

    const resolved =
      value === 'auto'
        ? mapBrowser(typeof navigator !== 'undefined' ? navigator.language : undefined)
        : value;

    // Persist locally and attempt to persist to server (if authenticated)
    try {
      localStorage.setItem('ai-tutor:preferredLang', resolved);
    } catch {}

    // POST to save on server for logged-in users; show a small toast on failure
    try {
      fetch('/api/user/language', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: resolved }),
      })
        .then((res) => {
          if (!res.ok) {
            setError('Failed to save language to your account');
            setTimeout(() => setError(null), 4000);
          }
        })
        .catch(() => {
          setError('Failed to save language to your account');
          setTimeout(() => setError(null), 4000);
        });
    } catch {
      // swallow errors but show toast
      setError('Failed to save language to your account');
      setTimeout(() => setError(null), 4000);
    }

    setLang(resolved);
    setOpen(false);
  }

  return (
    <div className="relative inline-block text-sm">
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          try {
            // Always use sheet mode (mobile-style) on all screen sizes
          } catch {}
          setOpen((v) => !v);
        }}
        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
        title="Choose Language"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-4.5V6.75a6.5 6.5 0 014 0V13.5a4.5 4.5 0 10-4 0z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          className="fixed left-0 right-0 bottom-0 w-full bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-t-lg shadow z-50 p-2"
        >
          <div className="flex items-center justify-between mb-2 px-2">
            <div className="text-sm font-semibold">Choose language</div>
            <button type="button" onClick={() => setOpen(false)} className="text-gray-600">
              ✕
            </button>
          </div>
          <button
            className={`w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between ${lang === 'auto' ? 'font-semibold' : ''}`}
            onClick={() => handleSelect('auto')}
          >
            <span>Auto (Browser)</span>
            {lang === 'auto' && (
              <svg className="h-4 w-4 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 00-1.414-1.414L8 11.172 4.707 7.879a1 1 0 10-1.414 1.414l4 4a1 1 0 001.414 0l8-8z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>
          <div className="border-t border-gray-100 dark:border-gray-700" />
          {langs.map((l) => (
            <button
              key={l}
              className={`w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between ${lang === l ? 'font-semibold' : ''}`}
              onClick={() => handleSelect(l)}
            >
              <span>{l}</span>
              {lang === l && (
                <svg className="h-4 w-4 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 00-1.414-1.414L8 11.172 4.707 7.879a1 1 0 10-1.414 1.414l4 4a1 1 0 001.414 0l8-8z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
      {error && (
        <div className="fixed left-4 right-4 bottom-16 w-auto bg-red-50 dark:bg-red-900/60 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-700 rounded px-3 py-1 text-xs z-50">
          {error}
        </div>
      )}
    </div>
  );
}
