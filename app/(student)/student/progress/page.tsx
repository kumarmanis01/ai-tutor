'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AppHeader, BottomNav, Card, EmptyState, ErrorState, SkeletonCard, TierPill, SectionTitle, Ring, Bar, Segmented, SubjectChip, Mono } from '@/components/ui'
import type { TierKey } from '@/lib/constants/tiers'
import type { SubjectKey } from '@/lib/constants/subjects'

// --- Types ---

interface SubjectProgress {
  subject: SubjectKey
  tier: TierKey
  topicsCompleted: number
  topicsTotal: number
  weeklyActivity: number[]  // 7 values, Mon-Sun, 0-100
}

interface ProgressData {
  streak: number
  xp: number
  xpLevel: number
  overallTier: TierKey
  subjects: SubjectProgress[]
  trend7: number[]   // 7-day readiness trend, 0-100
  trend30: number[]  // 30-day readiness trend, 0-100
}

// --- Trend chart ---

function TrendChart({ data }: { data: number[] }) {
  const w = 320, h = 110, pad = 6
  const maxV = 100, minV = 0
  if (data.length < 2) return null
  const pts = data.map((v, i) => [
    pad + i * (w - pad * 2) / (data.length - 1),
    h - pad - (v - minV) / (maxV - minV) * (h - pad * 2),
  ])
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const area = `${path} L${pts[pts.length - 1][0].toFixed(1)},${h} L${pts[0][0].toFixed(1)},${h} Z`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto block">
      <defs>
        <linearGradient id="trendgrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map(g => (
        <line key={g} x1="0" y1={h * g} x2={w} y2={h * g} stroke="var(--border)" strokeWidth="1" strokeDasharray="3 4" />
      ))}
      <path d={area} fill="url(#trendgrad)" />
      <path d={path} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => i === pts.length - 1 && (
        <circle key={i} cx={p[0]} cy={p[1]} r="4.5" fill="var(--primary)" stroke="var(--surface)" strokeWidth="2.5" />
      ))}
    </svg>
  )
}

function SubjectProgressRow({ s }: { s: SubjectProgress }) {
  const [open, setOpen] = useState(false)
  const pct = Math.round((s.topicsCompleted / s.topicsTotal) * 100)
  return (
    <Card pad={0} className="overflow-hidden">
      <div onClick={() => setOpen(!open)} className="flex items-center gap-3 p-[14px] cursor-pointer min-h-[44px]">
        <Ring tier={s.tier} size={42} stroke={5} />
        <div className="flex-1">
          <SubjectChip subject={s.subject} />
          <div className="text-[12px] text-[var(--text-muted)] mt-[2px]">{s.topicsCompleted}/{s.topicsTotal} concepts</div>
        </div>
        <TierPill tier={s.tier} size="sm" />
        <span
          className="text-[var(--text-faint)] inline-block text-[14px] min-w-[24px] transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
        >▾</span>
      </div>
      {open && (
        <div className="border-t border-[var(--border)] px-[14px] py-3 bg-[var(--surface-2)]">
          <div className="mb-[10px]">
            <div className="flex justify-between mb-[5px]">
              <span className="text-[13px] text-[var(--text-muted)] font-medium">Completion</span>
              <Mono className="text-[12px] text-[var(--text-muted)] font-semibold">{pct}%</Mono>
            </div>
            <Bar value={pct} h={6} />
          </div>
          <div className="text-[12px] font-bold text-[var(--text-muted)] uppercase tracking-[0.04em] mb-[6px]">Weekly activity</div>
          <div className="flex gap-1">
            {s.weeklyActivity.map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-[3px]">
                <div
                  className="w-full h-8 rounded-[4px]"
                  style={{
                    background: v > 0 ? 'var(--primary)' : 'var(--surface-3)',
                    opacity: v > 0 ? 0.3 + (v / 100) * 0.7 : 1,
                  }}
                />
                <span className="text-[9px] text-[var(--text-faint)] [font-family:var(--font-mono)]">
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

// --- Page ---

export default function ProgressPage() {
  const router = useRouter()
  const [data, setData] = useState<ProgressData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState('7')

  const fetchProgress = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/student/progress')
      if (!res.ok) throw new Error('Failed to load progress')
      const json = await res.json() as ProgressData
      setData(json)
    } catch {
      setError('Could not load your progress. Tap to retry.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchProgress() }, [fetchProgress])

  const navTo = (tab: string) => router.push(`/student/${tab === 'home' ? 'dashboard' : tab}`)

  if (isLoading) {
    return (
      <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto relative pb-[100px]">
        <div className="px-5 pt-[14px] pb-[18px]"><div className="h-6 w-[120px] rounded-lg bg-[var(--skeleton-base)]" /></div>
        <div className="px-4 flex flex-col gap-3">
          {[0, 1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
        <BottomNav active="progress" onChange={navTo} />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto flex flex-col justify-center pb-20">
        <ErrorState body={error ?? 'Something went wrong.'} onRetry={fetchProgress} />
        <BottomNav active="progress" onChange={navTo} />
      </div>
    )
  }

  // TODO: wire API -- /api/student/progress returns ProgressData

  if (data.subjects.length === 0) {
    return (
      <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto relative pb-[100px]">
        <div className="px-4 pt-2 pb-3"><AppHeader title="Progress" large /></div>
        <EmptyState
          title="No sessions yet"
          body="Once you complete your first session with Vidya, your progress and trends will appear here."
          action="Start learning"
          onAction={() => router.push('/student/tutor')}
        />
        <BottomNav active="progress" onChange={navTo} />
      </div>
    )
  }

  const trendData = range === '7' ? data.trend7 : data.trend30

  return (
    <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto relative pb-[100px]">
      <div className="px-4 pt-2 pb-3">
        <AppHeader title="Progress" large />
      </div>

      <div className="px-4 pb-6">
        {/* Summary pills */}
        <div className="flex gap-[10px] mb-4">
          <Card pad={14} className="flex-1 text-center">
            <div className="text-[22px] mb-1">🔥</div>
            <Mono className="text-[20px] font-bold">{data.streak}</Mono>
            <div className="text-[11.5px] text-[var(--text-muted)] font-semibold mt-[2px]">day streak</div>
          </Card>
          <Card pad={14} className="flex-1 text-center">
            <div className="text-[22px] mb-1">⚡</div>
            <Mono className="text-[20px] font-bold">{data.xp}</Mono>
            <div className="text-[11.5px] text-[var(--text-muted)] font-semibold mt-[2px]">total XP</div>
          </Card>
          <Card pad={14} className="flex-1 text-center">
            <div className="flex justify-center mb-1">
              <Ring tier={data.overallTier} size={32} stroke={4} />
            </div>
            <TierPill tier={data.overallTier} size="sm" showDot={false} />
            <div className="text-[11.5px] text-[var(--text-muted)] font-semibold mt-[2px]">overall</div>
          </Card>
        </div>

        {/* Trend chart */}
        <Card pad={16} className="mb-4">
          <div className="flex justify-between items-center mb-4">
            <div>
              <div className="text-[14px] font-bold text-[var(--text)]">Overall trend</div>
            </div>
            <Segmented
              options={[{ id: '7', label: '7d' }, { id: '30', label: '30d' }]}
              value={range}
              onChange={setRange}
            />
          </div>
          <TrendChart data={trendData} />
        </Card>

        {/* Per-subject */}
        <SectionTitle>By subject</SectionTitle>
        <div className="flex flex-col gap-[10px]">
          {data.subjects.map(s => <SubjectProgressRow key={s.subject} s={s} />)}
        </div>
      </div>

      <BottomNav active="progress" onChange={navTo} />
    </div>
  )
}
