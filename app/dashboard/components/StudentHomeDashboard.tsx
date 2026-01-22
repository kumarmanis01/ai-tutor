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

// Quick action card component for homepage
const QuickActionCard = ({ icon, label, labelHi, gradient, onClick }: { icon: React.ReactNode; label: string; labelHi: string; gradient: string; onClick?: () => void }) => (
  <button
    onClick={onClick}
    className={`group flex flex-col items-center justify-center p-4 rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300`}
  >
    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
      {icon}
    </div>
    <span className="text-xs font-medium">{label}</span>
    <span className="text-[10px] text-white/80">{labelHi}</span>
  </button>
);

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
        // Replace with canonical server history once available to avoid duplicates
        setMessages((prev) => (mapped.length > 0 ? mapped : prev));
      } catch {
        // ignore fetch errors; keep local state
      }
    }
    loadHistory();
    return () => { cancelled = true; };
  }, [subject, conversationId]);

  // Tab content with fade transition
  const renderTabContent = () => {
    const baseClass = "animate-fadeIn";
    
    if (activeTab === 'profile') {
      return <div className={baseClass}><ProfilePage /></div>;
    }
    
    if (activeTab === 'tests') {
      return (
        <div className={baseClass}>
          <TestsTab subject={subject} grade={profile?.grade ?? undefined} board={profile?.board ?? undefined} />
        </div>
      );
    }
    
    if (activeTab === 'notes') {
      return <div className={baseClass}><NotesTab /></div>;
    }

    // Home tab content
    return (
      <div className={`${baseClass} space-y-6`}>
        {/* Quick Actions Row */}
        <div className="grid grid-cols-4 gap-3">
          <QuickActionCard
            icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            label="Ask Doubt"
            labelHi="संदेह पूछें"
            gradient="from-blue-500 to-cyan-500"
          />
          <QuickActionCard
            icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>}
            label="Practice"
            labelHi="अभ्यास"
            gradient="from-purple-500 to-pink-500"
            onClick={() => setActiveTab('tests')}
          />
          <QuickActionCard
            icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>}
            label="Notes"
            labelHi="नोट्स"
            gradient="from-emerald-500 to-teal-500"
            onClick={() => setActiveTab('notes')}
          />
          <QuickActionCard
            icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            label="Videos"
            labelHi="वीडियो"
            gradient="from-orange-500 to-amber-500"
          />
        </div>

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

        {/* Divider with section title */}
        <div className="flex items-center gap-3 pt-2">
          <div className="flex-1 h-px bg-border/50" />
          <span className="text-xs text-muted-foreground font-medium">Your Learning Journey</span>
          <div className="flex-1 h-px bg-border/50" />
        </div>

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
        
        {/* Footer spacing for bottom nav */}
        <div className="h-4" />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 flex flex-col">
      {/* Top Bar */}
      <TopBar studentName={studentName} />

      {/* Main Content - Scrollable */}
      <main className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {renderTabContent()}
        </div>
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      
      {/* Animation styles */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default StudentHomeDashboard;