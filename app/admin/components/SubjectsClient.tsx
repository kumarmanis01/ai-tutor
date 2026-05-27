"use client"
/**
 * FILE OBJECTIVE:
 * - Admin table for SubjectDef rows: view and edit subjectType + targetLanguage.
 *
 * EDIT LOG:
 * - 2026-05-27 | claude | add SubjectType and targetLanguage columns + edit modal
 */
import React, { useEffect, useState } from "react";

const SUBJECT_TYPES = ['LANGUAGE', 'STEM', 'SOCIAL', 'VOCATIONAL', 'OTHER'] as const;
type SubjectTypeName = (typeof SUBJECT_TYPES)[number];

interface SubjectRow {
  id: string;
  name: string;
  slug: string;
  board: string;
  grade: number;
  subjectType: SubjectTypeName;
  targetLanguage: string | null;
}

interface EditState {
  subjectId: string;
  subjectName: string;
  subjectType: SubjectTypeName;
  targetLanguage: string;
}

export default function SubjectsClient() {
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function loadSubjects() {
    setLoading(true);
    setError(false);
    fetch("/api/hierarchy?include=subjects")
      .then(res => res.json())
      .then((data: { boards?: any[] }) => {
        const boards = data?.boards ?? [];
        const rows: SubjectRow[] = [];
        for (const board of boards) {
          for (const cls of board.classes ?? []) {
            for (const sub of cls.subjects ?? []) {
              rows.push({
                id: sub.id,
                name: sub.name,
                slug: sub.slug,
                board: board.name,
                grade: cls.grade,
                subjectType: sub.subjectType ?? 'OTHER',
                targetLanguage: sub.targetLanguage ?? null,
              });
            }
          }
        }
        rows.sort((a, b) => a.board.localeCompare(b.board) || a.grade - b.grade || a.name.localeCompare(b.name));
        setSubjects(rows);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadSubjects();
  }, []);

  function openEdit(sub: SubjectRow) {
    setEdit({
      subjectId: sub.id,
      subjectName: sub.name,
      subjectType: sub.subjectType,
      targetLanguage: sub.targetLanguage ?? '',
    });
    setSaveError(null);
  }

  function closeEdit() {
    setEdit(null);
    setSaveError(null);
  }

  async function handleSave() {
    if (!edit) return;
    if (edit.subjectType === 'LANGUAGE' && !edit.targetLanguage.trim()) {
      setSaveError('Target language code is required for LANGUAGE subjects (e.g. hi, fr, ta).');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/admin/subjects/${edit.subjectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectType: edit.subjectType,
          targetLanguage: edit.subjectType === 'LANGUAGE' ? edit.targetLanguage.trim() : null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSaveError((body as any).message ?? 'Save failed. Please try again.');
        return;
      }
      closeEdit();
      loadSubjects();
    } catch {
      setSaveError("Couldn't save -- please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 animate-pulse space-y-3">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-8 bg-gray-200 rounded" />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-red-600 mb-3">{"Couldn't load subjects -- tap to retry"}</p>
        <button
          type="button"
          onClick={loadSubjects}
          className="px-4 py-2 min-h-[44px] bg-gray-900 text-white rounded-lg text-sm font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  const TYPE_BADGE: Record<SubjectTypeName, string> = {
    LANGUAGE: 'bg-amber-100 text-amber-800',
    STEM: 'bg-blue-100 text-blue-800',
    SOCIAL: 'bg-green-100 text-green-800',
    VOCATIONAL: 'bg-purple-100 text-purple-800',
    OTHER: 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Subjects</h1>
      <p className="text-sm text-gray-500 mb-4">{subjects.length} active subjects</p>

      <div className="overflow-x-auto">
        <table className="min-w-full border text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="border px-4 py-2 text-left">Name</th>
              <th className="border px-4 py-2 text-left">Slug</th>
              <th className="border px-4 py-2 text-left">Board</th>
              <th className="border px-4 py-2 text-left">Grade</th>
              <th className="border px-4 py-2 text-left">Type</th>
              <th className="border px-4 py-2 text-left">Language code</th>
              <th className="border px-4 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {subjects.length === 0 && (
              <tr>
                <td colSpan={7} className="border px-4 py-4 text-center text-gray-400">
                  No subjects found
                </td>
              </tr>
            )}
            {subjects.map(sub => (
              <tr key={sub.id} className="hover:bg-gray-50">
                <td className="border px-4 py-2 font-medium">{sub.name}</td>
                <td className="border px-4 py-2 text-gray-500 font-mono text-xs">{sub.slug}</td>
                <td className="border px-4 py-2">{sub.board}</td>
                <td className="border px-4 py-2">Grade {sub.grade}</td>
                <td className="border px-4 py-2">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${TYPE_BADGE[sub.subjectType]}`}>
                    {sub.subjectType}
                  </span>
                </td>
                <td className="border px-4 py-2 font-mono text-xs text-gray-600">
                  {sub.targetLanguage ?? <span className="text-gray-300">--</span>}
                </td>
                <td className="border px-4 py-2">
                  <button
                    type="button"
                    onClick={() => openEdit(sub)}
                    className="min-h-[44px] px-3 text-sm text-indigo-700 hover:text-indigo-900 font-medium underline"
                  >
                    Edit type
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {edit && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={closeEdit}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-subject-title"
            className="fixed inset-x-4 top-1/4 z-50 max-w-md mx-auto bg-white rounded-2xl shadow-2xl p-6"
          >
            <h2 id="edit-subject-title" className="text-lg font-bold mb-1">
              Edit: {edit.subjectName}
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              Setting type to LANGUAGE makes the AI tutor respond exclusively in that language.
            </p>

            <label className="block text-sm font-medium mb-1" htmlFor="subject-type-select">
              Subject type
            </label>
            <select
              id="subject-type-select"
              value={edit.subjectType}
              onChange={e => setEdit({ ...edit, subjectType: e.target.value as SubjectTypeName })}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-4 min-h-[44px]"
            >
              {SUBJECT_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            {edit.subjectType === 'LANGUAGE' && (
              <>
                <label className="block text-sm font-medium mb-1" htmlFor="target-language-input">
                  Target language code (ISO 639-1)
                </label>
                <input
                  id="target-language-input"
                  type="text"
                  value={edit.targetLanguage}
                  onChange={e => setEdit({ ...edit, targetLanguage: e.target.value })}
                  placeholder="e.g. hi for Hindi, fr for French, ta for Tamil"
                  className="w-full border rounded-lg px-3 py-2 text-sm mb-1 min-h-[44px]"
                  maxLength={10}
                />
                <p className="text-xs text-gray-400 mb-4">
                  Use ISO 639-1 codes: hi, en, fr, de, es, sa, ta, te, kn, ml, bn, mr, gu, pa, ur...
                </p>
              </>
            )}

            {saveError && (
              <p className="text-sm text-red-600 mb-3">{saveError}</p>
            )}

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={closeEdit}
                disabled={saving}
                className="min-h-[44px] px-4 text-sm border rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="min-h-[44px] px-5 text-sm bg-[#534AB7] text-white rounded-lg font-semibold hover:bg-[#463fa0] disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
