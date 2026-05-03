'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SearchResults } from '@/components/student/search/SearchResults';
import type { SearchResult } from '@/components/student/search/SearchResults';

type TopicSearchWidgetProps = {
  grade: number;
  board: string;
};

export default function TopicSearchWidget({ grade, board }: TopicSearchWidgetProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleChange = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setDebouncedQuery('');
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(value.trim());
      setOpen(true);
    }, 400);
  }, []);

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ q: debouncedQuery });
    if (grade) params.set('grade', String(grade));
    if (board) params.set('board', board);
    fetch(`/api/v1/content/search?${params.toString()}`)
      .then(async (r) => {
        const json = (await r.json()) as { results?: SearchResult[] };
        if (!cancelled) setResults(json.results ?? []);
      })
      .catch(() => { if (!cancelled) setResults([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debouncedQuery, grade, board]);

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          placeholder="Search topics, chapters..."
          className="w-full min-h-[44px] rounded-xl border border-gray-300 bg-white pl-9 pr-10 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#534AB7] focus:border-transparent dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-gray-500"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => { setQuery(''); setDebouncedQuery(''); setOpen(false); setResults([]); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 min-h-[24px] min-w-[24px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            &times;
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-30 w-full mt-1 rounded-xl border border-gray-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900 max-h-72 overflow-y-auto">
          <SearchResults
            results={results}
            query={debouncedQuery}
            grade={grade}
            board={board}
            isLoading={loading}
          />
        </div>
      )}
    </div>
  );
}
