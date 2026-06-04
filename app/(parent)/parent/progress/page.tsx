'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card, EmptyState, ErrorState, SkeletonCard, TierPill,
  SectionTitle, Mono,
  TrendIcon, ChevRightIcon,
} from '@/components/ui'
import type { TierKey } from '@/lib/constants/tiers'

// Parent-friendly tier labels -- no jargon
const PARENT_TIER_LABEL: Record<TierKey, string> = {
  strong:  'Doing well',
  ontrack: 'Doing well',
  fair:    'Needs attention',
  weak:    'Needs attention',
  critical: 'Urgent help needed',
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// --- Types ---

interface RecentSession {
  concept: string
  completedAt: string  // ISO string from API
  tier: TierKey
}

interface SubjectProgress {
  subject: string
  tier: TierKey
  topicsCompleted: number
  topicsTotal: number
  weeklyActivity: number[]  // 7 values, Mon-Sun
  recentSessions: RecentSession[]
}

interface ParentProgressData {
  childName: string
  subjects: SubjectProgress[]
}

// --- API response adapter ---
// We pull from two existing endpoints:
//   GET /api/parent/dashboard  -> per-student subjectProgress (topicsCovered/totalTopics,
//                                 averageMastery) + readiness (readinessScore) + weekly[]
//                                 (12-week per-week sessionsCount + subjectsActive)
//   GET /api/parent/schedule    -> per-session list across 7-day window for recentSessions
//                                 and per-day weeklyActivity derivation.
// First linked student wins (matches OLD parent dashboard pick).

interface DashboardSubject {
  subject: string
  totalTopics: number
  topicsCovered: number
  averageMastery: number
}
interface DashboardReadiness {
  subject: string
  readinessScore: number
}
interface DashboardWeeklyPoint {
  weekStart: string
  sessionsCount: number
  subjectsActive: string[]
}
interface DashboardStudent {
  studentId: string
  studentName: string
  subjectProgress: DashboardSubject[]
  readiness: DashboardReadiness[]
  weekly: DashboardWeeklyPoint[]
}
interface DashboardResponse {
  ok?: boolean
  students?: DashboardStudent[]
}

interface ScheduleSession {
  id: string
  concept: string
  subject: string
  scheduledAt: string
  status: 'upcoming' | 'completed' | 'missed'
}
interface ScheduleResponse {
  sessions?: ScheduleSession[]
}

function readinessScoreToTier(score: number): TierKey {
  if (score >= 80) return 'strong'
  if (score >= 65) return 'ontrack'
  if (score >= 40) return 'fair'
  if (score >= 20) return 'weak'
  return 'critical'
}

function masteryToTier(avgMastery: number): TierKey {
  // averageMastery is 0..1
  const pct = avgMastery * 100
  return readinessScoreToTier(pct)
}

function dayIndexMonFirst(d: Date): number {
  // 0 = Mon, 6 = Sun
  const dow = d.getDay()
  return dow === 0 ? 6 : dow - 1
}

function adaptProgressResponse(
  dashboard: DashboardResponse,
  schedule: ScheduleResponse,
): ParentProgressData | null {
  const child = dashboard.students?.[0]
  if (!child) return null

  // Index readiness by subject for tier lookup.
  const readinessBySubject = new Map<string, number>()
  for (const r of child.readiness ?? []) {
    readinessBySubject.set(r.subject, r.readinessScore)
  }

  // Build per-subject buckets for schedule-derived data.
  const completed = (schedule.sessions ?? []).filter((s) => s.status === 'completed')
  // weeklyActivity bucket: 7-day Mon..Sun counts per subject (last week window).
  const weeklyBySubject = new Map<string, number[]>()
  const recentBySubject = new Map<string, RecentSession[]>()
  for (const s of completed) {
    const d = new Date(s.scheduledAt)
    const idx = dayIndexMonFirst(d)
    if (!weeklyBySubject.has(s.subject)) {
      weeklyBySubject.set(s.subject, Array(7).fill(0))
    }
    weeklyBySubject.get(s.subject)![idx] += 1
    if (!recentBySubject.has(s.subject)) recentBySubject.set(s.subject, [])
    recentBySubject.get(s.subject)!.push({
      concept: s.concept,
      completedAt: s.scheduledAt,
      tier: readinessScoreToTier(readinessBySubject.get(s.subject) ?? 0),
    })
  }

  const subjects: SubjectProgress[] = (child.subjectProgress ?? []).map((s) => {
    const readinessScore = readinessBySubject.get(s.subject)
    const tier = readinessScore != null ? readinessScoreToTier(readinessScore) : masteryToTier(s.averageMastery ?? 0)
    return {
      subject: s.subject,
      tier,
      topicsCompleted: s.topicsCovered,
      topicsTotal: s.totalTopics,
      weeklyActivity: weeklyBySubject.get(s.subject) ?? (Array(7).fill(0) as number[]),
      recentSessions: (recentBySubject.get(s.subject) ?? []).slice(0, 5),
    }
  })

  return { childName: child.studentName, subjects }
}

// --- Sub-components ---

function LoadingState() {
  return (
    <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto pb-8">
      <div className="bg-[var(--surface)] border-b border-[var(--border)] px-4 pt-4 pb-[14px]">
        <div className="h-6 w-[140px] rounded-lg bg-[var(--surface-3)]" />
      </div>
      <div className="px-4 pt-[14px] flex flex-col gap-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  )
}

function SubjectCard({ s }: { s: SubjectProgress }) {
  const [expanded, setExpanded] = useState(false)
  const maxActivity = Math.max(...s.weeklyActivity, 1)
  const progressPct = s.topicsTotal > 0 ? Math.round((s.topicsCompleted / s.topicsTotal) * 100) : 0

  return (
    <Card pad={16} className="mb-3">
      {/* Header row */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1">
          <div className="text-[15px] font-bold text-[var(--text)]">{s.subject}</div>
          <div className="text-[12px] text-[var(--text-muted)] mt-[2px]">{PARENT_TIER_LABEL[s.tier]}</div>
        </div>
        <TierPill tier={s.tier} size="sm" />
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between mb-[6px]">
          <span className="text-[12px] text-[var(--text-muted)]">Topics covered</span>
          <Mono className="text-[12px] text-[var(--text-muted)] font-semibold">{s.topicsCompleted}/{s.topicsTotal}</Mono>
        </div>
        <div className="h-[6px] rounded-full bg-[var(--surface-2)] overflow-hidden">
          <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Weekly activity bars */}
      <div className="mb-[10px]">
        <div className="text-[12px] text-[var(--text-muted)] mb-[6px]">Activity this week</div>
        <div className="flex gap-1 items-end">
          {s.weeklyActivity.map((v, i) => {
            const pct = maxActivity > 0 ? (v / maxActivity) * 100 : 0
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full h-9 rounded-[6px] bg-[var(--surface-2)] flex items-end overflow-hidden">
                  <div className="w-full rounded-[6px] bg-[var(--primary)]" style={{ height: `${pct}%` }} />
                </div>
                <span className="text-[9px] text-[var(--text-faint)] font-semibold">{DAY_LABELS[i]}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Expand to see recent sessions */}
      {s.recentSessions.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center justify-between w-full bg-transparent border-0 cursor-pointer pt-[10px] border-t border-[var(--border)] min-h-[44px] [font-family:var(--font-sans)]"
          >
            <span className="text-[13px] font-semibold text-[var(--primary)]">Recent sessions</span>
            <ChevRightIcon
              size={16}
              className="text-[var(--primary)] transition-transform duration-200"
              style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}
            />
          </button>
          {expanded && (
            <div className="mt-2 flex flex-col gap-2">
              {s.recentSessions.map((r, i) => {
                const completedAt = new Date(r.completedAt)
                return (
                  <div key={i} className="flex items-center gap-[10px] px-3 py-[10px] rounded-[10px] bg-[var(--surface-2)]">
                    <div className="flex-1">
                      <div className="text-[13px] font-semibold text-[var(--text)]">{r.concept}</div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {completedAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                    <TierPill tier={r.tier} size="sm" />
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </Card>
  )
}

// --- Page ---

export default function ParentProgressPage() {
  const router = useRouter()
  const [data, setData] = useState<ParentProgressData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProgress = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [dashRes, schedRes] = await Promise.all([
        fetch('/api/parent/dashboard'),
        fetch('/api/parent/schedule'),
      ])
      if (!dashRes.ok) throw new Error('Failed to load dashboard')
      const dashboard = await dashRes.json() as DashboardResponse
      // Schedule failure is non-fatal: just lose recentSessions/weeklyActivity detail.
      const schedule = schedRes.ok ? (await schedRes.json() as ScheduleResponse) : {}
      const adapted = adaptProgressResponse(dashboard, schedule)
      if (!adapted) throw new Error('No linked student')
      setData(adapted)
    } catch {
      setError('Could not load progress. Tap to retry.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchProgress() }, [fetchProgress])

  if (isLoading) return <LoadingState />

  if (error || !data) return (
    <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto p-4">
      <ErrorState title="Could not load progress" body={error ?? 'Please check your connection and try again.'} onRetry={fetchProgress} />
    </div>
  )

  if (data.subjects.length === 0) return (
    <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto">
      <div className="bg-[var(--surface)] border-b border-[var(--border)] px-4 pt-4 pb-[14px]">
        <div className="text-[18px] font-extrabold text-[var(--text)]">How {data.childName} is doing</div>
      </div>
      <EmptyState
        icon="target"
        title="No progress data yet"
        body={`${data.childName} has not completed enough sessions to show a progress report. Encourage them to do a short session today.`}
        action="Go to home"
        onAction={() => router.push('/parent/dashboard')}
      />
    </div>
  )

  return (
    <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto pb-8">
      {/* Header */}
      <div className="bg-[var(--surface)] border-b border-[var(--border)] px-4 pt-4 pb-[14px]">
        <div className="text-[18px] font-extrabold tracking-[-0.02em] text-[var(--text)]">How {data.childName} is doing</div>
        <div className="text-[12px] text-[var(--text-muted)] mt-[2px] flex items-center gap-1">
          <TrendIcon size={13} className="text-[var(--tier-strong)]" />
          Subject-by-subject breakdown
        </div>
      </div>

      <div className="px-4 pt-[14px] pb-6">
        <SectionTitle>By subject</SectionTitle>
        {data.subjects.map(s => (
          <SubjectCard key={s.subject} s={s} />
        ))}
      </div>
    </div>
  )
}
