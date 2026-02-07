/**
 * FILE OBJECTIVE:
 * - Notes search/filter bar with profile-based dropdowns.
 * - Shows Language, Board, Grade (disabled, from profile) + Subject → Chapter → Topic (selectable).
 * - Uses session-cached hierarchy API for dropdown data.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/dashboard/components/Notes/sections/NotesSearch.spec.ts
 *
 * EDIT LOG:
 * - 2026-02-03 | claude | added chapter dropdown between subject and topic
 */

import React, { useState } from 'react';
import { useNotes } from '../context/NotesProvider';
import useCurrentUser from '@/hooks/useCurrentUser';
import { useAcademicHierarchy } from '@/hooks/useAcademicHierarchy';

export function NotesSearch() {
  const { setQuery, setFilters } = useNotes();
  const { data: profile } = useCurrentUser();
  const { helpers, loading: hierarchyLoading } = useAcademicHierarchy();

  // Selection state
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedChapterId, setSelectedChapterId] = useState<string>('');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');

  // Derive dropdown data from cached hierarchy
  const subjects = helpers.getSubjectsForGrade(profile?.board, profile?.grade);
  const chapters = helpers.getChaptersForSubject(selectedSubjectId || null);
  const topics = helpers.getTopicsForChapter(selectedChapterId || null);

  function onSubjectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const subjectId = e.target.value;
    setSelectedSubjectId(subjectId);
    setSelectedChapterId('');
    setSelectedTopicId('');
    const subject = subjects.find(s => s.id === subjectId);
    setFilters({ subject: subject?.slug || null, topic: null });
  }

  function onChapterChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const chapterId = e.target.value;
    setSelectedChapterId(chapterId);
    setSelectedTopicId('');
    setFilters({ topic: null });
  }

  function onTopicChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const topicId = e.target.value;
    setSelectedTopicId(topicId);
    const topic = topics.find(t => t.id === topicId);
    setFilters({ topic: topic?.slug || null });
  }

  function onSearchInput(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value || '');
  }

  const languageDisplay = profile?.language === 'hi' ? 'हिंदी' : 'English';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Profile-based (disabled) */}
      <select disabled value={profile?.language ?? 'en'} className="px-3 py-2 border rounded bg-muted/10 text-sm">
        <option value={profile?.language ?? 'en'}>{languageDisplay}</option>
      </select>
      <select disabled value={profile?.board ?? ''} className="px-3 py-2 border rounded bg-muted/10 text-sm">
        <option value={profile?.board ?? ''}>{profile?.board ?? 'Board'}</option>
      </select>
      <select disabled value={String(profile?.grade ?? '')} className="px-3 py-2 border rounded bg-muted/10 text-sm">
        <option value={String(profile?.grade ?? '')}>{profile?.grade ? `Class ${profile.grade}` : 'Grade'}</option>
      </select>

      {/* Subject dropdown */}
      <select 
        aria-label="subject-filter" 
        value={selectedSubjectId}
        onChange={onSubjectChange} 
        disabled={hierarchyLoading}
        className="px-3 py-2 border rounded text-sm"
      >
        <option value="">All subjects</option>
        {subjects.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>

      {/* Chapter dropdown */}
      <select 
        aria-label="chapter-filter" 
        value={selectedChapterId}
        onChange={onChapterChange} 
        disabled={!selectedSubjectId}
        className={`px-3 py-2 border rounded text-sm ${!selectedSubjectId ? 'opacity-50' : ''}`}
      >
        <option value="">{selectedSubjectId ? 'All chapters' : 'Select subject first'}</option>
        {chapters.map((ch) => (
          <option key={ch.id} value={ch.id}>{ch.order}. {ch.name}</option>
        ))}
      </select>

      {/* Topic dropdown */}
      <select 
        aria-label="topic-filter" 
        value={selectedTopicId} 
        onChange={onTopicChange} 
        disabled={!selectedChapterId}
        className={`px-3 py-2 border rounded text-sm ${!selectedChapterId ? 'opacity-50' : ''}`}
      >
        <option value="">{selectedChapterId ? 'All topics' : 'Select chapter first'}</option>
        {topics.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>

      {/* Search */}
      <input 
        aria-label="notes-search" 
        placeholder="Search notes" 
        onChange={onSearchInput} 
        className="px-3 py-2 border rounded text-sm flex-1 min-w-[120px]" 
      />
    </div>
  );
}
