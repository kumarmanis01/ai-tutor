/**
 * FILE OBJECTIVE:
 * - S3.1: SearchResults -- renders a list of topics/content found via DB search.
 *   Shows ContentRequestCard when results are empty.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/search/SearchResults.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created S3.1 SearchResults component
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { ContentRequestCard } from './ContentRequestCard';

export type SearchResult = {
  id: string;
  type: 'topic' | 'ai_content';
  title: string;
  subject: string;
  grade: number | null;
  board: string;
  description: string;
  contentStatus: string;
  topicId?: string;
  contentId?: string;
};

type SearchResultsProps = {
  results: SearchResult[];
  query: string;
  grade: number;
  board: string;
  subject?: string;
  isLoading: boolean;
};

function ResultItem({ result }: { result: SearchResult }) {
  const href =
    result.type === 'topic'
      ? `/session/${result.topicId ?? result.id}`
      : `/student/learning-map/content/${result.contentId ?? result.id}`;

  const badge =
    result.type === 'ai_content' ? (
      <span className="ml-1 rounded bg-[#534AB7]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#534AB7]">
        AI Draft
      </span>
    ) : null;

  return (
    <Link
      href={href}
      className="flex min-h-[56px] items-start gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm transition hover:bg-[#EEEDFE] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#534AB7]"
    >
      <span className="mt-0.5 text-xl" aria-hidden="true">
        {result.type === 'ai_content' ? '🤖' : '📖'}
      </span>
      <div className="flex-1 overflow-hidden">
        <div className="flex items-center">
          <span className="truncate font-semibold text-gray-800">{result.title}</span>
          {badge}
        </div>
        <p className="mt-0.5 truncate text-xs text-gray-500">{result.description}</p>
      </div>
      <span aria-hidden="true" className="mt-1 shrink-0 text-gray-300">
        ›
      </span>
    </Link>
  );
}

/**
 * S3.1 -- Renders DB search results or the ContentRequestCard for zero results.
 */
export function SearchResults({
  results,
  query,
  grade,
  board,
  subject,
  isLoading,
}: SearchResultsProps) {
  if (isLoading) {
    return (
      <div className="mt-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    );
  }

  if (!query || query.length < 2) {
    return null;
  }

  if (results.length === 0) {
    return (
      <ContentRequestCard query={query} grade={grade} board={board} subject={subject} />
    );
  }

  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs text-gray-500">
        {results.length} result{results.length !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;
      </p>
      {results.map((r) => (
        <ResultItem key={r.id} result={r} />
      ))}
    </div>
  );
}

export default SearchResults;
