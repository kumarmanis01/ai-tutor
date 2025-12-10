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

const defaultSubjects = ['general', 'math', 'science', 'coding'];

export default function SubjectThreadList({ subjects = defaultSubjects, subject, setSubject, onSelectThread, onNewThread, selectedConversationId }: SubjectThreadListProps) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreads, setUnreads] = useState<Record<string, number>>({});

  const loadThreads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/chat/conversations?subject=${encodeURIComponent(subject)}&limit=50`);
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

  return (
    <div className="bg-card border border-border rounded-lg p-3 mb-4">
      {/* Subject chips */}
      <div className="flex flex-wrap gap-2 mb-3">
        {subjects.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSubject(s)}
            className={`px-3 py-1 rounded-full border text-xs ${subject === s ? 'bg-primary text-white border-primary' : 'bg-muted text-foreground border-border'}`}
          >
            {s === 'general' ? 'General' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <div className="ml-auto">
          <button
            type="button"
            onClick={() => onNewThread(subject)}
            className="px-3 py-1 rounded-md bg-primary text-primary-foreground text-xs"
            title="Start new chat"
          >
            New Chat
          </button>
        </div>
      </div>

      {/* Thread list */}
      <div className="space-y-2">
        {loading && <div className="text-xs text-muted-foreground">Loading threads…</div>}
        {!loading && threads.length === 0 && (
          <div className="text-xs text-muted-foreground">No threads yet. Start a new chat.</div>
        )}
        {threads.map((t) => (
          <button
            key={t.conversationId}
            type="button"
            onClick={() => selectThread(t)}
            className={`w-full text-left bg-background border border-border rounded-md px-3 py-2 hover:bg-background/60 ${selectedConversationId === t.conversationId ? 'ring-1 ring-primary' : ''}`}
            title={t.lastMessage}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium truncate">{t.lastMessage || 'Conversation'}</div>
              <div className="flex items-center gap-2">
                {unreads[t.conversationId] ? (
                  <span className="text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5" title="Unread messages">
                    {unreads[t.conversationId]}
                  </span>
                ) : null}
                <div className="text-[10px] text-muted-foreground">{t.count} msgs</div>
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{new Date(t.updatedAt).toLocaleString()}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
