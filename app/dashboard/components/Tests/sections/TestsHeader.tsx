import React, { useEffect, useState } from 'react';
import { useTests } from '../context/TestsProvider';
import useCurrentUser from '@/hooks/useCurrentUser';
// Removed SearchBar usage; use simple selects for subject/difficulty

export function TestsHeader({ subject: initialSubject, grade, board }: { subject?: string; grade?: string; board?: string }) {
  const { refresh } = useTests();
  const { data: profile } = useCurrentUser();
  const [subject, setSubject] = useState<string>(initialSubject ?? (profile?.subjects?.[0] as any ?? '') );
  const [_clientDifficulty, _setClientDifficulty] = useState<string>('any');
  const [_clientQuery, _setClientQuery] = useState<string>('');

  useEffect(() => {
    // trigger refresh whenever header subject changes
    if (subject) refresh(subject, grade, board).catch(() => {});
  }, [subject, grade, board, refresh]);



  const subjects = Array.isArray(profile?.subjects) ? profile.subjects.map((s: any) => (s.name ?? s)) : [];

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Tests</h1>
          <p className="text-sm text-muted-foreground">Practice and evaluate your learning</p>
        </div>
        <div className="flex items-center gap-2">
          <select disabled value={profile?.language ?? 'en'} className="px-3 py-2 border rounded bg-muted/10">
            <option value={profile?.language ?? 'en'}>{profile?.language ?? 'en'}</option>
          </select>
          <select disabled value={profile?.board ?? 'Board'} className="px-3 py-2 border rounded bg-muted/10">
            <option value={profile?.board ?? ''}>{profile?.board ?? 'Board'}</option>
          </select>
          <select disabled value={String(profile?.grade ?? '')} className="px-3 py-2 border rounded bg-muted/10">
            <option value={String(profile?.grade ?? '')}>{profile?.grade ? `Grade ${profile.grade}` : 'Grade'}</option>
          </select>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <select aria-label="subject-filter" value={subject} onChange={(e) => setSubject(e.target.value)} className="px-3 py-2 border rounded">
          <option value="">All subjects</option>
          {subjects.map((s: any) => (
            <option key={s} value={s.name ?? s}>
              {s.name ?? s}
            </option>
          ))}
        </select>

        <select aria-label="difficulty-filter" defaultValue="any" onChange={(e) => _setClientDifficulty(e.target.value)} className="px-3 py-2 border rounded">
          <option value="any">Any difficulty</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>

        <input aria-label="tests-query" placeholder="Search tests..." value={_clientQuery} onChange={(e) => _setClientQuery(e.target.value)} className="px-3 py-2 border rounded" />

        <button onClick={() => refresh(subject ?? '', grade ?? profile?.grade, board ?? profile?.board)} className="px-3 py-2 bg-primary text-white rounded">Apply</button>
      </div>
    </div>
  );
}
