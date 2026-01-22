'use client';

import React from 'react';
import { useStreaksAndGoals } from '@/hooks/useStreaksAndGoals';

interface StudyGoalsProps { [key: string]: unknown }

const StudyGoals: React.FC<StudyGoalsProps> = () => {
  const { streaks, loading } = useStreaksAndGoals();
  const daily = streaks.find(s => s.kind === 'daily_study');
  const streakDays = daily?.current ?? 0;
  const todayGoalMinutes = 30;
  const completedMinutes = Math.min(todayGoalMinutes, streakDays * 10);
  const progressPercentage = (completedMinutes / todayGoalMinutes) * 100;
  const minutesLeft = todayGoalMinutes - completedMinutes;

  // Streak milestones
  const milestones = [7, 14, 30, 60, 100];
  const nextMilestone = milestones.find(m => m > streakDays) || milestones[milestones.length - 1];
  const progressToMilestone = Math.min((streakDays / nextMilestone) * 100, 100);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-lg font-semibold text-foreground">
          Study Goals & Streak
          <span className="text-muted-foreground text-sm ml-2">/ लक्ष्य</span>
        </h2>
        <button className="text-sm text-primary hover:underline">Edit Goals</button>
      </div>

      <div className="bg-gradient-to-br from-primary/5 via-accent/5 to-primary/10 dark:from-primary/10 dark:via-accent/5 dark:to-primary/5 rounded-2xl p-5 border border-primary/20">
        {/* Streak Section */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {/* Streak flame with animation */}
            <div className="relative">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-red-500 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-3xl animate-bounce">🔥</span>
              </div>
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-red-500 rounded-2xl blur-lg opacity-30 -z-10" />
            </div>
            
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
                  {loading ? '…' : streakDays}
                </span>
                <span className="text-lg text-muted-foreground">days</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {streakDays === 0 ? 'Start your streak today!' : 'Study Streak / अध्ययन लकीर'}
              </p>
            </div>
          </div>

          {/* Milestone badge */}
          <div className="text-right">
            <div className="inline-flex items-center gap-1.5 bg-white/80 dark:bg-slate-800/80 px-3 py-1.5 rounded-full border border-primary/20">
              <span className="text-lg">🎯</span>
              <span className="text-sm font-medium text-foreground">{nextMilestone} day goal</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {nextMilestone - streakDays} days to go
            </p>
          </div>
        </div>

        {/* Milestone progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>Progress to {nextMilestone}-day milestone</span>
            <span className="font-medium text-primary">{Math.round(progressToMilestone)}%</span>
          </div>
          <div className="w-full bg-white/50 dark:bg-slate-800/50 rounded-full h-2 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-400 via-red-500 to-pink-500 transition-all duration-700"
              style={{ width: `${progressToMilestone}%` }}
            />
          </div>
          {/* Milestone markers */}
          <div className="relative mt-1">
            {milestones.map((m, i) => (
              <div
                key={m}
                className="absolute top-0 transform -translate-x-1/2"
                style={{ left: `${(m / nextMilestone) * 100}%` }}
              >
                <span className={`text-[10px] ${streakDays >= m ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                  {i < milestones.length - 1 ? m : ''}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Today's Goal Card */}
        <div className="bg-white/70 dark:bg-slate-800/70 rounded-xl p-4 border border-white/50 dark:border-slate-700/50 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <span className="text-sm font-semibold text-foreground">Today's Goal</span>
                <span className="text-xs text-muted-foreground block">आज का लक्ष्य</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {completedMinutes}
              </span>
              <span className="text-sm text-muted-foreground">/{todayGoalMinutes} mins</span>
            </div>
          </div>
          
          {/* Circular progress alternative */}
          <div className="w-full bg-muted/50 rounded-full h-3 overflow-hidden mb-2">
            <div
              className="bg-gradient-to-r from-emerald-400 to-teal-500 h-3 rounded-full transition-all duration-500 relative"
              style={{ width: `${progressPercentage}%` }}
            >
              {/* Shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
            </div>
          </div>
          
          {/* Motivational message */}
          <p className="text-sm text-center text-foreground font-medium">
            {progressPercentage >= 100 ? (
              <span className="text-emerald-600 dark:text-emerald-400">🎉 Goal achieved! Great work!</span>
            ) : (
              <span>
                {minutesLeft > 0 ? `Just ${minutesLeft} minutes left! 💪` : 'Almost there! Keep going! 🚀'}
              </span>
            )}
          </p>
        </div>

        {/* Weekly stats preview */}
        <div className="flex justify-between mt-4 pt-4 border-t border-white/30 dark:border-slate-700/30">
          <div className="text-center">
            <span className="text-lg font-bold text-foreground">{Math.min(7, streakDays)}</span>
            <p className="text-xs text-muted-foreground">This week</p>
          </div>
          <div className="text-center">
            <span className="text-lg font-bold text-foreground">{completedMinutes * 7}</span>
            <p className="text-xs text-muted-foreground">Total mins</p>
          </div>
          <div className="text-center">
            <span className="text-lg font-bold text-foreground">{Math.round(progressPercentage)}%</span>
            <p className="text-xs text-muted-foreground">Completion</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default StudyGoals;