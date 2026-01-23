"use client";
/**
 * FILE OBJECTIVE:
 * - Mobile-optimized subject selector with horizontal scroll and compact thread list.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/dashboard/components/SubjectThreadList.spec.ts
 *
 * EDIT LOG:
 * - 2025-01-22 | copilot | optimized for mobile with horizontal scroll subjects
 */
import React, { useCallback, useEffect, useState } from 'react';

type Thread = {
  conversationId: string;
  lastMessage: string;
  lastRole: 'user' | 'assistant';
  updatedAt: string | Date;
  count: number;
};

interface SubjectThreadListProps {
  subjects?: string[];
  subject: string;
  setSubject: (s: string) => void;
  onSelectThread: (conversationId: string) => void;
  onNewThread: (subject: string) => void;
  selectedConversationId?: string;
}

// Compact subject data
const subjectData: Record<string, { icon: string; color: string }> = {
  general: { icon: '💬', color: 'bg-slate-500' },
  math: { icon: '🔢', color: 'bg-blue-500' },
  science: { icon: '🔬', color: 'bg-emerald-500' },
  coding: { icon: '💻', color: 'bg-purple-500' },
};

const defaultSubjects = ['general', 'math', 'science', 'coding'];

export default function SubjectThreadList({ subjects = defaultSubjects, subject, setSubject, onSelectThread, onNewThread, selectedConversationId }: SubjectThreadListProps) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(false);
  const [showThreads, setShowThreads] = useState(false);

  const loadThreads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/chat/conversations?subjectId=${encodeURIComponent(subject)}&limit=20`);
      const data = await res.json().catch(() => null);
      setThreads(Array.isArray(data?.threads) ? data.threads : []);
    } catch {
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }, [subject]);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  const _currentData = subjectData[subject] || subjectData.general;

  return (
    <div className="space-y-2">
      {/* Subject chips - horizontal scroll */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {subjects.map((s) => {
          const data = subjectData[s] || subjectData.general;
          const isActive = subject === s;
          return (
            <button
              key={s}
              onClick={() => { setSubject(s); setShowThreads(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                isActive
                  ? `${data.color} text-white shadow-md`
                  : 'bg-muted/60 dark:bg-slate-800 text-foreground active:scale-95'
              }`}
            >
              <span>{data.icon}</span>
              <span>{s.charAt(0).toUpperCase() + s.slice(1)}</span>
            </button>
          );
        })}
        
        {/* New chat button */}
        <button
          onClick={() => onNewThread(subject)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-primary text-primary-foreground whitespace-nowrap flex-shrink-0 active:scale-95"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 4v16m8-8H4" />
          </svg>
          New
        </button>
      </div>

      {/* Thread toggle */}
      {threads.length > 0 && (
        <button
          onClick={() => setShowThreads(!showThreads)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-muted/40 dark:bg-slate-800/50 text-xs active:bg-muted/60"
        >
          <span className="text-muted-foreground">
            {loading ? 'Loading...' : `${threads.length} recent chat${threads.length !== 1 ? 's' : ''}`}
          </span>
          <svg className={`w-4 h-4 text-muted-foreground transition-transform ${showThreads ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}

      {/* Thread list - collapsible */}
      {showThreads && (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {threads.map((t) => {
            const isSelected = selectedConversationId === t.conversationId;
            const preview = t.lastMessage?.slice(0, 50) + (t.lastMessage?.length > 50 ? '…' : '');
            return (
              <button
                key={t.conversationId}
                onClick={() => { onSelectThread(t.conversationId); setShowThreads(false); }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                  isSelected
                    ? 'bg-primary/10 border border-primary/30'
                    : 'bg-card hover:bg-muted/50 active:bg-muted'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`truncate ${isSelected ? 'text-primary font-medium' : 'text-foreground'}`}>
                    {preview || 'Empty chat'}
                  </span>
                  <span className="text-muted-foreground text-[10px] flex-shrink-0">
                    {t.count} msg
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
      
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
