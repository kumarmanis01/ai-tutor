/**
 * FILE OBJECTIVE:
 * - Client-side parent dashboard with subject progress drill-down,
 *   weak topic awareness, readiness indicators, and child linking.
 *
 * EDIT LOG:
 * - 2025-01-XX | copilot | created parent dashboard client component
 * - 2026-02-04 | claude | enhanced with progress, weak topics, readiness, invite codes
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { logger } from '@/lib/logger';
import { toast } from '@/lib/toast';

const CLASS_NAME = 'ParentDashboardClient';

// ─── Types ─────────────────────────────────────────────────────────────

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

interface SubjectProgressData {
  subject: string;
  totalTopics: number;
  topicsCovered: number;
  coveragePercent: number;
  averageMastery: number;
  strongTopics: number;
  weakTopics: number;
  chapters: {
    chapter: string;
    topics: { topicId: string; masteryLevel: string; accuracy: number; questionsAttempted: number }[];
    averageMastery: number;
    topicCount: number;
  }[];
}

interface AttentionItem {
  topicId: string;
  subject: string;
  chapter: string;
  masteryLevel: string;
  accuracy: number;
  reason: string;
}

interface ReadinessItem {
  subject: string;
  topicsCovered: number;
  totalTopics: number;
  coveragePercent: number;
  avgMastery: number;
  readinessScore: number;
  readinessLabel: string;
}

interface StudentDetailData {
  studentId: string;
  subjectProgress: SubjectProgressData[];
  attentionFlags: AttentionItem[];
  readiness: ReadinessItem[];
}

// ─── Helpers ───────────────────────────────────────────────────────────

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

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

function masteryColor(level: string): string {
  switch (level) {
    case 'expert': return 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20';
    case 'advanced': return 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20';
    case 'intermediate': return 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/20';
    case 'beginner': return 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20';
    default: return 'text-gray-500 bg-gray-50';
  }
}

function readinessColor(label: string): string {
  switch (label) {
    case 'ready': return 'text-green-600 border-green-200 bg-green-50';
    case 'on_track': return 'text-yellow-600 border-yellow-200 bg-yellow-50';
    case 'needs_work': return 'text-amber-600 border-amber-200 bg-amber-50';
    default: return 'text-gray-500 border-gray-200 bg-gray-50';
  }
}

function friendlyReadinessLabel(label: string): string {
  switch (label) {
    case 'ready': return 'Looking great';
    case 'on_track': return 'Making progress';
    case 'needs_work': return 'Developing skills';
    case 'not_started': return 'Just getting started';
    default: return label.replace(/_/g, ' ');
  }
}

// ─── Readiness Badge ───────────────────────────────────────────────────

function ReadinessBadge({ item }: { item: ReadinessItem }) {
  return (
    <div className={`border rounded-lg p-3 ${readinessColor(item.readinessLabel)}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-sm capitalize">{item.subject}</span>
        <span className="text-xs font-bold">{item.readinessScore}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
        <div
          className={`h-2 rounded-full ${
            item.readinessLabel === 'ready' ? 'bg-green-500' :
            item.readinessLabel === 'on_track' ? 'bg-yellow-500' :
            item.readinessLabel === 'needs_work' ? 'bg-red-500' : 'bg-gray-400'
          }`}
          style={{ width: `${Math.min(item.readinessScore, 100)}%` }}
        />
      </div>
      <div className="flex justify-between text-xs mt-1">
        <span>{item.topicsCovered}/{item.totalTopics} topics</span>
        <span className="capitalize">{friendlyReadinessLabel(item.readinessLabel)}</span>
      </div>
    </div>
  );
}

// ─── Attention Flag Item ───────────────────────────────────────────────

function friendlyFlagReason(reason: string): string {
  switch (reason) {
    case 'very_low_accuracy': return 'Developing skills';
    case 'low_mastery': return 'Room to grow';
    case 'declining_accuracy': return 'Needs a little more support';
    default: return 'Could use more practice';
  }
}

function AttentionFlagItem({ flag }: { flag: AttentionItem }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-amber-100 last:border-0">
      <div>
        <span className="text-sm font-medium text-gray-900 dark:text-white">{flag.subject}</span>
        <span className="text-gray-400 mx-1">/</span>
        <span className="text-sm text-gray-600 dark:text-gray-400">{flag.chapter}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-amber-600">{friendlyFlagReason(flag.reason)}</span>
      </div>
    </div>
  );
}

// ─── Subject Progress Card ─────────────────────────────────────────────

function SubjectProgressCard({ subject }: { subject: SubjectProgressData }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-medium text-gray-900 dark:text-white capitalize">{subject.subject}</span>
          <span className="text-xs text-gray-500">
            {subject.topicsCovered}/{subject.totalTopics} topics
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-24 bg-gray-200 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-indigo-500"
              style={{ width: `${Math.min(subject.coveragePercent, 100)}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 w-10 text-right">{subject.coveragePercent}%</span>
          <span className="text-gray-400">{expanded ? '\u25B2' : '\u25BC'}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 dark:border-slate-700 p-3 space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-green-50 dark:bg-green-900/20 rounded p-2">
              <div className="font-bold text-green-600">{subject.strongTopics}</div>
              <div className="text-gray-500">Strong</div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded p-2">
              <div className="font-bold text-red-600">{subject.weakTopics}</div>
              <div className="text-gray-500">Weak</div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded p-2">
              <div className="font-bold text-purple-600">{subject.averageMastery.toFixed(1)}/4</div>
              <div className="text-gray-500">Mastery</div>
            </div>
          </div>

          {subject.chapters.map((ch) => (
            <div key={ch.chapter} className="pl-2 border-l-2 border-indigo-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">{ch.chapter}</span>
                <span className="text-xs text-gray-500">{ch.topicCount} topics</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {ch.topics.map((t) => (
                  <span
                    key={t.topicId}
                    className={`text-xs px-2 py-0.5 rounded-full ${masteryColor(t.masteryLevel)}`}
                    title={`${Math.round(t.accuracy * 100)}% accuracy, ${t.questionsAttempted} questions`}
                  >
                    {t.masteryLevel.charAt(0).toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Student Detail Panel ──────────────────────────────────────────────

function StudentDetailPanel({ studentId, onClose }: { studentId: string; onClose: () => void }) {
  const [data, setData] = useState<StudentDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'progress' | 'attention' | 'readiness'>('progress');

  useEffect(() => {
    async function fetchDetail() {
      try {
        const res = await fetch(`/api/parent/progress?studentId=${studentId}`);
        if (res.ok) {
          setData(await res.json());
        }
      } catch (err) {
        logger.error('Fetch student detail failed', { error: String(err) });
      } finally {
        setLoading(false);
      }
    }
    fetchDetail();
  }, [studentId]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
        <div className="animate-pulse text-gray-400 text-center">Loading progress data...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 text-center">
        <p className="text-gray-500">Unable to load progress data.</p>
        <button onClick={onClose} className="mt-2 text-indigo-600 hover:underline text-sm">Close</button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-slate-700">
        {(['progress', 'attention', 'readiness'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${
              activeTab === tab
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'progress' ? 'Subjects' : tab === 'attention' ? `Needs Attention (${data.attentionFlags.length})` : 'Readiness'}
          </button>
        ))}
        <button onClick={onClose} className="px-3 text-gray-400 hover:text-gray-600">&times;</button>
      </div>

      <div className="p-4 max-h-[60vh] overflow-y-auto">
        {activeTab === 'progress' && (
          <div className="space-y-2">
            {data.subjectProgress.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No subject progress data yet.</p>
            ) : (
              data.subjectProgress.map((sp) => <SubjectProgressCard key={sp.subject} subject={sp} />)
            )}
          </div>
        )}

        {activeTab === 'attention' && (
          <div>
            {data.attentionFlags.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">&#10004;&#65039;</div>
                <p className="text-green-600 font-medium">Doing well in all areas!</p>
                <p className="text-gray-500 text-sm mt-1">No topics need extra support right now.</p>
              </div>
            ) : (
              <div className="bg-amber-50 dark:bg-amber-900/10 rounded-lg p-3">
                <p className="text-sm text-amber-700 dark:text-amber-400 font-medium mb-2">
                  These topics may need a bit more practice:
                </p>
                {data.attentionFlags.map((flag) => (
                  <AttentionFlagItem key={flag.topicId} flag={flag} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'readiness' && (
          <div className="space-y-3">
            {data.readiness.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No readiness data yet.</p>
            ) : (
              data.readiness.map((r) => <ReadinessBadge key={r.subject} item={r} />)
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Student Card ──────────────────────────────────────────────────────

function StudentCard({ student, onViewDetail }: { student: StudentProgress; onViewDetail: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-slate-700">
        <div className="flex items-center space-x-4">
          <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white text-xl font-bold shadow-md overflow-hidden">
            {student.studentImage ? (
              <Image src={student.studentImage} alt={student.studentName} fill className="object-cover" sizes="56px" />
            ) : (
              student.studentName.charAt(0).toUpperCase()
            )}
          </div>
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
          <button
            onClick={onViewDetail}
            className="px-3 py-1.5 text-sm bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors dark:bg-indigo-900/20 dark:text-indigo-400"
          >
            Details
          </button>
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

      {/* Expand/Collapse Recent Activity */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full py-2 text-sm text-center text-indigo-600 dark:text-indigo-400 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
      >
        {expanded ? '\u25B2 Show Less' : '\u25BC Recent Activity'}
      </button>

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

// ─── Link Student Form ─────────────────────────────────────────────────

function LinkStudentForm({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: any = { action: 'link' };
      if (mode === 'email') {
        if (!email.trim()) return;
        payload.studentEmail = email;
      } else {
        if (!code.trim()) return;
        payload.inviteCode = code.trim().toUpperCase();
      }

      const res = await fetch('/api/parent/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast('Student linked successfully!');
        setEmail('');
        setCode('');
        onSuccess();
      } else {
        const data = await res.json();
        toast(data.error || 'Failed to link student');
      }
    } catch (error) {
      toast('Failed to link student');
      logger.error('Link student failed', { className: CLASS_NAME, error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-4">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Link a Student</h3>

      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => setMode('email')}
          className={`flex-1 py-1.5 text-sm rounded-lg transition-colors ${
            mode === 'email' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-400'
          }`}
        >
          By Email
        </button>
        <button
          type="button"
          onClick={() => setMode('code')}
          className={`flex-1 py-1.5 text-sm rounded-lg transition-colors ${
            mode === 'code' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-400'
          }`}
        >
          By Invite Code
        </button>
      </div>

      {mode === 'email' ? (
        <>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
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
        </>
      ) : (
        <>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Ask your child to generate an invite code from their profile, then enter it here.
          </p>
          <div className="flex space-x-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Enter 8-digit code"
              maxLength={8}
              className="flex-1 px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-center tracking-widest"
            />
            <button
              type="submit"
              disabled={loading || code.length < 8}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '...' : 'Link'}
            </button>
          </div>
        </>
      )}
    </form>
  );
}

// ─── Main Parent Dashboard ─────────────────────────────────────────────

export default function ParentDashboardClient() {
  const { status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/parent/dashboard');
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError('Failed to load dashboard');
      logger.error('Fetch parent dashboard failed', { className: CLASS_NAME, error: String(err) });
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
          <button onClick={fetchData} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
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
              &larr; Back to Dashboard
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

        {/* Student Detail Panel */}
        {selectedStudentId && (
          <StudentDetailPanel
            studentId={selectedStudentId}
            onClose={() => setSelectedStudentId(null)}
          />
        )}

        {/* Students List */}
        {data && data.students.length > 0 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Your Children</h2>
            {data.students.map((student) => (
              <StudentCard
                key={student.studentId}
                student={student}
                onViewDetail={() => setSelectedStudentId(
                  selectedStudentId === student.studentId ? null : student.studentId
                )}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">&#128104;&#8205;&#128105;&#8205;&#128103;&#8205;&#128102;</div>
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
