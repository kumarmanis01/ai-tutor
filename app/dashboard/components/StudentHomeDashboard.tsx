'use client';
/**
 * FILE OBJECTIVE:
 * - Mobile-first student dashboard with chat-centric design, efficient navigation,
 *   and progressive disclosure of features.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/dashboard/components/StudentHomeDashboard.spec.ts
 *
 * EDIT LOG:
 * - 2025-01-22 | copilot | optimized for mobile-first with streamlined UX
 */
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

// Collapsible section for discovery content
const CollapsibleSection = ({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-border/30 pt-3">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-2 text-sm font-medium text-muted-foreground active:bg-muted/30 rounded-lg px-2 -mx-2"
      >
        <span>{title}</span>
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && <div className="mt-3 space-y-4">{children}</div>}
    </div>
  );
};

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
      try { startLoading('Loading…'); } catch {}
    } else {
      try { stopLoading(); } catch {}
    }
    return () => { try { stopLoading(); } catch {} };
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

    // Home/Chat tab - chat-centric mobile-first design
    return (
      <div className="space-y-4">
        {/* Subject selector - compact horizontal scroll */}
        <SubjectThreadList
          subject={subject}
          setSubject={(s) => { setSubject(s); setConversationId(undefined); setMessages([]); }}
          onSelectThread={(cid) => setConversationId(cid)}
          onNewThread={(s) => { setSubject(s); setConversationId(undefined); setMessages([]); }}
          selectedConversationId={conversationId}
        />

        {/* Chat Panel - main focus area */}
        <ChatPanel messages={messages} />

        {/* Quick Input - always visible and accessible */}
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
            try { if (cid) window.sessionStorage.setItem(`spinzy:lastcid:${subject}`, cid); } catch {}
          }}
        />

        {/* Discovery Section - Collapsible for mobile */}
        <CollapsibleSection title="📚 Continue Learning" defaultOpen={false}>
          <ContinueLearning />
        </CollapsibleSection>

        <CollapsibleSection title="💡 Suggested For You" defaultOpen={false}>
          <SuggestedContent />
        </CollapsibleSection>

        <CollapsibleSection title="🔥 Your Progress" defaultOpen={false}>
          <StudyGoals />
        </CollapsibleSection>

        <CollapsibleSection title="⚡ Quick Access" defaultOpen={false}>
          <FeatureGrid />
          <div className="mt-4">
            <ParentModeCard />
          </div>
        </CollapsibleSection>

        {/* Bottom spacing for nav */}
        <div className="h-20" />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background dark:bg-slate-900 flex flex-col">
      <TopBar studentName={studentName} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-3 py-3">
          {renderTabContent()}
        </div>
      </main>
      <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default StudentHomeDashboard;