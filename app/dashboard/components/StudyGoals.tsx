'use client';

import React from 'react';

interface StudyGoalsProps { [key: string]: unknown }

const StudyGoals: React.FC<StudyGoalsProps> = () => {
  const todayGoalMinutes = 10;
  const completedMinutes = 4;
  const progressPercentage = (completedMinutes / todayGoalMinutes) * 100;
  const streakDays = 3;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground px-1">
        Study Goals & Streak
        <span className="text-muted-foreground text-sm ml-2">/ लक्ष्य</span>
      </h2>

      <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-lg p-5 border border-primary/20">
        {/* Today's Goal */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-base font-semibold text-foreground">
              Today's Study Goal
            </span>
            <span className="text-sm font-medium text-primary">
              {completedMinutes}/{todayGoalMinutes} mins
            </span>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-white/50 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-primary to-accent h-3 rounded-full transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Streak */}
        <div className="flex items-center justify-between bg-white/50 rounded-lg p-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔥</span>
            <div>
              <p className="text-sm font-semibold text-foreground">Study Streak</p>
              <p className="text-xs text-muted-foreground">Keep it going!</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-primary">{streakDays}</p>
            <p className="text-xs text-muted-foreground">days</p>
          </div>
        </div>

        {/* Motivational Text */}
        <p className="text-sm text-center text-foreground font-medium">
          Great! Just {todayGoalMinutes - completedMinutes} minutes left for full progress 💪
        </p>
      </div>
    </section>
  );
};

export default StudyGoals;