/**
 * FILE OBJECTIVE:
 * - Reusable SearchBar component to filter content by language, board, grade, subject and optional difficulty.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/searchbar.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-01-27T06:10:00Z | ai-assistant | created SearchBar component
 */

import React, { useState } from 'react';

export type Difficulty = 'any' | 'easy' | 'medium' | 'hard';

export interface UserProfile {
  language: string;
  board: string;
  grade: string;
}

export interface SearchFilters {
  language: string;
  board: string;
  grade: string;
  subject?: string;
  difficulty?: Difficulty;
  query?: string;
}

export interface SearchBarProps {
  userProfile: UserProfile;
  subjects?: string[];
  showDifficulty?: boolean;
  onSearch: (filters: SearchFilters) => void;
}

const defaultSubjects = ['Math', 'Science', 'English', 'Social Studies'];
const difficultyOptions: Difficulty[] = ['any', 'easy', 'medium', 'hard'];

export default function SearchBar({
  userProfile,
  subjects = defaultSubjects,
  showDifficulty = false,
  onSearch,
}: SearchBarProps) {
  const [subject, setSubject] = useState<string>(subjects[0] ?? '');
  const [difficulty, setDifficulty] = useState<Difficulty>('any');
  const [query, setQuery] = useState<string>('');

  function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    onSearch({
      language: userProfile.language,
      board: userProfile.board,
      grade: userProfile.grade,
      subject: subject || undefined,
      difficulty: showDifficulty ? difficulty : undefined,
      query: query || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <label style={{ display: 'none' }} htmlFor="sb-query">Search query</label>
      <input
        id="sb-query"
        aria-label="search-query"
        placeholder="Search..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ padding: '6px 8px', minWidth: 160 }}
      />

      <select value={userProfile.language} disabled title="Language (from profile)">
        <option>{userProfile.language}</option>
      </select>

      <select value={userProfile.board} disabled title="Board (from profile)">
        <option>{userProfile.board}</option>
      </select>

      <select value={userProfile.grade} disabled title="Grade (from profile)">
        <option>{userProfile.grade}</option>
      </select>

      <select
        aria-label="subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        title="Subject"
      >
        {subjects.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      {showDifficulty && (
        <select aria-label="difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
          {difficultyOptions.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      )}

      <button type="submit" aria-label="search-button" style={{ padding: '6px 10px' }}>
        Search
      </button>
    </form>
  );
}
