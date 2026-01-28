import React, { useEffect, useState } from 'react';
import { useNotes } from '../context/NotesProvider';
import useCurrentUser from '@/hooks/useCurrentUser';
export function NotesSearch() {
  const { setQuery, setFilters, subjects, refresh } = useNotes();
  const { data: profile } = useCurrentUser();
  const [topics, setTopics] = useState<string[]>([]);
  const [_selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState<string>('');

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  useEffect(() => {
    // populate filters from profile on mount/login
    if (profile) {
      setFilters({ language: profile.language ?? null, board: profile.board ?? null, grade: profile.grade ? String(profile.grade) : null });
    }
  }, [profile, setFilters]);

  const subjectNames = (subjects || []).map((s) => s.name);

  function onSubjectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const subject = e.target.value;
    setSelectedSubject(subject);
    setSelectedTopic('');
    setFilters({ subject: subject || null, topic: null });
    // fetch topics for the selected subject
    if (subject) {
      fetch(`/api/topics?subjectId=${encodeURIComponent(subject)}`)
        .then((r) => r.json())
        .then((data) => {
          const names = (data || []).map((t: any) => t.name || t.slug).filter(Boolean);
          setTopics(names);
        })
        .catch(() => setTopics([]));
    } else {
      setTopics([]);
    }
  }

  function onTopicChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const topic = e.target.value;
    setSelectedTopic(topic);
    setFilters({ topic: topic || null });
  }

  function onSearchInput(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value || '');
  }

  return (
    <div className="flex items-center gap-2">
      <select disabled value={profile?.language ?? 'en'} className="px-3 py-2 border rounded bg-muted/10">
        <option value={profile?.language ?? 'en'}>{profile?.language ?? 'en'}</option>
      </select>
      <select disabled value={profile?.board ?? ''} className="px-3 py-2 border rounded bg-muted/10">
        <option value={profile?.board ?? ''}>{profile?.board ?? 'Board'}</option>
      </select>
      <select disabled value={String(profile?.grade ?? '')} className="px-3 py-2 border rounded bg-muted/10">
        <option value={String(profile?.grade ?? '')}>{profile?.grade ? `Grade ${profile.grade}` : 'Grade'}</option>
      </select>

      <select aria-label="subject-filter" onChange={onSubjectChange} className="px-3 py-2 border rounded">
        <option value="">All subjects</option>
        {subjectNames.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <select aria-label="topic-filter" value={selectedTopic} onChange={onTopicChange} className="px-3 py-2 border rounded">
        <option value="">All topics</option>
        {topics.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>

      <input aria-label="notes-search" placeholder="Search notes" onChange={onSearchInput} className="px-3 py-2 border rounded" />
    </div>
  );
}
