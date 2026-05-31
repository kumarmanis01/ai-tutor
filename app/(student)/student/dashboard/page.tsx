'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  AppHeader, BottomNav, Card, Btn, EmptyState, ErrorState, SectionTitle,
  Ring, TierPill, Bar, Skel, SubjectChip, Mono,
} from '@/components/ui'
import { FREE_TIER_SESSION_LIMIT } from '@/lib/constants/freemium'
import type { TierKey } from '@/lib/constants/tiers'
import type { SubjectKey } from '@/lib/constants/subjects'

// --- Types ---

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
  examDate: string       // ISO date string -- isCrunch derived from this
  examDaysLeft: number
  readinessBySubject: ReadinessEntry[]
  nextTopic: { concept: string; subject: SubjectKey; minutes: number; reason: string } | null
  isPremium: boolean
  isFreemium: boolean
  sessionsUsed: number
  plan: 'free' | 'premium'
  revisionsDue: number
}

// --- Loading skeleton ---

function DashLoading() {
  return (
    <div className="bg-[var(--bg)] px-5 py-[10px] overflow-hidden">
      <div className="flex justify-between items-center mb-5 mt-1">
        <div>
          <Skel w={90} h={12} className="mb-2" />
          <Skel w={130} h={22} />
        </div>
        <Skel w={40} h={40} r={99} />
      </div>
      <Skel h={64} r={16} className="mb-4" />
      <Skel h={180} r={22} className="mb-4" />
      <div className="flex gap-3 mb-4">
        <Skel h={92} r={20} className="flex-1" />
        <Skel h={92} r={20} className="flex-1" />
      </div>
      <Skel w={140} h={16} className="mb-3" />
      {[0, 1, 2].map(i => <Skel key={i} h={68} r={16} className="mb-2" />)}
    </div>
  )
}

// --- Sub-components ---

function ReadinessRow({ entry, onClick }: { entry: ReadinessEntry; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="cursor-pointer flex items-center gap-[14px] p-3 rounded-2xl bg-[var(--surface)] border border-[var(--border)] min-h-[44px]"
    >
      <Ring tier={entry.tier} size={44} stroke={5} />
      <div className="flex-1">
        <SubjectChip subject={entry.subject} />
        <div className={[
          'text-[12px] font-semibold mt-[2px]',
          entry.trend >= 0 ? 'text-[var(--tier-strong)]' : 'text-[var(--tier-critical)]',
        ].join(' ')}>
          {entry.trend >= 0 ? '+' : ''}{entry.trend} this week
        </div>
      </div>
      <TierPill tier={entry.tier} size="sm" />
    </div>
  )
}

// --- Page ---

export default function DashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/student/dashboard')
      if (!res.ok) throw new Error('Failed to load dashboard')
      const json = await res.json() as DashboardData
      setData(json)
    } catch {
      setError('Could not load your dashboard. Tap to retry.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  const navTo = (tab: string) => {
    const route = tab === 'home' ? 'dashboard' : tab
    router.push(`/student/${route}`)
  }

  if (isLoading) {
    return (
      <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto relative">
        <DashLoading />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto relative flex flex-col justify-center pb-20">
        <ErrorState body={error ?? 'Something went wrong.'} onRetry={fetchDashboard} />
        <BottomNav active="home" onChange={tab => navTo(tab)} />
      </div>
    )
  }

  // TODO: wire API -- /api/student/dashboard returns DashboardData

  const isCrunch = data.examDaysLeft <= 14
  const xpPct = (data.xp - data.xpLevelFloor) / (data.xpToNext - data.xpLevelFloor) * 100
  const isFreemiumLocked = data.isFreemium && data.sessionsUsed >= FREE_TIER_SESSION_LIMIT

  return (
    <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto relative pb-[100px]">
      {/* Greeting */}
      <div className="px-5 pt-[10px] pb-0 flex items-center justify-between">
        <div>
          <div className="text-[13px] text-[var(--text-muted)] font-medium">Welcome back,</div>
          <div className="text-[23px] font-extrabold tracking-[-0.03em] leading-[1.1] text-[var(--text)]">{data.studentName}</div>
        </div>
        <button
          onClick={() => router.push('/student/profile')}
          className="w-10 h-10 rounded-full bg-[var(--primary)] text-[var(--on-brand)] border-0 cursor-pointer flex items-center justify-center font-bold text-[16px] min-w-[44px] min-h-[44px]"
        >
          {data.studentName[0]?.toUpperCase() ?? 'S'}
        </button>
      </div>

      <div className="px-5 pt-4 pb-0">
        {/* CRUNCH MODE */}
        {isCrunch ? (
          <>
            <div className="rounded-3xl p-[22px] relative overflow-hidden text-white [background:linear-gradient(150deg,var(--tier-critical)_0%,oklch(0.52_0.18_15)_100%)] [box-shadow:0_10px_30px_oklch(0.6_0.2_25_/_0.35)]">
              <div className="text-[12.5px] font-bold uppercase tracking-[0.06em] opacity-[0.92] mb-3">
                🔥 Exam crunch mode
              </div>
              <div className="flex items-baseline gap-[10px] mb-4">
                <Mono className="text-[64px] font-bold leading-[0.9]">{data.examDaysLeft}</Mono>
                <div>
                  <div className="text-[18px] font-bold">days left</div>
                  <div className="text-[13px] opacity-[0.85]">{data.examName}</div>
                </div>
              </div>
              {data.nextTopic && (
                <div className="bg-[rgba(255,255,255,0.16)] rounded-[14px] p-[14px]">
                  <div className="text-[12.5px] opacity-[0.9] mb-1">{"Today's priority"}</div>
                  <div className="text-[15.5px] font-bold mb-3">{data.nextTopic.concept}</div>
                  <Btn full variant="secondary" onClick={() => router.push(`/session/${encodeURIComponent(data.nextTopic!.concept)}`)}>
                    Start now
                  </Btn>
                </div>
              )}
            </div>
            <div className="mt-4 flex gap-[10px]">
              <Card pad={14} className="flex-1 flex items-center gap-[10px]">
                <span className="text-[var(--tier-weak)] text-[22px]">🔥</span>
                <div>
                  <Mono className="text-[22px] font-bold">{data.streak}</Mono>
                  <div className="text-[11.5px] text-[var(--text-muted)] font-semibold">day streak</div>
                </div>
              </Card>
              <Card pad={14} onClick={() => navTo('revise')} className="flex-1 flex items-center gap-[10px] cursor-pointer">
                <span className="text-[var(--tier-ontrack)] text-[22px]">📚</span>
                <div>
                  <Mono className="text-[22px] font-bold">{data.revisionsDue}</Mono>
                  <div className="text-[11.5px] text-[var(--text-muted)] font-semibold">revisions due</div>
                </div>
              </Card>
            </div>
            <div className="mt-5">
              <SectionTitle action="See all" onAction={() => navTo('progress')}>Where to focus</SectionTitle>
              <div className="flex flex-col gap-2">
                {data.readinessBySubject.filter(r => ['critical', 'weak', 'fair'].includes(r.tier)).map(r => (
                  <ReadinessRow key={r.subject} entry={r} onClick={() => navTo('progress')} />
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Countdown strip */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[var(--surface)] border border-[var(--border)] mb-4">
              <div className="w-10 h-10 rounded-xl bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center text-[20px]">📅</div>
              <div className="flex-1">
                <div className="text-[13px] text-[var(--text-muted)]">{data.examName}</div>
                <div className="text-[14.5px] font-bold">
                  <Mono>{data.examDaysLeft}</Mono>{' '}days to go
                </div>
              </div>
              {data.isPremium && (
                <span className="inline-flex items-center gap-1 h-6 px-[9px] rounded-full bg-[oklch(0.80_0.13_88_/_0.18)] text-[var(--tier-fair)] text-[11px] font-bold">
                  👑 PRO
                </span>
              )}
            </div>

            {/* Freemium locked banner */}
            {isFreemiumLocked && (
              <div className="mb-4 rounded-[18px] p-4 [background:linear-gradient(135deg,var(--primary),oklch(0.4_0.2_270))] text-white">
                <div className="flex items-center gap-2 mb-[6px]">
                  <span>🔒</span>
                  <span className="font-bold text-[15px]">{"You've used today's sessions"}</span>
                </div>
                <div className="text-[13.5px] opacity-[0.92] leading-[1.45] mb-[14px]">
                  Free plan includes {FREE_TIER_SESSION_LIMIT} Vidya sessions a day. Go Premium for unlimited learning.
                </div>
                <Btn full onClick={() => navTo('upgrade')} variant="secondary">
                  Upgrade to Premium
                </Btn>
              </div>
            )}

            {/* Next recommended topic */}
            {data.nextTopic ? (
              <div
                onClick={() => isFreemiumLocked ? navTo('upgrade') : router.push(`/session/${encodeURIComponent(data.nextTopic!.concept)}`)}
                className="cursor-pointer rounded-[22px] p-5 bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-md)] relative overflow-hidden mb-4"
              >
                <div className="absolute top-[-30px] right-[-30px] w-[120px] h-[120px] rounded-full bg-[var(--primary-soft)] opacity-60" />
                <div className="relative">
                  <div className="flex items-center gap-[7px] text-[12px] font-bold text-[var(--primary)] uppercase tracking-[0.05em] mb-[10px]">
                    ✨ Recommended next
                  </div>
                  <div className="flex gap-[7px] mb-2">
                    <SubjectChip subject={data.nextTopic.subject} size="sm" />
                    <span className="text-[11.5px] text-[var(--text-muted)] font-semibold">⏱ {data.nextTopic.minutes} min</span>
                  </div>
                  <div className="text-[18px] font-bold tracking-[-0.02em] leading-[1.25] mb-1 text-[var(--text)]">
                    {data.nextTopic.concept}
                  </div>
                  <div className="text-[13px] text-[var(--text-muted)] mb-4">{data.nextTopic.reason}</div>
                  <Btn full size="md">
                    {isFreemiumLocked ? 'Unlock with Premium' : 'Start learning session'}
                  </Btn>
                </div>
              </div>
            ) : (
              <EmptyState
                title="No topics yet"
                body="Complete your diagnostic so Vidya can recommend what to study next."
                action="Start diagnostic"
                onAction={() => router.push('/student/diagnostic')}
              />
            )}

            {/* Streak + XP row */}
            <div className="flex gap-3 mb-4">
              <Card pad={16} className="flex-1">
                <div className="flex items-center gap-2 text-[var(--tier-weak)] mb-2">
                  <span className="text-[22px]">🔥</span>
                  <Mono className="text-[26px] font-bold text-[var(--text)]">{data.streak}</Mono>
                </div>
                <div className="text-[13px] font-semibold text-[var(--text)]">Current streak</div>
                <div className="text-[11.5px] text-[var(--text-faint)]">Best: {data.longestStreak} days</div>
              </Card>
              <Card pad={16} className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-[6px] text-[var(--primary)]">
                    <span className="text-[20px]">⚡</span>
                    <span className="text-[15px] font-extrabold text-[var(--text)]">Lvl {data.xpLevel}</span>
                  </div>
                  <Mono className="text-[11.5px] text-[var(--text-faint)]">{data.xp} XP</Mono>
                </div>
                <Bar value={xpPct} />
                <div className="text-[11.5px] text-[var(--text-faint)] mt-[6px]">
                  {data.xpToNext - data.xp} XP to Lvl {data.xpLevel + 1}
                </div>
              </Card>
            </div>

            {/* Revisions due */}
            {data.revisionsDue > 0 && !isFreemiumLocked && (
              <div
                onClick={() => router.push('/student/revise')}
                className="cursor-pointer flex items-center gap-3 p-[14px] rounded-2xl bg-[var(--tier-ontrack-soft)] mb-4 min-h-[44px]"
              >
                <span className="text-[var(--tier-ontrack)] text-[22px]">📚</span>
                <div className="flex-1">
                  <div className="text-[14px] font-bold text-[var(--text)]">{data.revisionsDue} revisions due today</div>
                  <div className="text-[12.5px] text-[var(--text-muted)]">Lock in what you've learned</div>
                </div>
                <span className="text-[var(--tier-ontrack)]">›</span>
              </div>
            )}

            {/* Subject readiness */}
            {data.readinessBySubject.length > 0 ? (
              <>
                <SectionTitle action="Details" onAction={() => navTo('progress')}>Subject readiness</SectionTitle>
                <div className="flex flex-col gap-2 mb-[18px]">
                  {data.readinessBySubject.map(r => (
                    <ReadinessRow key={r.subject} entry={r} onClick={() => navTo('progress')} />
                  ))}
                </div>
              </>
            ) : null}
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
