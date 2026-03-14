'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import type { StudentProfileData } from '@/lib/student/profileGuard';

interface ProfileCompletionGateProps {
  profileData: StudentProfileData;
}

interface ChecklistItem {
  key: keyof StudentProfileData;
  label: string;
  filled: boolean;
}

export default function ProfileCompletionGate({ profileData }: ProfileCompletionGateProps) {
  const router = useRouter();

  const items: ChecklistItem[] = [
    {
      key: 'board',
      label: 'Board',
      filled: !!profileData.board && String(profileData.board).trim() !== '',
    },
    {
      key: 'grade',
      label: 'Grade',
      filled: !!profileData.grade && String(profileData.grade).trim() !== '',
    },
    {
      key: 'language',
      label: 'Medium',
      filled: !!profileData.language && String(profileData.language).trim() !== '',
    },
    {
      key: 'subjects',
      label: 'Subjects',
      filled: Array.isArray(profileData.subjects) && profileData.subjects.length > 0,
    },
  ];

  const completedCount = items.filter((i) => i.filled).length;
  const progressPercent = Math.round((completedCount / items.length) * 100);

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <span className="text-lg">📋</span>
          </div>
          <h1 className="text-lg font-semibold text-gray-900">Complete your profile</h1>
        </div>

        <p className="mb-4 text-sm text-gray-600">
          To start learning, please fill in your academic details.
        </p>

        {/* Progress bar */}
        <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
          <span>{completedCount} of {items.length} complete</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="mb-5 h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-amber-500 transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Checklist */}
        <ul className="mb-6 space-y-2">
          {items.map((item) => (
            <li key={item.key} className="flex items-center gap-3 text-sm">
              <span
                className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  item.filled
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {item.filled ? '✓' : '✗'}
              </span>
              <span className={item.filled ? 'text-gray-700' : 'font-medium text-gray-900'}>
                {item.label}
              </span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => router.push('/profile')}
          className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
        >
          Complete your profile
        </button>
      </div>
    </div>
  );
}
