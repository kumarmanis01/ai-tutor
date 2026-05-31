'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card, Btn, EmptyState, ErrorState, SkeletonCard, TierPill,
  SectionTitle, Avatar, Mono,
  BellIcon, FlameIcon, CalendarIcon, ChevRightIcon, AlertIcon,
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

interface Alert {
  id: string
  message: string
  severity: 'info' | 'warning' | 'critical'
}

interface SubjectTier {
  subject: string
  tier: TierKey
}

interface UpcomingSession {
  id: string
  concept: string
  subject: string
  scheduledAt: Date
}

interface ParentDashboardData {
  childName: string
  grade: string
  streak: number
  overallTier: TierKey
  subjectTiers: SubjectTier[]
  upcomingSessions: UpcomingSession[]
  alerts: Alert[]
  isPremium: boolean
}

// --- Loading skeleton ---
function LoadingState() {
  return (
    <div className="spz-root" style={{ background: 'var(--bg)', minHeight: '100vh', maxWidth: 390, margin: '0 auto', paddingBottom: 32 }}>
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ height: 28, width: 140, borderRadius: 8, background: 'var(--surface-3)', marginBottom: 6 }} />
        <div style={{ height: 16, width: 100, borderRadius: 8, background: 'var(--surface-3)' }} />
      </div>
      <div style={{ padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  )
}

// --- Alert banner ---
function AlertBanner({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) return null
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <BellIcon size={16} style={{ color: 'var(--tier-weak)' }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Needs your attention</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {alerts.map(a => (
          <div
            key={a.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: 12,
              borderRadius: 13,
              background: a.severity === 'critical' ? 'var(--tier-critical-soft)' : a.severity === 'warning' ? 'var(--tier-weak-soft)' : 'var(--surface-2)',
              border: '1px solid var(--border)',
            }}
          >
            <AlertIcon size={16} style={{ color: a.severity === 'critical' ? 'var(--tier-critical)' : 'var(--tier-weak)', flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.45 }}>{a.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// --- Stat chip ---
function StatChip({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
  return (
    <div style={{ flex: 1, padding: 10, borderRadius: 12, background: 'var(--surface-2)', textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 3 }}>{icon}</div>
      <Mono style={{ fontSize: 17, fontWeight: 700, display: 'block' }}>{value}</Mono>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
    </div>
  )
}

// --- DEMO DATA ---
const DEMO: ParentDashboardData = {
  childName: 'Aarav',
  grade: '10',
  streak: 7,
  overallTier: 'fair',
  subjectTiers: [
    { subject: 'Mathematics', tier: 'weak' },
    { subject: 'Science', tier: 'fair' },
    { subject: 'English', tier: 'ontrack' },
    { subject: 'Social Studies', tier: 'fair' },
  ],
  upcomingSessions: [
    { id: 's1', concept: 'Quadratic Equations', subject: 'Mathematics', scheduledAt: new Date(Date.now() + 3600000) },
    { id: 's2', concept: 'Light and Optics', subject: 'Science', scheduledAt: new Date(Date.now() + 7200000) },
  ],
  alerts: [
    { id: 'a1', message: 'Aarav has not practised Mathematics in 3 days. A short session today will help.', severity: 'warning' },
  ],
  isPremium: true,
}

export default function ParentDashboardPage() {
  const router = useRouter()
  const [isLoading] = useState(false)
  const [error] = useState<string | null>(null)
  const data = DEMO

  if (isLoading) return <LoadingState />
  if (error) return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', maxWidth: 390, margin: '0 auto', padding: 16 }}>
      <ErrorState title="Could not load dashboard" body="Please check your connection and try again." onRetry={() => {}} />
    </div>
  )

  const initials = data.childName.charAt(0).toUpperCase()

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', maxWidth: 390, margin: '0 auto', paddingBottom: 32 }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '16px 16px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)' }}>Home</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Spinzy · Parent</div>
        </div>
        <Avatar letter={initials} hue={240} size={38} />
      </div>

      <div style={{ padding: '14px 16px 24px' }}>
        <AlertBanner alerts={data.alerts} />

        {/* Child overview card */}
        <SectionTitle>Your child</SectionTitle>
        <Card pad={16} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <Avatar letter={initials} hue={240} size={48} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{data.childName}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Class {data.grade}</div>
            </div>
            <TierPill tier={data.overallTier} size="sm" />
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <StatChip
              icon={<FlameIcon size={16} style={{ color: 'var(--tier-weak)' }} />}
              value={data.streak}
              label="day streak"
            />
            <StatChip
              icon={<CalendarIcon size={16} style={{ color: 'var(--tier-ontrack)' }} />}
              value={data.subjectTiers.length}
              label="subjects"
            />
          </div>
          {/* Parent-friendly tier label */}
          <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--surface-2)', fontSize: 13, color: 'var(--text-muted)' }}>
            Overall: <span style={{ fontWeight: 700, color: 'var(--text)' }}>{PARENT_TIER_LABEL[data.overallTier]}</span>
          </div>
          <button
            onClick={() => router.push('/parent/progress')}
            style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', minHeight: 44 }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>See full progress report</span>
            <ChevRightIcon size={16} style={{ color: 'var(--primary)' }} />
          </button>
        </Card>

        {/* Subject summary */}
        <SectionTitle>How they are doing by subject</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {data.subjectTiers.map(({ subject, tier }) => (
            <div
              key={subject}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 13, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{subject}</span>
              <TierPill tier={tier} size="sm" />
            </div>
          ))}
        </div>

        {/* Upcoming sessions */}
        {data.upcomingSessions.length > 0 && (
          <>
            <SectionTitle>Coming up today</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {data.upcomingSessions.map(s => (
                <div
                  key={s.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 13, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)' }}
                >
                  <CalendarIcon size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{s.concept}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.subject}</div>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                    {s.scheduledAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        <Btn
          variant="primary"
          full
          onClick={() => router.push('/parent/schedule')}
          style={{ minHeight: 44 }}
        >
          View full schedule
        </Btn>
      </div>
    </div>
  )
}
