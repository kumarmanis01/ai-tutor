"use client";
/**
 * FILE OBJECTIVE:
 * - Reusable language selector that supports per-content availability.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/LanguageSelector.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-16T00:00:00Z | copilot | add availableLanguages support and "Coming soon" UI
 */

import React, { useEffect, useRef, useState } from 'react';
import { logger } from '@/lib/logger';

type LangDef = { code: string; name: string; aliases?: string[] };

const LANGS: LangDef[] = [
  { code: 'en', name: 'English', aliases: ['english', 'en', 'en-us'] },
  { code: 'hi', name: 'हिंदी (Hindi)', aliases: ['hindi', 'hi', 'hi-in', 'Hindi'] },
  { code: 'ta', name: 'Tamil', aliases: ['tamil', 'ta', 'ta-in'] },
  { code: 'bn', name: 'Bengali', aliases: ['bengali', 'bn', 'bn-in'] },
  { code: 'fr', name: 'French', aliases: ['french', 'fr', 'fr-fr'] },
  { code: 'es', name: 'Spanish', aliases: ['spanish', 'es', 'es-es'] },
];

function normalizeToCode(v?: string | null): string | 'auto' {
  if (!v) return 'en';
  const s = String(v).trim();
  if (s.toLowerCase() === 'auto') return 'auto';
  const low = s.toLowerCase();
  // direct code match
  for (const l of LANGS) {
    if (l.code === low) return l.code;
    if (l.name.toLowerCase() === low) return l.code;
    if (l.aliases && l.aliases.some((a) => a === low)) return l.code;
  }
  // try prefix match (e.g., en-US)
  if (low.startsWith('hi')) return 'hi';
  if (low.startsWith('ta')) return 'ta';
  if (low.startsWith('bn')) return 'bn';
  if (low.startsWith('fr')) return 'fr';
  if (low.startsWith('es')) return 'es';
  if (low.startsWith('en')) return 'en';
  return 'en';
}

function codeToName(code: string) {
  if (!code) return 'English';
  const l = LANGS.find((x) => x.code === code);
  return l ? l.name : code;
}

export default function LanguageSelector({
  lang,
  setLang,
  availableCodes,
}: {
  lang: string; // display name or code or 'auto'
  setLang: (s: string) => void;
  availableCodes?: string[]; // optional list of language codes that are available (e.g. ['en','hi'])
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!btnRef.current) return;
      if (e.target instanceof Node) {
        if (btnRef.current.contains(e.target)) return;
        if (menuRef.current && menuRef.current.contains(e.target)) return;
      }
      setOpen(false);
    }
    if (open) document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [open]);

  function handleSelect(value: string | 'auto') {
    // normalize to code for availability checks
    const code = value === 'auto' ? 'auto' : normalizeToCode(value);
    if (code !== 'auto' && availableCodes && !availableCodes.includes(code)) {
      setError('Coming soon — language not yet available for this content');
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Resolve 'auto' to browser locale display name
    if (code === 'auto') {
      const nav = typeof navigator !== 'undefined' ? navigator.language : undefined;
      const resolvedCode = normalizeToCode(nav) as string;
      const display = codeToName(resolvedCode);
      try {
        localStorage.setItem('ai-tutor:preferredLang', display);
      } catch {}
      // attempt server save
      fetch('/api/user/language', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: resolvedCode }) }).catch(() => {});
      setLang(display);
      setOpen(false);
      return;
    }

    const display = codeToName(code);
    try {
      localStorage.setItem('ai-tutor:preferredLang', display);
    } catch (e) {
      logger.warn('localStorage.setItem failed', { component: 'LanguageSelector', error: e });
    }

    // Persist to server
    try {
      fetch('/api/user/language', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: code }),
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
    } catch (e) {
      logger.warn('Failed to save language via fetch', { component: 'LanguageSelector', error: e });
      setError('Failed to save language to your account');
      setTimeout(() => setError(null), 4000);
    }

    setLang(display);
    setOpen(false);
  }

  const selectedCode = normalizeToCode(lang);

  return (
    <div className="relative inline-block text-sm">
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open ? 'true' : 'false'}
        onClick={() => setOpen((v) => !v)}
        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
        title="Choose Language"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-4.5V6.75a6.5 6.5 0 014 0V13.5a4.5 4.5 0 10-4 0z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div ref={menuRef} className="fixed left-0 right-0 bottom-0 w-full bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-t-lg shadow z-50 p-2">
          <div className="flex items-center justify-between mb-2 px-2">
            <div className="text-sm font-semibold">Choose language</div>
            <button type="button" onClick={() => setOpen(false)} className="text-gray-600">✕</button>
          </div>

          <button
            className={`w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between ${selectedCode === 'auto' ? 'font-semibold' : ''}`}
            onClick={() => handleSelect('auto')}
          >
            <span>Auto (Browser)</span>
            {selectedCode === 'auto' && (
              <svg className="h-4 w-4 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414-1.414L8 11.172 4.707 7.879a1 1 0 10-1.414 1.414l4 4a1 1 0 001.414 0l8-8z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          <div className="border-t border-gray-100 dark:border-gray-700" />

          {LANGS.map((l) => {
            const disabled = availableCodes ? !availableCodes.includes(l.code) : false;
            const isSelected = selectedCode === l.code;
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => handleSelect(l.code)}
                disabled={disabled}
                className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between ${isSelected ? 'font-semibold' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              >
                <span className="flex items-center gap-2">
                  <span>{l.name}</span>
                  {disabled && <span className="text-[11px] text-gray-400">Coming soon</span>}
                </span>
                {isSelected && (
                  <svg className="h-4 w-4 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414-1.414L8 11.172 4.707 7.879a1 1 0 10-1.414 1.414l4 4a1 1 0 001.414 0l8-8z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            );
          })}
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
