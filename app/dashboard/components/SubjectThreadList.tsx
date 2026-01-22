"use client";
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

// Subject icons mapping
const subjectIcons: Record<string, React.ReactNode> = {
  general: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  math: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 7h6m-3 0v10m-6 0h12M4 3h16a1 1 0 011 1v16a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z" />
    </svg>
  ),
  science: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  coding: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  ),
};

// Subject colors
const subjectColors: Record<string, { bg: string; active: string; gradient: string }> = {
  general: { bg: 'bg-slate-100 dark:bg-slate-800', active: 'from-slate-500 to-slate-600', gradient: 'from-slate-500 to-slate-600' },
  math: { bg: 'bg-blue-100 dark:bg-blue-900/30', active: 'from-blue-500 to-cyan-500', gradient: 'from-blue-500 to-cyan-500' },
  science: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', active: 'from-emerald-500 to-teal-500', gradient: 'from-emerald-500 to-teal-500' },
  coding: { bg: 'bg-purple-100 dark:bg-purple-900/30', active: 'from-purple-500 to-pink-500', gradient: 'from-purple-500 to-pink-500' },
};

const defaultSubjects = ['general', 'math', 'science', 'coding'];

export default function SubjectThreadList({ subjects = defaultSubjects, subject, setSubject, onSelectThread, onNewThread, selectedConversationId }: SubjectThreadListProps) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreads, setUnreads] = useState<Record<string, number>>({});

  const loadThreads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/chat/conversations?subjectId=${encodeURIComponent(subject)}&limit=50`);
      const data = await res.json().catch(() => null);
      const list: Thread[] = Array.isArray(data?.threads) ? data.threads : [];
      setThreads(list);
      // Compute unread counts from sessionStorage seen counts
      try {
        const next: Record<string, number> = {};
        for (const t of list) {
          const key = `spinzy:seen:${subject}:${t.conversationId}`;
          let seenCount = 0;
          try {
            const raw = window.sessionStorage.getItem(key);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed && typeof parsed.seenCount === 'number') seenCount = parsed.seenCount;
            }
          } catch {}
          const unread = Math.max((t.count || 0) - (seenCount || 0), 0);
          if (unread > 0) next[t.conversationId] = unread;
        }
        setUnreads(next);
      } catch {}

      // Do not auto-select; user will pick a thread explicitly
    } catch {
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }, [subject]);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  const selectThread = (t: Thread) => {
    try {
      // Mark seen for this thread in session
      const key = `spinzy:seen:${subject}:${t.conversationId}`;
      try {
        window.sessionStorage.setItem(key, JSON.stringify({ seenCount: t.count || 0, seenAt: new Date().toISOString() }));
      } catch {}
      setUnreads((prev) => {
        const next = { ...prev };
        delete next[t.conversationId];
        return next;
      });
    } catch {}
    onSelectThread(t.conversationId);
  };

  const currentColor = subjectColors[subject] || subjectColors.general;

  return (
    <div className="bg-card border border-border/50 rounded-2xl p-4 mb-4 shadow-sm">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Chat Subjects
        </h3>
        <span className="text-xs text-muted-foreground">{threads.length} conversations</span>
      </div>

      {/* Subject chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {subjects.map((s) => {
          const isActive = subject === s;
          const colors = subjectColors[s] || subjectColors.general;
          const icon = subjectIcons[s] || subjectIcons.general;
          
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSubject(s)}
              className={`
                relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300
                ${isActive 
                  ? `bg-gradient-to-r ${colors.active} text-white shadow-md` 
                  : `${colors.bg} text-foreground hover:shadow-sm border border-transparent hover:border-border`
                }
              `}
            >
              {icon}
              <span>{s === 'general' ? 'General' : s.charAt(0).toUpperCase() + s.slice(1)}</span>
              {/* Active indicator */}
              {isActive && (
                <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full" />
              )}
            </button>
          );
        })}
        
        {/* New Chat button */}
        <button
          type="button"
          onClick={() => onNewThread(subject)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r ${currentColor.gradient} text-white shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105`}
          title="Start new chat"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 4v16m8-8H4" />
          </svg>
          New Chat
        </button>
      </div>

      {/* Thread list */}
      <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4m0 12v4m-8-8h4m8 0h4m-2.93-6.07l-2.83 2.83m-5.66 5.66l-2.83 2.83m0-11.32l2.83 2.83m5.66 5.66l2.83 2.83" />
            </svg>
            Loading conversations…
          </div>
        )}
        
        {!loading && threads.length === 0 && (
          <div className="text-center py-6">
            <div className={`w-12 h-12 mx-auto mb-3 bg-gradient-to-br ${currentColor.gradient} rounded-xl flex items-center justify-center`}>
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No conversations yet</p>
            <p className="text-xs text-muted-foreground">Start a new chat to begin learning!</p>
          </div>
        )}
        
        {threads.map((t) => (
          <button
            key={t.conversationId}
            type="button"
            onClick={() => selectThread(t)}
            className={`
              group w-full text-left bg-background/50 dark:bg-slate-800/50 border rounded-xl px-4 py-3 
              hover:bg-background hover:shadow-sm transition-all duration-200
              ${selectedConversationId === t.conversationId 
                ? `border-primary/50 bg-primary/5 ring-1 ring-primary/20` 
                : 'border-border/50 hover:border-border'
              }
            `}
          >
            <div className="flex items-start gap-3">
              {/* Thread icon */}
              <div className={`
                w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5
                ${selectedConversationId === t.conversationId 
                  ? `bg-gradient-to-br ${currentColor.gradient} text-white` 
                  : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
                }
              `}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sm font-medium text-foreground truncate">
                    {t.lastMessage || 'New Conversation'}
                  </span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {unreads[t.conversationId] ? (
                      <span className={`text-[10px] bg-gradient-to-r ${currentColor.gradient} text-white rounded-full px-1.5 py-0.5 font-medium`}>
                        {unreads[t.conversationId]} new
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{t.count} messages</span>
                  <span>•</span>
                  <span>{new Date(t.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
              
              {/* Arrow indicator */}
              <svg className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0 mt-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        ))}
      </div>
      
      {/* Custom scrollbar styles */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: hsl(var(--muted));
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: hsl(var(--muted-foreground));
        }
      `}</style>
    </div>
  );
}
