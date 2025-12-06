'use client';
import { logger } from '@/lib/logger';

import { useState, useEffect } from 'react';
import LanguageSelector from '../LanguageSelector';
import SubjectSelector from '@/components/SubjectSelector';
import SpeechInput from './SpeechInput';

export default function Controls({
  onSend,
  loading,
  isPremium,
  isValidSession,
  volume,
  setVolume,
  lang,
  setLang,
  subject,
  setSubject,
}: {
  onSend: (msg: string) => void;
  loading: boolean;
  isPremium: boolean;
  isValidSession: boolean;
  volume: number;
  setVolume: (v: number) => void;
  lang: string;
  setLang: (l: string) => void;
  subject?: string;
  setSubject?: (s: string) => void;
}) {
  const [input, setInput] = useState('');
  const [speechError, setSpeechError] = useState<string>('');
  const [remainingFreeQuestions, setRemainingFreeQuestions] = useState<number | null>(null);
  const [dailyFreeLimit, setDailyFreeLimit] = useState<number>(3);

  useEffect(() => {
    async function fetchFreeQuestions() {
      if (!isPremium && isValidSession) {
        try {
          const response = await fetch('/api/free-questions');
          const data = await response.json();
          if (response.ok) {
            setRemainingFreeQuestions(typeof data.remaining === 'number' ? data.remaining : null);
            if (typeof data.total === 'number') setDailyFreeLimit(data.total);
          } else {
            logger.error('Failed to fetch remaining free questions', { className: 'Chat.Controls', methodName: 'fetchFreeQuestions', error: String(data.error) });
          }
        } catch (error) {
          logger.error('Failed to fetch remaining free questions', { className: 'Chat.Controls', methodName: 'fetchFreeQuestions', error: String(error) });
        }
      }
    }

    fetchFreeQuestions();
  }, [isPremium, isValidSession]);

  // Resolve display language: if using 'auto', show browser-detected language
  function mapBrowserToSupported(tag?: string) {
    if (!tag) return 'English';
    const t = tag.toLowerCase();
    if (t.startsWith('hi')) return 'Hindi';
    if (t.startsWith('ta')) return 'Tamil';
    if (t.startsWith('bn')) return 'Bengali';
    if (t.startsWith('fr')) return 'French';
    if (t.startsWith('es')) return 'Spanish';
    return 'English';
  }

  const displayLang =
    lang === 'auto'
      ? typeof navigator !== 'undefined'
        ? mapBrowserToSupported(navigator.language)
        : 'English'
      : lang;
  let langBadgeTitle = 'Selected language';
  try {
    const pref = localStorage.getItem('ai-tutor:preferredLang');
    if (!pref || pref !== displayLang) langBadgeTitle = 'Using browser language';
  } catch {}

  // Listen for updates dispatched by ChatBot after a successful decrement
  useEffect(() => {
    function onUpdate(e: Event) {
      const detail = (e as CustomEvent).detail as { remaining?: number | null } | undefined;
      if (detail && typeof detail.remaining === 'number')
        setRemainingFreeQuestions(detail.remaining);
    }
    window.addEventListener('freeQuestionsUpdated', onUpdate as EventListener);
    return () => window.removeEventListener('freeQuestionsUpdated', onUpdate as EventListener);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSend(input.trim());
    setInput('');
  };

  // no-op placeholder for legacy message logic

  return (
    <div className="border-t p-3 dark:border-gray-700 bg-white dark:bg-gray-900">
      <form onSubmit={handleSubmit} className="flex flex-row items-center gap-2">
        <div className="flex items-center gap-2 mr-2 shrink-0">
          <div className="flex items-center gap-2">
            <LanguageSelector lang={lang} setLang={setLang} />
            <span
              title={langBadgeTitle}
              className="hidden md:inline-block text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded"
            >
              {displayLang}
            </span>
          </div>

          {/* Hide subject selector on small screens; mobile will use hamburger/drawer */}
          {typeof setSubject === 'function' && typeof subject === 'string' && (
            <div className="hidden md:block">
              <SubjectSelector subject={subject} setSubject={setSubject} />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <SpeechInput
            value={input}
            setValue={setInput}
            lang={lang}
            disabled={loading}
            onError={setSpeechError}
          />
        </div>

        <div className="shrink-0">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50 flex items-center justify-center"
            disabled={loading}
            aria-label="Send"
          >
            {loading ? (
              '...'
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            )}
          </button>
        </div>
      </form>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mt-4 gap-3">
        <div className="flex-1 pr-0 md:pr-4">
          {speechError && <div className="text-xs text-red-500 mb-1">{speechError}</div>}

          {isValidSession ? (
            isPremium ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                Thank you for being a premium member! Enjoy unlimited questions 🎉
              </span>
            ) : (
              <div className="flex flex-col">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Free questions today
                </div>
                <div
                  className="flex items-center gap-3"
                  title="Free questions reset at 12:00 AM GMT"
                  role="group"
                  aria-label="Free questions today"
                >
                  <div
                    className="text-sm font-medium text-gray-600 dark:text-gray-300"
                    aria-live="polite"
                  >
                    {remainingFreeQuestions === null ? '—' : `${remainingFreeQuestions ?? 0}`}
                  </div>

                  <div
                    className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden"
                    aria-hidden
                  >
                    {(() => {
                      const asked = dailyFreeLimit - (remainingFreeQuestions ?? dailyFreeLimit);
                      const pct = Math.max(
                        0,
                        Math.min(100, (asked / Math.max(1, dailyFreeLimit)) * 100),
                      );
                      const colorClass =
                        pct >= 80 ? 'bg-rose-500' : pct >= 50 ? 'bg-yellow-400' : 'bg-emerald-500';
                      return <div className={`h-2 ${colorClass}`} style={{ width: `${pct}%` }} />;
                    })()}
                  </div>

                  <div className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    {dailyFreeLimit}
                  </div>
                </div>
              </div>
            )
          ) : (
            <span className="text-red-500 dark:text-red-400 text-sm">
              Session expired. Please log in again.
            </span>
          )}
        </div>

        <div className="hidden md:flex items-center gap-2">
          <label
            htmlFor="volume-bar"
            className="hidden md:inline-block text-sm text-gray-700 dark:text-gray-200"
          >
            Volume:
          </label>
          <input
            id="volume-bar"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-32"
          />
          <span className="hidden md:inline-block text-xs text-gray-600 dark:text-gray-300">
            {Math.round(volume * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}
