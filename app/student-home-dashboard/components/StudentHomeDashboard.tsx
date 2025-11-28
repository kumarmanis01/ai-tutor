'use client';

import React, { useState } from 'react';
import TopBar from './TopBar';
import QuickInputBox from './QuickInputBox';
import ContinueLearning from './ContinueLearning';
import SuggestedContent from './SuggestedContent';
import FeatureGrid from './FeatureGrid';
import StudyGoals from './StudyGoals';
import ParentModeCard from './ParentModeCard';
import BottomNavigation from './BottomNavigator';

interface StudentHomeDashboardProps { [key: string]: unknown }

const StudentHomeDashboard: React.FC<StudentHomeDashboardProps> = () => {
  const [activeTab, setActiveTab] = useState<'home' | 'tests' | 'notes' | 'profile'>('home');
  
  // Mock student data - in real app, this would come from authentication context
  const studentName = 'Anay';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Bar */}
      <TopBar studentName={studentName} />

      {/* Main Content - Scrollable */}
      <main className="flex-1 overflow-y-auto pb-20">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          {/* Quick Input Box */}
          <QuickInputBox />

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
        </div>
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default StudentHomeDashboard;