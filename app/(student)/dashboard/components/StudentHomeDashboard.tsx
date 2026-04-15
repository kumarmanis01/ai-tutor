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
 * - 2026-04-15T00:30:00Z | staff-engineer | removed page-level TopBar; use global Topbar in student layout
 */
import React, { useState, useEffect, useCallback } from 'react';
// TopBar removed in favor of global `components/student/layout/Topbar.tsx`.
// This page-level TopBar caused duplicate headers; the global Topbar is rendered
// by `app/(student)/layout.tsx` and provides the canonical navigation for
// authenticated student routes.
import useCurrentUser from '@/hooks/useCurrentUser';
import { useGlobalLoader } from '@/context/GlobalLoaderProvider';
import ProfilePage from '@/app/profile/page';
// Quick chat removed from Home view per curriculum-first requirement
import BottomNavigation, { type TabId } from './BottomNavigator';
import TestsTab from './Tests';
import NotesTab from './Notes';
import { HomeTab } from './home';
import { DoubtsTab } from './doubts';
import { TestNudgeFloating } from '@/components/TestNudgePrompt';

interface StudentHomeDashboardProps { [key: string]: unknown }

const StudentHomeDashboard: React.FC<StudentHomeDashboardProps> = () => {
  const [activeTab, setActiveTab] = useState<TabId>('home');
  // Chat state removed for Home -- chat remains available in dedicated areas
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
      try { startLoading('Loading...'); } catch { /* ignore */ }
    } else {
      try { stopLoading(); } catch { /* ignore */ }
    }
    return () => { try { stopLoading(); } catch { /* ignore */ } };
  }, [loading, profile, startLoading, stopLoading]);

  // Chat-related effects intentionally omitted from Home

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

          {/* Quick Chat removed from Home to reduce distractions */}
        </div>

        {/* Desktop Quick Chat removed from Home; chat remains in its dedicated sections */}

        {/* Bottom spacing for nav */}
        <div className="h-20 lg:h-0" />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background dark:bg-slate-900 flex flex-col">
      {/* Page-level TopBar removed; global Topbar provides header */}
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