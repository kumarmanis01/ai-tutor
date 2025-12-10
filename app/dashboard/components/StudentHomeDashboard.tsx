'use client';

import React, { useState, useEffect } from 'react';
import TopBar from './TopBar';
import useCurrentUser from '@/hooks/useCurrentUser';
import { useGlobalLoader } from '@/context/GlobalLoaderProvider';
import ProfilePage from '@/app/profile/page';
import QuickInputBox from './QuickInputBox';
import SubjectThreadList from './SubjectThreadList';
import ChatPanel from './ChatPanel';
import ContinueLearning from './ContinueLearning';
import SuggestedContent from './SuggestedContent';
import FeatureGrid from './FeatureGrid';
import StudyGoals from './StudyGoals';
import ParentModeCard from './ParentModeCard';
import BottomNavigation from './BottomNavigator';
import TestsTab from './Tests';
import NotesTab from './Notes';

interface StudentHomeDashboardProps { [key: string]: unknown }

const StudentHomeDashboard: React.FC<StudentHomeDashboardProps> = () => {
  const [activeTab, setActiveTab] = useState<'home' | 'tests' | 'notes' | 'profile'>('home');
  const [messages, setMessages] = useState<{ id: string; from: 'user' | 'ai'; text: string; language?: string; suggestions?: string[] }[]>([]);
  const [subject, setSubject] = useState<string>('general');
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const { data: profile, loading } = useCurrentUser();
  const studentName = profile?.name ?? 'Student';
  const { startLoading, stopLoading } = useGlobalLoader();

  // Use global loader overlay while canonical profile is being fetched.
  useEffect(() => {
    if (loading && !profile) {
      try {
        startLoading('Loading your dashboard…');
      } catch {}
    } else {
      try {
        stopLoading();
      } catch {}
    }
    return () => {
      try { stopLoading(); } catch {}
    };
  }, [loading, profile, startLoading, stopLoading]);

  // Load chat history per subject and optionally conversationId
  useEffect(() => {
    let cancelled = false;
    async function loadHistory() {
      try {
        // If no thread selected for this subject, try restoring last used thread from session
        if (!conversationId) {
          try {
            const key = `spinzy:lastcid:${subject}`;
            const raw = typeof window !== 'undefined' ? window.sessionStorage.getItem(key) : null;
            const restored = raw ? String(raw) : '';
            if (restored) {
              setConversationId(restored);
            }
          } catch {}
        }
        const url = `/api/chat/history?subject=${encodeURIComponent(subject)}${conversationId ? `&conversationId=${encodeURIComponent(conversationId)}` : ''}&limit=50`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        const serverMsgs = Array.isArray(data?.messages) ? data.messages : [];
        const mapped = serverMsgs.map((m: any) => ({
          id: String(m.id ?? `${Date.now()}-${Math.random()}`),
          from: m.role === 'assistant' ? 'ai' : 'user',
          text: String(m.content ?? ''),
        }));
        // Replace with canonical server history once available to avoid duplicates
        setMessages((prev) => (mapped.length > 0 ? mapped : prev));
      } catch {
        // ignore fetch errors; keep local state
      }
    }
    loadHistory();
    return () => { cancelled = true; };
  }, [subject, conversationId]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Bar */}
      <TopBar studentName={studentName} />

      {/* Main Content - Scrollable */}
      <main className="flex-1 overflow-y-auto pb-20">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          {activeTab === 'profile' ? (
            <ProfilePage />
          ) : activeTab === 'tests' ? (
            <TestsTab subject={subject} grade={profile?.grade ?? undefined} board={profile?.board ?? undefined} />
          ) : activeTab === 'notes' ? (
            <NotesTab />
          ) : (
            <>
              {/* Subject + Threads */}
              <SubjectThreadList
                subject={subject}
                setSubject={(s) => { setSubject(s); setConversationId(undefined); setMessages([]); }}
                onSelectThread={(cid) => setConversationId(cid)}
                onNewThread={(s) => { setSubject(s); setConversationId(undefined); setMessages([]); }}
                selectedConversationId={conversationId}
              />

              {/* Chat Panel */}
              <ChatPanel messages={messages} />

              {/* Quick Input Box */}
              <QuickInputBox
                initialPreferredLang={profile?.language ?? (profile as any)?.preferred_language ?? (profile as any)?.preferredLanguage ?? null}
                onReply={(reply: string, userMessage?: string, language?: string, suggestions?: string[]) => {
                  // push both user and ai messages to chat, include language and suggestions when available
                  setMessages((prev) => [
                    ...prev,
                    ...(userMessage ? [{ id: String(Date.now()) + '-u', from: 'user' as const, text: userMessage }] : []),
                    { id: String(Date.now()) + '-a', from: 'ai' as const, text: reply, language, suggestions },
                  ]);
                }}
                subject={subject}
                conversationId={conversationId}
                onConversationId={(cid?: string) => {
                  setConversationId(cid);
                  try {
                    if (cid) window.sessionStorage.setItem(`spinzy:lastcid:${subject}`, cid);
                  } catch {}
                }}
              />

              {/* Continue Learning Section */}
              <ContinueLearning />

              {/* Suggested For You */}
              <SuggestedContent />

              {/* Feature Grid */}
              <FeatureGrid />

              {/* Study Goals / Streak Zone */}
              <StudyGoals />

              {/* Parent Mode Card */}
              <ParentModeCard />
            </>
          )}
        </div>
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default StudentHomeDashboard;