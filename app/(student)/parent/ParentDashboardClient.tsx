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
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';

const CLASS_NAME = 'ParentDashboardClient';

// ─── Types (API v2) ────────────────────────────────────────────────────

type WeeklyPoint = {
  weekStart: string;
  topicsCovered: number;
  testsTaken: number;
  averageScore: number;
  totalMinutes: number;
  sessionsCount: number;
  subjectsActive: string[];
};

type SubjectSummary = {
  subject: string;
  totalTopics: number;
  topicsCovered: number;
  coveragePercent: number;
  averageMastery: number;
  strongTopics: number;
  weakTopics: number;
  updatedAt: string;
};

type ReadinessSummary = {
  subject: string;
  coveragePercent: number;
  avgMastery: number;
  readinessScore: number;
  readinessLabel: string;
  updatedAt: string;
};

type MasteryDistribution = {
  masteryLevel: string;
  count: number;
};

type AttentionBySubject = {
  subject: string;
  count: number;
};

type StudentDashboard = {
  studentId: string;
  studentName: string;
  studentImage?: string;
  grade?: string;
  board?: string;
  subjects: string[];
  lastActiveAt?: string | null;
  attentionOpenCount: number;
  attentionBySubject: AttentionBySubject[];
  weekly: WeeklyPoint[];
  subjectProgress: SubjectSummary[];
  readiness: ReadinessSummary[];
  masteryDistribution: MasteryDistribution[];
};

type DashboardData = {
  ok: true;
  isParent: boolean;
  totalStudents: number;
  generatedAt: string;
  students: StudentDashboard[];
};

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

function readinessPillColor(label: string): string {
  switch (label) {
    case 'ready': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'on_track': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    case 'needs_work': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    default: return 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-200';
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

const PIE_COLORS: Record<string, string> = {
  beginner: '#ef4444',
  intermediate: '#f59e0b',
  advanced: '#3b82f6',
  expert: '#10b981',
};

function masteryLabel(level: string) {
  if (level === 'beginner') return 'Beginner';
  if (level === 'intermediate') return 'Intermediate';
  if (level === 'advanced') return 'Advanced';
  if (level === 'expert') return 'Expert';
  return level;
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

// ─── Subject Progress Card (drill-down) ────────────────────────────────

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

// ─── Charts ─────────────────────────────────────────────────────────────

function WeeklyTrendChart({ weekly }: { weekly: WeeklyPoint[] }) {
  const data = [...weekly]
    .sort((a, b) => new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime())
    .map((w) => ({
      week: new Date(w.weekStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      minutes: w.totalMinutes,
      topics: w.topicsCovered,
      tests: w.testsTaken,
      score: clamp(Math.round(w.averageScore), 0, 100),
    }));

  if (data.length === 0) {
    return <div className="text-sm text-gray-500 dark:text-gray-400">No weekly data yet.</div>;
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="week" tick={{ fontSize: 12 }} />
          <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
          <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Area yAxisId="left" type="monotone" dataKey="minutes" name="Study minutes" stroke="#6366f1" fill="#6366f1" fillOpacity={0.18} />
          <Bar yAxisId="left" dataKey="topics" name="Topics attempted" fill="#a78bfa" radius={[6, 6, 0, 0]} />
          <Line yAxisId="right" type="monotone" dataKey="score" name="Avg score" stroke="#10b981" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function SubjectRadar({ subjects }: { subjects: SubjectSummary[] }) {
  const data = subjects.map((s) => ({
    subject: s.subject,
    coverage: clamp(s.coveragePercent, 0, 100),
    mastery: clamp(Math.round((s.averageMastery / 4) * 100), 0, 100),
  }));

  if (data.length === 0) {
    return <div className="text-sm text-gray-500 dark:text-gray-400">No subject progress yet.</div>;
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 11 }} />
          <Radar name="Coverage %" dataKey="coverage" stroke="#6366f1" fill="#6366f1" fillOpacity={0.16} />
          <Radar name="Mastery %" dataKey="mastery" stroke="#10b981" fill="#10b981" fillOpacity={0.10} />
          <Legend />
          <Tooltip />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

function MasteryPie({ distribution }: { distribution: MasteryDistribution[] }) {
  const data = distribution
    .filter((d) => d.count > 0)
    .map((d) => ({ name: masteryLabel(d.masteryLevel), value: d.count, level: d.masteryLevel }));

  if (data.length === 0) {
    return <div className="text-sm text-gray-500 dark:text-gray-400">No mastery data yet.</div>;
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
            {data.map((entry) => (
              <Cell key={entry.level} fill={PIE_COLORS[entry.level] || '#94a3b8'} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function AttentionBar({ items }: { items: AttentionBySubject[] }) {
  const data = items.map((i) => ({ subject: i.subject, count: i.count }));
  if (data.length === 0) {
    return <div className="text-sm text-gray-500 dark:text-gray-400">No attention flags right now.</div>;
  }

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="subject" tick={{ fontSize: 12 }} interval={0} angle={-10} height={42} />
          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" name="Topics needing support" fill="#f59e0b" radius={[8, 8, 0, 0]} />
        </ComposedChart>
      </ResponsiveContainer>
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
            Email linking works only if your child has added your email under <span className="font-medium">Profile → Parent Email</span>.
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
            Ask your child to generate an invite code from their Profile (Parent Access), then enter it here.
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
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [drilldownStudentId, setDrilldownStudentId] = useState<string | null>(null);

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

  useEffect(() => {
    if (!activeStudentId && data?.students?.length) {
      setActiveStudentId(data.students[0].studentId);
    }
  }, [data, activeStudentId]);

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

  const selected = data?.students?.find((s) => s.studentId === activeStudentId) ?? null;
  const latestWeek = selected?.weekly?.[0] ?? null;
  const topReadiness =
    (selected?.readiness ?? [])
      .slice()
      .sort((a, b) => b.readinessScore - a.readinessScore)
      .slice(0, 3);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
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
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Link Student Form */}
        <LinkStudentForm onSuccess={fetchData} />

        {data && data.students.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl shadow-lg">
            <div className="text-6xl mb-4">&#128104;&#8205;&#128105;&#8205;&#128103;&#8205;&#128102;</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Students Linked</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
              Link your child's account to start monitoring progress. For the most secure option, use an invite code generated from your child's Profile.
            </p>
          </div>
        )}

        {data && data.students.length > 0 && (
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 rounded-2xl p-5 text-white shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="text-sm opacity-90">Linked children</div>
                <div className="text-3xl font-bold">{data.totalStudents}</div>
                <div className="text-xs opacity-90 mt-1">Updated {new Date(data.generatedAt).toLocaleString()}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.students.map((s) => (
                  <button
                    key={s.studentId}
                    onClick={() => setActiveStudentId(s.studentId)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                      activeStudentId === s.studentId
                        ? 'bg-white/20 ring-1 ring-white/30'
                        : 'bg-white/10 hover:bg-white/15'
                    }`}
                  >
                    {s.studentName}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {selected && (
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Profile + stats */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg overflow-hidden">
                <div className="p-5 border-b border-gray-100 dark:border-slate-700">
                  <div className="flex items-center gap-4">
                    <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white text-xl font-bold shadow-md overflow-hidden">
                      {selected.studentImage ? (
                        <Image src={selected.studentImage} alt={selected.studentName} fill className="object-cover" sizes="56px" />
                      ) : (
                        selected.studentName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-lg font-bold text-gray-900 dark:text-white">{selected.studentName}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {selected.grade ? `Class ${selected.grade}` : 'Class —'} {selected.board ? `• ${selected.board}` : ''}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Last active: {selected.lastActiveAt ? formatDate(selected.lastActiveAt) : '—'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-indigo-50 dark:bg-indigo-900/20 p-3">
                    <div className="text-xs text-gray-500 dark:text-gray-400">Study time (12w)</div>
                    <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">
                      {formatDuration((selected.weekly ?? []).reduce((sum, w) => sum + (w.totalMinutes ?? 0), 0))}
                    </div>
                  </div>
                  <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3">
                    <div className="text-xs text-gray-500 dark:text-gray-400">Tests (12w)</div>
                    <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                      {(selected.weekly ?? []).reduce((sum, w) => sum + (w.testsTaken ?? 0), 0)}
                    </div>
                  </div>
                  <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3">
                    <div className="text-xs text-gray-500 dark:text-gray-400">Avg score (latest)</div>
                    <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                      {latestWeek ? `${clamp(Math.round(latestWeek.averageScore), 0, 100)}%` : '—'}
                    </div>
                  </div>
                  <div className="rounded-xl bg-rose-50 dark:bg-rose-900/20 p-3">
                    <div className="text-xs text-gray-500 dark:text-gray-400">Needs attention</div>
                    <div className="text-2xl font-bold text-rose-700 dark:text-rose-300">
                      {selected.attentionOpenCount}
                    </div>
                  </div>
                </div>

                <div className="px-5 pb-5">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">Top readiness</div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2">
                    {topReadiness.length === 0 ? (
                      <div className="text-sm text-gray-500 dark:text-gray-400">No readiness data yet.</div>
                    ) : (
                      topReadiness.map((r) => (
                        <div key={r.subject} className="flex items-center justify-between rounded-xl border border-gray-100 dark:border-slate-700 p-3">
                          <div className="text-sm font-medium text-gray-900 dark:text-white capitalize">{r.subject}</div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-1 rounded-full ${readinessPillColor(r.readinessLabel)}`}>
                              {friendlyReadinessLabel(r.readinessLabel)}
                            </span>
                            <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{r.readinessScore}%</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-5">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">Deep dive</div>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  View subject drill-down, weak topics, and readiness details.
                </p>
                <button
                  onClick={() => setDrilldownStudentId(selected.studentId)}
                  className="mt-3 w-full px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                >
                  Open detailed view
                </button>
              </div>
            </div>

            {/* Right: charts */}
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">Weekly trend</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Minutes, topics attempted, and average score</div>
                  </div>
                </div>
                <WeeklyTrendChart weekly={selected.weekly} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-5">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Subject coverage & mastery</div>
                  <SubjectRadar subjects={selected.subjectProgress} />
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-5">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Mastery distribution</div>
                  <MasteryPie distribution={selected.masteryDistribution} />
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-5">
                <div className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Needs attention by subject</div>
                <AttentionBar items={selected.attentionBySubject} />
              </div>
            </div>
          </section>
        )}

        {/* Student Detail Panel (drill-down) */}
        {drilldownStudentId && (
          <div className="mt-6">
            {/* Keep existing drill-down panel for now (uses /api/parent/progress) */}
            <StudentDetailPanel studentId={drilldownStudentId} onClose={() => setDrilldownStudentId(null)} />
          </div>
        )}
      </main>
    </div>
  );
}
