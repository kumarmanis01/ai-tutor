'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppHeader, BottomNav, Card, EmptyState, ErrorState, SkeletonCard, TierPill, SectionTitle, Ring, Bar, Segmented, SubjectChip, Mono } from '@/components/ui'
import type { TierKey } from '@/lib/constants/tiers'
import type { SubjectKey } from '@/lib/constants/subjects'

interface SubjectProgress {
  subject: SubjectKey
  tier: TierKey
  topicsCompleted: number
  topicsTotal: number
  weeklyActivity: number[]
}

interface ProgressProps {
  subjects?: SubjectProgress[]
  overallTier?: TierKey
  streak?: number
  xp?: number
  isLoading?: boolean
  error?: string | null
}

const ROOT_STYLE: React.CSSProperties = {
  background: 'var(--bg)',
  minHeight: '100vh',
  maxWidth: 390,
  margin: '0 auto',
  position: 'relative',
  paddingBottom: 100,
}

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
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
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
    <Card pad={0} style={{ overflow: 'hidden' }}>
      <div onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, cursor: 'pointer', minHeight: 44 }}>
        <Ring tier={s.tier} size={42} stroke={5} />
        <div style={{ flex: 1 }}>
          <SubjectChip subject={s.subject} />
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{s.topicsCompleted}/{s.topicsTotal} concepts</div>
        </div>
        <TierPill tier={s.tier} size="sm" />
        <span style={{ color: 'var(--text-faint)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s', display: 'inline-block', fontSize: 14, minWidth: 24 }}>▾</span>
      </div>
      {open && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 14px', background: 'var(--surface-2)' }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>Completion</span>
              <Mono style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{pct}%</Mono>
            </div>
            <Bar value={pct} h={6} />
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Weekly activity</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {s.weeklyActivity.map((v, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <div style={{ width: '100%', height: 32, borderRadius: 4, background: v > 0 ? 'var(--primary)' : 'var(--surface-3)', opacity: v > 0 ? 0.3 + (v / 100) * 0.7 : 1 }} />
                <span style={{ fontSize: 9, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
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

export default function ProgressPage(_props: ProgressProps) {
  const router = useRouter()
  const [range, setRange] = useState('7')
  const [isLoading] = useState(false)
  const [error] = useState<string | null>(null)

  // Demo data
  const subjects: SubjectProgress[] = [
    { subject: 'math', tier: 'fair', topicsCompleted: 8, topicsTotal: 20, weeklyActivity: [40, 0, 60, 80, 50, 0, 70] },
    { subject: 'science', tier: 'ontrack', topicsCompleted: 12, topicsTotal: 18, weeklyActivity: [30, 50, 40, 60, 20, 0, 80] },
    { subject: 'english', tier: 'weak', topicsCompleted: 3, topicsTotal: 15, weeklyActivity: [10, 0, 20, 0, 30, 0, 0] },
  ]
  const overallTier: TierKey = 'fair'
  const streak = 7
  const xp = 1240

  const trend7 = [40, 44, 42, 50, 55, 58, 62]
  const trend30 = [28, 32, 30, 38, 42, 40, 48, 52, 50, 58, 62]
  const trendData = range === '7' ? trend7 : trend30

  if (isLoading) {
    return (
      <div style={ROOT_STYLE}>
        <div style={{ padding: '14px 20px 18px' }}><div style={{ height: 24, width: 120, borderRadius: 8, background: 'var(--skeleton-base)' }} /></div>
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
        <BottomNav active="progress" onChange={tab => router.push(`/student/${tab === 'home' ? 'dashboard' : tab}`)} />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ ...ROOT_STYLE, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100vh', paddingBottom: 80 }}>
        <ErrorState body={error} onRetry={() => {}} />
        <BottomNav active="progress" onChange={tab => router.push(`/student/${tab === 'home' ? 'dashboard' : tab}`)} />
      </div>
    )
  }

  if (subjects.length === 0) {
    return (
      <div style={ROOT_STYLE}>
        <div style={{ padding: '8px 16px 12px' }}><AppHeader title="Progress" large /></div>
        <EmptyState
          title="No sessions yet"
          body="Once you complete your first session with Vidya, your progress and trends will appear here."
          action="Start learning"
          onAction={() => router.push('/student/tutor')}
        />
        <BottomNav active="progress" onChange={tab => router.push(`/student/${tab === 'home' ? 'dashboard' : tab}`)} />
      </div>
    )
  }

  return (
    <div style={ROOT_STYLE}>
      <div style={{ padding: '8px 16px 12px' }}>
        <AppHeader title="Progress" large />
      </div>

      <div style={{ padding: '0 16px 24px' }}>
        {/* Summary pills */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <Card pad={14} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>🔥</div>
            <Mono style={{ fontSize: 20, fontWeight: 700 }}>{streak}</Mono>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>day streak</div>
          </Card>
          <Card pad={14} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>⚡</div>
            <Mono style={{ fontSize: 20, fontWeight: 700 }}>{xp}</Mono>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>total XP</div>
          </Card>
          <Card pad={14} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
              <Ring tier={overallTier} size={32} stroke={4} />
            </div>
            <TierPill tier={overallTier} size="sm" showDot={false} />
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>overall</div>
          </Card>
        </div>

        {/* Trend chart */}
        <Card pad={16} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Overall trend</div>
              <div style={{ fontSize: 12, color: 'var(--tier-strong)', fontWeight: 600, marginTop: 2 }}>↗ Improving steadily</div>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {subjects.map(s => <SubjectProgressRow key={s.subject} s={s} />)}
        </div>
      </div>

      <BottomNav
        active="progress"
        onChange={tab => router.push(`/student/${tab === 'home' ? 'dashboard' : tab}`)}
      />
    </div>
  )
}
