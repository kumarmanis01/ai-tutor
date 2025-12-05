'use client';

import React, { useState, useEffect } from 'react';
import TopBar from './TopBar';
import useCurrentUser from '@/hooks/useCurrentUser';
import { useGlobalLoader } from '@/context/GlobalLoaderProvider';
import ProfilePage from '@/app/profile/page';
import QuickInputBox from './QuickInputBox';
import ChatPanel from './ChatPanel';
import ContinueLearning from './ContinueLearning';
import SuggestedContent from './SuggestedContent';
import FeatureGrid from './FeatureGrid';
import StudyGoals from './StudyGoals';
import ParentModeCard from './ParentModeCard';
import BottomNavigation from './BottomNavigator';

interface StudentHomeDashboardProps { [key: string]: unknown }

const StudentHomeDashboard: React.FC<StudentHomeDashboardProps> = () => {
  const [activeTab, setActiveTab] = useState<'home' | 'tests' | 'notes' | 'profile'>('home');
  const [messages, setMessages] = useState<{ id: string; from: 'user' | 'ai'; text: string; language?: string; suggestions?: string[] }[]>([]);
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Bar */}
      <TopBar studentName={studentName} />

      {/* Main Content - Scrollable */}
      <main className="flex-1 overflow-y-auto pb-20">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          {activeTab === 'profile' ? (
            <ProfilePage />
          ) : (
            <>
              {/* Chat Panel */}
              <ChatPanel messages={messages} />

              {/* Quick Input Box */}
              <QuickInputBox
                onReply={(reply: string, userMessage?: string, language?: string, suggestions?: string[]) => {
                  // push both user and ai messages to chat, include language and suggestions when available
                  setMessages((prev) => [
                    ...prev,
                    ...(userMessage ? [{ id: String(Date.now()) + '-u', from: 'user' as const, text: userMessage }] : []),
                    { id: String(Date.now()) + '-a', from: 'ai' as const, text: reply, language, suggestions },
                  ]);
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