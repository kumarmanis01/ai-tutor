'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AppHeader, BottomNav, Card, Btn, EmptyState, ErrorState, SectionTitle,
  Ring, TierPill, Bar, Skel, SubjectChip, Mono,
} from '@/components/ui'
import { FREE_TIER_SESSION_LIMIT } from '@/lib/constants/freemium'
import type { TierKey } from '@/lib/constants/tiers'
import type { SubjectKey } from '@/lib/constants/subjects'

interface ReadinessEntry {
  subject: SubjectKey
  tier: TierKey
  trend: number
}

interface DashboardData {
  studentName: string
  grade: string
  streak: number
  longestStreak: number
  xp: number
  xpLevel: number
  xpLevelFloor: number
  xpToNext: number
  examName: string
  examDaysLeft: number
  readinessBySubject: ReadinessEntry[]
  nextTopic: { concept: string; subject: SubjectKey; minutes: number; reason: string }
  isPremium: boolean
  isFreemium: boolean
  sessionsUsed: number
  plan: 'free' | 'premium'
  revisionsDue: number
}

type DashState = 'loading' | 'error' | 'default'

const ROOT_STYLE: React.CSSProperties = {
  background: 'var(--bg)',
  minHeight: '100vh',
  maxWidth: 390,
  margin: '0 auto',
  position: 'relative',
}

function DashLoading() {
  return (
    <div style={{ background: 'var(--bg)', padding: '10px 20px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 4 }}>
        <div><Skel w={90} h={12} style={{ marginBottom: 8 }} /><Skel w={130} h={22} /></div>
        <Skel w={40} h={40} r={99} />
      </div>
      <Skel h={64} r={16} style={{ marginBottom: 16 }} />
      <Skel h={180} r={22} style={{ marginBottom: 16 }} />
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <Skel h={92} r={20} style={{ flex: 1 }} />
        <Skel h={92} r={20} style={{ flex: 1 }} />
      </div>
      <Skel w={140} h={16} style={{ marginBottom: 12 }} />
      {[0, 1, 2].map(i => <Skel key={i} h={68} r={16} style={{ marginBottom: 8 }} />)}
    </div>
  )
}

function ReadinessRow({ entry, onClick }: { entry: ReadinessEntry; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, padding: 12,
        borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)', minHeight: 44,
      }}
    >
      <Ring tier={entry.tier} size={44} stroke={5} />
      <div style={{ flex: 1 }}>
        <SubjectChip subject={entry.subject} />
        <div style={{ fontSize: 12, color: entry.trend >= 0 ? 'var(--tier-strong)' : 'var(--tier-critical)', fontWeight: 600, marginTop: 2 }}>
          {entry.trend >= 0 ? '+' : ''}{entry.trend} this week
        </div>
      </div>
      <TierPill tier={entry.tier} size="sm" />
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [dashState] = useState<DashState>('default')

  // Demo data -- in production this comes from server
  const data: DashboardData = {
    studentName: 'Student',
    grade: '10',
    streak: 7,
    longestStreak: 14,
    xp: 1240,
    xpLevel: 8,
    xpLevelFloor: 1200,
    xpToNext: 1500,
    examName: 'CBSE Board Exam',
    examDaysLeft: 42,
    readinessBySubject: [
      { subject: 'math', tier: 'fair', trend: 5 },
      { subject: 'science', tier: 'ontrack', trend: 3 },
      { subject: 'english', tier: 'weak', trend: -1 },
    ],
    nextTopic: { concept: 'Quadratic Equations', subject: 'math', minutes: 15, reason: 'Highest impact on your exam score' },
    isPremium: false,
    isFreemium: false,
    sessionsUsed: 1,
    plan: 'free',
    revisionsDue: 3,
  }

  const isCrunch = data.examDaysLeft <= 14
  const xpPct = (data.xp - data.xpLevelFloor) / (data.xpToNext - data.xpLevelFloor) * 100
  const isFreemiumLocked = data.isFreemium && data.sessionsUsed >= FREE_TIER_SESSION_LIMIT

  const navTo = (tab: string) => {
    const route = tab === 'home' ? 'dashboard' : tab
    router.push(`/student/${route}`)
  }

  if (dashState === 'loading') {
    return (
      <div style={ROOT_STYLE}>
        <DashLoading />
      </div>
    )
  }

  if (dashState === 'error') {
    return (
      <div style={{ ...ROOT_STYLE, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100vh', paddingBottom: 80 }}>
        <ErrorState onRetry={() => {}} />
      </div>
    )
  }

  return (
    <div style={{ ...ROOT_STYLE, paddingBottom: 100 }}>
      {/* Greeting */}
      <div style={{ padding: '10px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>Good day,</div>
          <div style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, color: 'var(--text)' }}>{data.studentName}</div>
        </div>
        <button
          onClick={() => router.push('/student/profile')}
          style={{ width: 40, height: 40, borderRadius: 99, background: 'var(--primary)', color: 'var(--on-brand)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, minWidth: 44, minHeight: 44 }}
        >
          {data.studentName[0]?.toUpperCase() ?? 'S'}
        </button>
      </div>

      <div style={{ padding: '16px 20px 0' }}>
        {/* CRUNCH MODE */}
        {isCrunch ? (
          <>
            <div style={{ borderRadius: 24, padding: 22, position: 'relative', overflow: 'hidden', background: 'linear-gradient(150deg, var(--tier-critical) 0%, oklch(0.52 0.18 15) 100%)', color: '#fff', boxShadow: '0 10px 30px oklch(0.6 0.2 25 / 0.35)' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.92, marginBottom: 12 }}>
                🔥 Exam crunch mode
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
                <Mono style={{ fontSize: 64, fontWeight: 700, lineHeight: 0.9 }}>{data.examDaysLeft}</Mono>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>days left</div>
                  <div style={{ fontSize: 13, opacity: 0.85 }}>{data.examName}</div>
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.16)', borderRadius: 14, padding: 14 }}>
                <div style={{ fontSize: 12.5, opacity: 0.9, marginBottom: 4 }}>Today's priority</div>
                <div style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 12 }}>{data.nextTopic.concept}</div>
                <Btn full variant="secondary" onClick={() => router.push(`/session/${encodeURIComponent(data.nextTopic.concept)}`)}>
                  Start now
                </Btn>
              </div>
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
              <Card pad={14} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: 'var(--tier-weak)', fontSize: 22 }}>🔥</span>
                <div><Mono style={{ fontSize: 22, fontWeight: 700 }}>{data.streak}</Mono><div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>day streak</div></div>
              </Card>
              <Card pad={14} onClick={() => navTo('revise')} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <span style={{ color: 'var(--tier-ontrack)', fontSize: 22 }}>📚</span>
                <div><Mono style={{ fontSize: 22, fontWeight: 700 }}>{data.revisionsDue}</Mono><div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>revisions due</div></div>
              </Card>
            </div>
            <div style={{ marginTop: 20 }}>
              <SectionTitle action="See all" onAction={() => navTo('progress')}>Where to focus</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.readinessBySubject.filter(r => ['critical', 'weak', 'fair'].includes(r.tier)).map(r => (
                  <ReadinessRow key={r.subject} entry={r} onClick={() => navTo('progress')} />
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Countdown strip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--primary-soft)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📅</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{data.examName}</div>
                <div style={{ fontSize: 14.5, fontWeight: 700 }}>
                  <Mono>{data.examDaysLeft}</Mono>{' '}days to go
                </div>
              </div>
              {data.isPremium && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 24, padding: '0 9px', borderRadius: 99, background: 'oklch(0.80 0.13 88 / 0.18)', color: 'var(--tier-fair)', fontSize: 11, fontWeight: 700 }}>
                  👑 PRO
                </span>
              )}
            </div>

            {/* Freemium locked banner */}
            {isFreemiumLocked && (
              <div style={{ marginBottom: 16, borderRadius: 18, padding: 16, background: 'linear-gradient(135deg, var(--primary), oklch(0.4 0.2 270))', color: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span>🔒</span>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{"You've used today's sessions"}</span>
                </div>
                <div style={{ fontSize: 13.5, opacity: 0.92, lineHeight: 1.45, marginBottom: 14 }}>
                  Free plan includes {FREE_TIER_SESSION_LIMIT} Vidya sessions a day. Go Premium for unlimited learning.
                </div>
                <Btn full onClick={() => navTo('upgrade')} variant="secondary">
                  Upgrade to Premium
                </Btn>
              </div>
            )}

            {/* Next recommended topic */}
            <div
              onClick={() => isFreemiumLocked ? navTo('upgrade') : router.push(`/session/${encodeURIComponent(data.nextTopic.concept)}`)}
              style={{ cursor: 'pointer', borderRadius: 22, padding: 20, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)', position: 'relative', overflow: 'hidden', marginBottom: 16 }}
            >
              <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: 99, background: 'var(--primary-soft)', opacity: 0.6 }} />
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                  ✨ Recommended next
                </div>
                <div style={{ display: 'flex', gap: 7, marginBottom: 8 }}>
                  <SubjectChip subject={data.nextTopic.subject} size="sm" />
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>⏱ {data.nextTopic.minutes} min</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.25, marginBottom: 4, color: 'var(--text)' }}>
                  {data.nextTopic.concept}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>{data.nextTopic.reason}</div>
                <Btn full size="md">
                  {isFreemiumLocked ? 'Unlock with Premium' : 'Start learning session'}
                </Btn>
              </div>
            </div>

            {/* Streak + XP row */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <Card pad={16} style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--tier-weak)', marginBottom: 8 }}>
                  <span style={{ fontSize: 22 }}>🔥</span>
                  <Mono style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)' }}>{data.streak}</Mono>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Day streak</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>Best: {data.longestStreak} days</div>
              </Card>
              <Card pad={16} style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--primary)' }}>
                    <span style={{ fontSize: 20 }}>⚡</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>Lvl {data.xpLevel}</span>
                  </div>
                  <Mono style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{data.xp}</Mono>
                </div>
                <Bar value={xpPct} />
                <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 6 }}>
                  {data.xpToNext - data.xp} XP to Lvl {data.xpLevel + 1}
                </div>
              </Card>
            </div>

            {/* Revisions due */}
            {data.revisionsDue > 0 && !isFreemiumLocked && (
              <div
                onClick={() => router.push('/student/revise')}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, background: 'var(--tier-ontrack-soft)', marginBottom: 16, minHeight: 44 }}
              >
                <span style={{ color: 'var(--tier-ontrack)', fontSize: 22 }}>📚</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{data.revisionsDue} revisions due today</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Lock in what you've learned</div>
                </div>
                <span style={{ color: 'var(--tier-ontrack)' }}>›</span>
              </div>
            )}

            {/* Subject readiness */}
            <SectionTitle action="Details" onAction={() => navTo('progress')}>Subject readiness</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
              {data.readinessBySubject.map(r => (
                <ReadinessRow key={r.subject} entry={r} onClick={() => navTo('progress')} />
              ))}
            </div>
          </>
        )}
      </div>

      <BottomNav
        active="home"
        onChange={tab => navTo(tab)}
      />
    </div>
  )
}
