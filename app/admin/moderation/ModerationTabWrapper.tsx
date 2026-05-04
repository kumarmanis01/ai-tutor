'use client';

import React, { useState } from 'react';

interface ModerationTabWrapperProps {
  contentTab: React.ReactNode;
  syllabusTab: React.ReactNode;
  syllabusCount: number;
}

export function ModerationTabWrapper({ contentTab, syllabusTab, syllabusCount }: ModerationTabWrapperProps) {
  const [activeTab, setActiveTab] = useState<'content' | 'syllabus'>('content');

  return (
    <div>
      <div className="mb-5 flex gap-1 rounded-xl bg-gray-100 p-1 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('content')}
          className={`px-4 py-2 rounded-lg text-sm font-medium min-h-[36px] transition-colors ${
            activeTab === 'content'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          AI Content
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('syllabus')}
          className={`px-4 py-2 rounded-lg text-sm font-medium min-h-[36px] transition-colors flex items-center gap-1.5 ${
            activeTab === 'syllabus'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Syllabus Review
          {syllabusCount > 0 && (
            <span className="inline-flex items-center justify-center text-[10px] font-semibold min-w-[18px] h-[18px] rounded-full bg-[#534AB7] text-white px-1">
              {syllabusCount}
            </span>
          )}
        </button>
      </div>

      <div className={activeTab === 'content' ? '' : 'hidden'}>
        {contentTab}
      </div>
      <div className={activeTab === 'syllabus' ? '' : 'hidden'}>
        {syllabusTab}
      </div>
    </div>
  );
}
