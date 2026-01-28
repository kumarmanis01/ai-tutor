/**
 * FILE OBJECTIVE:
 * - Client-side parent dashboard component showing linked students' progress.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/parent/ParentDashboardClient.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2025-01-XX | copilot | created parent dashboard client component
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { logger } from '@/lib/logger';
import { toast } from '@/lib/toast';

const CLASS_NAME = 'ParentDashboardClient';

interface StudentStats {
  totalLessonsCompleted: number;
  totalTestsTaken: number;
  averageTestScore: number;
  totalLearningMinutes: number;
  sessionsThisWeek: number;
  lastActiveAt?: string;
}

interface StudentProgress {
  studentId: string;
  studentName: string;
  studentImage?: string;
  grade?: string;
  board?: string;
  subjects: string[];
  stats: StudentStats;
  recentActivity: { type: string; description: string; timestamp: string }[];
  weeklyProgress: { date: string; lessonsCompleted: number; testsTaken: number; minutesLearned: number }[];
}

interface DashboardData {
  isParent: boolean;
  students: StudentProgress[];
  totalStudents: number;
}

/**
 * Format minutes to hours and minutes string
 */
function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

/**
 * Student card component
 */
function StudentCard({ student }: { student: StudentProgress }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-slate-700">
        <div className="flex items-center space-x-4">
          {/* Avatar */}
          <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white text-xl font-bold shadow-md overflow-hidden">
            {student.studentImage ? (
              <Image src={student.studentImage} alt={student.studentName} fill className="object-cover" sizes="56px" />
            ) : (
              student.studentName.charAt(0).toUpperCase()
            )}
          </div>
          {/* Info */}
          <div className="flex-1">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">{student.studentName}</h3>
            <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
              {student.grade && <span>Class {student.grade}</span>}
              {student.board && <span>• {student.board}</span>}
            </div>
            {student.stats.lastActiveAt && (
              <p className="text-xs text-gray-400 mt-1">
                Last active: {formatDate(student.stats.lastActiveAt)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 p-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{student.stats.totalLessonsCompleted}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Lessons</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{student.stats.totalTestsTaken}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Tests</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{student.stats.averageTestScore}%</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Avg Score</p>
        </div>
        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{formatDuration(student.stats.totalLearningMinutes)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Study Time</p>
        </div>
      </div>

      {/* Subjects */}
      {student.subjects.length > 0 && (
        <div className="px-4 pb-3">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Subjects:</p>
          <div className="flex flex-wrap gap-1">
            {student.subjects.map((subject, idx) => (
              <span key={idx} className="px-2 py-0.5 bg-gray-100 dark:bg-slate-700 rounded-full text-xs text-gray-700 dark:text-gray-300">
                {subject}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Expand/Collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full py-2 text-sm text-center text-indigo-600 dark:text-indigo-400 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
      >
        {expanded ? '▲ Show Less' : '▼ Recent Activity'}
      </button>

      {/* Recent Activity */}
      {expanded && student.recentActivity.length > 0 && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-slate-700">
          <div className="pt-3 space-y-2">
            {student.recentActivity.slice(0, 5).map((activity, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 dark:text-gray-300 truncate flex-1">{activity.description}</span>
                <span className="text-gray-400 text-xs ml-2">{formatDate(activity.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekly Progress Mini Chart */}
      {student.weeklyProgress.length > 0 && (
        <div className="px-4 pb-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">This Week:</p>
          <div className="flex items-end justify-between h-12 space-x-1">
            {student.weeklyProgress.map((day, idx) => {
              const maxVal = Math.max(...student.weeklyProgress.map(d => d.lessonsCompleted + d.testsTaken), 1);
              const height = ((day.lessonsCompleted + day.testsTaken) / maxVal) * 100;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center">
                  <div 
                    className="w-full bg-indigo-400 dark:bg-indigo-500 rounded-t"
                    style={{ height: `${Math.max(height, 4)}%` }}
                  />
                  <span className="text-[10px] text-gray-400 mt-1">{new Date(day.date).toLocaleDateString('en', { weekday: 'narrow' })}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Link student form
 */
function LinkStudentForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/parent/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentEmail: email }),
      });

      if (res.ok) {
        toast('Student linked successfully!');
        setEmail('');
        onSuccess();
      } else {
        const data = await res.json();
        toast(data.error || 'Failed to link student');
      }
    } catch (error) {
      toast('Failed to link student');
      logger.error('Link student failed', {
        className: CLASS_NAME,
        methodName: 'handleSubmit',
        error: String(error),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-4">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Link a Student</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Enter your child's email address to view their learning progress.
      </p>
      <div className="flex space-x-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="student@email.com"
          className="flex-1 px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '...' : 'Link'}
        </button>
      </div>
    </form>
  );
}

/**
 * Main Parent Dashboard Component
 */
export default function ParentDashboardClient() {
  const { status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/parent/dashboard');
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError('Failed to load dashboard');
      logger.error('Fetch parent dashboard failed', {
        className: CLASS_NAME,
        methodName: 'fetchData',
        error: String(err),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchData();
    } else if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, fetchData, router]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Parent Dashboard</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Monitor your children's learning progress
              </p>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Summary Stats */}
        {data && data.students.length > 0 && (
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80">Total Children</p>
                <p className="text-3xl font-bold">{data.totalStudents}</p>
              </div>
              <div className="text-right">
                <p className="text-sm opacity-80">Sessions This Week</p>
                <p className="text-3xl font-bold">
                  {data.students.reduce((sum, s) => sum + s.stats.sessionsThisWeek, 0)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Link Student Form */}
        <LinkStudentForm onSuccess={fetchData} />

        {/* Students List */}
        {data && data.students.length > 0 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Your Children</h2>
            {data.students.map((student) => (
              <StudentCard key={student.studentId} student={student} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">👨‍👩‍👧‍👦</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Students Linked</h3>
            <p className="text-gray-500 dark:text-gray-400">
              Link your child's account above to start monitoring their progress.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
