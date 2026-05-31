'use client'
import React, { useState } from 'react'
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

interface RecentSession {
  concept: string
  completedAt: Date
  tier: TierKey
}

interface SubjectProgress {
  subject: string
  tier: TierKey
  topicsCompleted: number
  topicsTotal: number
  weeklyActivity: number[]
  recentSessions: RecentSession[]
}

interface ParentProgressData {
  childName: string
  subjects: SubjectProgress[]
  isLoading?: boolean
  error?: string | null
}

function LoadingState() {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', maxWidth: 390, margin: '0 auto', paddingBottom: 32 }}>
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '16px 16px 14px' }}>
        <div style={{ height: 24, width: 140, borderRadius: 8, background: 'var(--surface-3)' }} />
      </div>
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
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
    <Card pad={16} style={{ marginBottom: 12 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{s.subject}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{PARENT_TIER_LABEL[s.tier]}</div>
        </div>
        <TierPill tier={s.tier} size="sm" />
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Topics covered</span>
          <Mono style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{s.topicsCompleted}/{s.topicsTotal}</Mono>
        </div>
        <div style={{ height: 6, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progressPct}%`, background: 'var(--primary)', borderRadius: 99 }} />
        </div>
      </div>

      {/* Weekly activity bars */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Activity this week</div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end' }}>
          {s.weeklyActivity.map((v, i) => {
            const pct = maxActivity > 0 ? (v / maxActivity) * 100 : 0
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: '100%', height: 36, borderRadius: 6, background: 'var(--surface-2)', display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
                  <div style={{ width: '100%', height: `${pct}%`, background: 'var(--primary)', borderRadius: 6 }} />
                </div>
                <span style={{ fontSize: 9, color: 'var(--text-faint)', fontWeight: 600 }}>{DAY_LABELS[i]}</span>
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
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', paddingTop: 10, borderTop: '1px solid var(--border)', minHeight: 44, fontFamily: 'var(--font-sans)' }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>Recent sessions</span>
            <ChevRightIcon size={16} style={{ color: 'var(--primary)', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }} />
          </button>
          {expanded && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {s.recentSessions.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'var(--surface-2)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{r.concept}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {r.completedAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                  <TierPill tier={r.tier} size="sm" />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  )
}

// --- DEMO DATA ---
const DEMO: ParentProgressData = {
  childName: 'Aarav',
  subjects: [
    {
      subject: 'Mathematics',
      tier: 'weak',
      topicsCompleted: 8,
      topicsTotal: 24,
      weeklyActivity: [2, 0, 3, 1, 0, 2, 1],
      recentSessions: [
        { concept: 'Quadratic Equations', completedAt: new Date(Date.now() - 86400000), tier: 'weak' },
        { concept: 'Linear Algebra Basics', completedAt: new Date(Date.now() - 172800000), tier: 'fair' },
      ],
    },
    {
      subject: 'Science',
      tier: 'fair',
      topicsCompleted: 14,
      topicsTotal: 30,
      weeklyActivity: [1, 2, 1, 3, 2, 0, 1],
      recentSessions: [
        { concept: 'Light and Optics', completedAt: new Date(Date.now() - 43200000), tier: 'fair' },
      ],
    },
    {
      subject: 'English',
      tier: 'ontrack',
      topicsCompleted: 20,
      topicsTotal: 28,
      weeklyActivity: [3, 2, 3, 2, 3, 1, 2],
      recentSessions: [
        { concept: 'Reported Speech', completedAt: new Date(Date.now() - 86400000), tier: 'ontrack' },
      ],
    },
    {
      subject: 'Social Studies',
      tier: 'fair',
      topicsCompleted: 10,
      topicsTotal: 22,
      weeklyActivity: [0, 1, 2, 0, 1, 2, 0],
      recentSessions: [],
    },
  ],
}

export default function ParentProgressPage() {
  const [isLoading] = useState(false)
  const [error] = useState<string | null>(null)
  const data = DEMO

  if (isLoading) return <LoadingState />
  if (error) return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', maxWidth: 390, margin: '0 auto', padding: 16 }}>
      <ErrorState title="Could not load progress" body="Please check your connection and try again." onRetry={() => {}} />
    </div>
  )

  if (data.subjects.length === 0) return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', maxWidth: 390, margin: '0 auto' }}>
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '16px 16px 14px' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>How {data.childName} is doing</div>
      </div>
      <EmptyState
        icon="target"
        title="No progress data yet"
        body={`${data.childName} has not completed enough sessions to show a progress report. Encourage them to do a short session today.`}
        action="Go to home"
        onAction={() => {}}
      />
    </div>
  )

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', maxWidth: 390, margin: '0 auto', paddingBottom: 32 }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '16px 16px 14px' }}>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)' }}>How {data.childName} is doing</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
          <TrendIcon size={13} style={{ color: 'var(--tier-strong)' }} />
          Subject-by-subject breakdown
        </div>
      </div>

      <div style={{ padding: '14px 16px 24px' }}>
        <SectionTitle>By subject</SectionTitle>
        {data.subjects.map(s => (
          <SubjectCard key={s.subject} s={s} />
        ))}
      </div>
    </div>
  )
}
