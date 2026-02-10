'use client';
/**
 * FILE OBJECTIVE:
 * - Responsive student dashboard with "Zero Cognitive Overload" design principle.
 * - Refactored IA: Home, Notes, Practice/Tests, Doubts, Profile (per PRD).
 * - Mobile-first with desktop sidebar layout.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/dashboard/components/StudentHomeDashboard.spec.ts
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | major refactor per PRD - new IA, HomeTab, DoubtsTab
 * - 2026-02-01 | claude | read URL tab param, pass onNavigate to FeatureGrid
 * - 2025-01-23 | copilot | refactored for responsive design - mobile + desktop viewports
 * - 2025-01-22 | copilot | optimized for mobile-first with streamlined UX
 */
import React, { useState, useEffect, useCallback } from 'react';
import TopBar from './TopBar';
import useCurrentUser from '@/hooks/useCurrentUser';
import { useGlobalLoader } from '@/context/GlobalLoaderProvider';
import ProfilePage from '@/app/profile/page';
import QuickInputBox from './QuickInputBox';
import SubjectThreadList from './SubjectThreadList';
import ChatPanel from './ChatPanel';
import BottomNavigation, { type TabId } from './BottomNavigator';
import TestsTab from './Tests';
import NotesTab from './Notes';
import { HomeTab } from './home';
import { DoubtsTab } from './doubts';
import { TestNudgeFloating } from '@/components/TestNudgePrompt';

interface StudentHomeDashboardProps { [key: string]: unknown }

const StudentHomeDashboard: React.FC<StudentHomeDashboardProps> = () => {
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [messages, setMessages] = useState<{ id: string; from: 'user' | 'ai'; text: string; language?: string; suggestions?: string[] }[]>([]);
  const [subject, setSubject] = useState<string>('general');
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const { data: profile, loading } = useCurrentUser();
  const studentName = profile?.name ?? 'Student';
  const { startLoading, stopLoading } = useGlobalLoader();

  // Read tab from URL search params (e.g. /dashboard?tab=notes&noteId=xxx)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'tests' || tab === 'notes' || tab === 'profile' || tab === 'doubts') {
      setActiveTab(tab);
    }
  }, []);

  // Callback for in-page tab navigation
  const _navigateToTab = useCallback((tab: TabId) => {
    setActiveTab(tab);
  }, []);

  // Use global loader overlay while canonical profile is being fetched.
  useEffect(() => {
    if (loading && !profile) {
      try { startLoading('Loading…'); } catch { /* ignore */ }
    } else {
      try { stopLoading(); } catch { /* ignore */ }
    }
    return () => { try { stopLoading(); } catch { /* ignore */ } };
  }, [loading, profile, startLoading, stopLoading]);

  // Load chat history per subject and optionally conversationId
  useEffect(() => {
    let cancelled = false;
    async function loadHistory() {
      try {
        if (!conversationId) {
          try {
            const key = `spinzy:lastcid:${subject}`;
            const raw = typeof window !== 'undefined' ? window.sessionStorage.getItem(key) : null;
            const restored = raw ? String(raw) : '';
            if (restored) setConversationId(restored);
          } catch {}
        }
        const url = `/api/chat/history?subjectId=${encodeURIComponent(subject)}${conversationId ? `&conversationId=${encodeURIComponent(conversationId)}` : ''}&limit=50`;
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
        setMessages((prev) => (mapped.length > 0 ? mapped : prev));
      } catch {}
    }
    loadHistory();
    return () => { cancelled = true; };
  }, [subject, conversationId]);

  // Tab content renderer
  const renderTabContent = () => {
    if (activeTab === 'profile') return <ProfilePage />;
    if (activeTab === 'tests') return <TestsTab subject={subject} grade={profile?.grade ?? undefined} board={profile?.board ?? undefined} />;
    if (activeTab === 'notes') return <NotesTab />;
    if (activeTab === 'doubts') return <DoubtsTab />;

    // Home tab - New design per PRD with HomeTab component and chat access
    return (
      <div className="lg:flex lg:gap-6 xl:gap-8">
        {/* Main Content Column */}
        <div className="flex-1 space-y-4 min-w-0">
          {/* HomeTab - Primary landing view */}
          <HomeTab
            onStartLearning={(_topicId) => {
              // Navigate to notes or initiate learning
              setActiveTab('notes');
            }}
            onContinueActivity={(activityId, type) => {
              // Resume activity based on type
              if (type === 'note') setActiveTab('notes');
              else if (type === 'test' || type === 'practice') setActiveTab('tests');
              else setActiveTab('home');
            }}
          />

          {/* Quick Chat Access - Collapsed by default on home */}
          <details className="group">
            <summary className="cursor-pointer list-none flex items-center justify-between p-4 bg-card dark:bg-slate-800/50 rounded-xl border border-border/30">
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                💬 Need to ask something quick?
              </span>
              <svg className="w-5 h-5 text-muted-foreground group-open:rotate-180 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="mt-3 space-y-4">
              {/* Subject selector - compact horizontal scroll */}
              <SubjectThreadList
                subject={subject}
                setSubject={(s) => { setSubject(s); setConversationId(undefined); setMessages([]); }}
                onSelectThread={(cid) => setConversationId(cid)}
                onNewThread={(s) => { setSubject(s); setConversationId(undefined); setMessages([]); }}
                selectedConversationId={conversationId}
              />

              {/* Chat Panel */}
              <ChatPanel messages={messages} />

              {/* Quick Input */}
              <QuickInputBox
                initialPreferredLang={profile?.language ?? (profile as any)?.preferred_language ?? (profile as any)?.preferredLanguage ?? null}
                onReply={(reply: string, userMessage?: string, language?: string, suggestions?: string[]) => {
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
                  try { if (cid) window.sessionStorage.setItem(`spinzy:lastcid:${subject}`, cid); } catch { /* ignore */ }
                }}
              />
            </div>
          </details>
        </div>

        {/* Desktop Sidebar - Shows quick navigation and chat */}
        <aside className="hidden lg:block w-80 xl:w-96 flex-shrink-0 space-y-6">
          {/* Chat Card for Desktop */}
          <div className="bg-card dark:bg-slate-800/50 rounded-xl p-4 border border-border/30">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <span>💬</span> Quick Chat
            </h3>
            <SubjectThreadList
              subject={subject}
              setSubject={(s) => { setSubject(s); setConversationId(undefined); setMessages([]); }}
              onSelectThread={(cid) => setConversationId(cid)}
              onNewThread={(s) => { setSubject(s); setConversationId(undefined); setMessages([]); }}
              selectedConversationId={conversationId}
            />
            <div className="mt-3">
              <ChatPanel messages={messages} />
              <QuickInputBox
                initialPreferredLang={profile?.language ?? (profile as any)?.preferred_language ?? (profile as any)?.preferredLanguage ?? null}
                onReply={(reply: string, userMessage?: string, language?: string, suggestions?: string[]) => {
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
                  try { if (cid) window.sessionStorage.setItem(`spinzy:lastcid:${subject}`, cid); } catch { /* ignore */ }
                }}
              />
            </div>
          </div>
        </aside>

        {/* Bottom spacing for nav */}
        <div className="h-20 lg:h-0" />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background dark:bg-slate-900 flex flex-col">
      <TopBar studentName={studentName} activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex-1 overflow-y-auto">
        {/* Responsive container: narrow on mobile, wide on desktop */}
        <div className="max-w-lg lg:max-w-6xl xl:max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-3 lg:py-6">
          {renderTabContent()}
        </div>
      </main>
      {/* Bottom navigation - hide on desktop */}
      <div className="lg:hidden">
        <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
      {/* Test nudge prompts - floating notification for encouraging tests */}
      <TestNudgeFloating />
    </div>
  );
};

export default StudentHomeDashboard;