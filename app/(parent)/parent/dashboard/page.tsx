'use client'
import React, { useState, useEffect, useCallback } from 'react'
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

// --- Types ---

interface DashAlert {
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
  scheduledAt: string  // ISO string from API
}

interface ParentDashboardData {
  childName: string
  grade: string
  streak: number
  overallTier: TierKey
  subjectTiers: SubjectTier[]
  upcomingSessions: UpcomingSession[]
  alerts: DashAlert[]
  isPremium: boolean
}

// --- Sub-components ---

function LoadingState() {
  return (
    <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto pb-8">
      <div className="px-4 pt-4 pb-0">
        <div className="h-7 w-[140px] rounded-lg bg-[var(--surface-3)] mb-[6px]" />
        <div className="h-4 w-[100px] rounded-lg bg-[var(--surface-3)]" />
      </div>
      <div className="px-4 pt-4 pb-0 flex flex-col gap-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  )
}

function AlertBanner({ alerts }: { alerts: DashAlert[] }) {
  if (alerts.length === 0) return null
  return (
    <div className="mb-4">
      <div className="flex items-center gap-[6px] mb-2">
        <BellIcon size={16} className="text-[var(--tier-weak)]" />
        <span className="text-[13px] font-bold text-[var(--text)]">Needs your attention</span>
      </div>
      <div className="flex flex-col gap-2">
        {alerts.map(a => (
          <div
            key={a.id}
            className={[
              'flex items-start gap-[10px] p-3 rounded-[13px] border border-[var(--border)]',
              a.severity === 'critical' ? 'bg-[var(--tier-critical-soft)]' : a.severity === 'warning' ? 'bg-[var(--tier-weak-soft)]' : 'bg-[var(--surface-2)]',
            ].join(' ')}
          >
            <AlertIcon size={16} className={[
              'shrink-0 mt-[1px]',
              a.severity === 'critical' ? 'text-[var(--tier-critical)]' : 'text-[var(--tier-weak)]',
            ].join(' ')} />
            <span className="text-[13px] text-[var(--text)] leading-[1.45]">{a.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatChip({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
  return (
    <div className="flex-1 p-[10px] rounded-xl bg-[var(--surface-2)] text-center">
      <div className="flex justify-center mb-[3px]">{icon}</div>
      <Mono className="text-[17px] font-bold block">{value}</Mono>
      <div className="text-[10px] text-[var(--text-muted)] font-semibold">{label}</div>
    </div>
  )
}

// --- Page ---

export default function ParentDashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<ParentDashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/parent/dashboard')
      if (!res.ok) throw new Error('Failed to load dashboard')
      const json = await res.json() as ParentDashboardData
      setData(json)
    } catch {
      setError('Could not load the dashboard. Tap to retry.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  if (isLoading) return <LoadingState />

  if (error || !data) return (
    <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto p-4">
      <ErrorState title="Could not load dashboard" body={error ?? 'Please check your connection and try again.'} onRetry={fetchDashboard} />
    </div>
  )

  // TODO: wire API — /api/parent/dashboard returns ParentDashboardData

  if (data.subjectTiers.length === 0) return (
    <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto">
      <div className="bg-[var(--surface)] border-b border-[var(--border)] px-4 pt-4 pb-[14px]">
        <div className="text-[18px] font-extrabold tracking-[-0.02em] text-[var(--text)]">Home</div>
      </div>
      <EmptyState
        title="No data yet"
        body={`${data.childName} has not completed any sessions yet. Encourage them to get started!`}
        action="View schedule"
        onAction={() => router.push('/parent/schedule')}
      />
    </div>
  )

  const initials = data.childName.charAt(0).toUpperCase()

  return (
    <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto pb-8">
      {/* Header */}
      <div className="bg-[var(--surface)] border-b border-[var(--border)] px-4 pt-4 pb-[14px] flex items-center gap-[10px]">
        <div className="flex-1">
          <div className="text-[18px] font-extrabold tracking-[-0.02em] text-[var(--text)]">Home</div>
          <div className="text-[12px] text-[var(--text-muted)]">Spinzy · Parent</div>
        </div>
        <Avatar letter={initials} hue={240} size={38} />
      </div>

      <div className="px-4 pt-[14px] pb-6">
        <AlertBanner alerts={data.alerts} />

        {/* Child overview card */}
        <SectionTitle>Your child</SectionTitle>
        <Card pad={16} className="mb-4">
          <div className="flex items-center gap-3 mb-[14px]">
            <Avatar letter={initials} hue={240} size={48} />
            <div className="flex-1">
              <div className="text-[16px] font-bold text-[var(--text)]">{data.childName}</div>
              <div className="text-[12.5px] text-[var(--text-muted)]">Class {data.grade}</div>
            </div>
            <TierPill tier={data.overallTier} size="sm" />
          </div>
          <div className="flex gap-2 mb-[14px]">
            <StatChip
              icon={<FlameIcon size={16} className="text-[var(--tier-weak)]" />}
              value={data.streak}
              label="day streak"
            />
            <StatChip
              icon={<CalendarIcon size={16} className="text-[var(--tier-ontrack)]" />}
              value={data.subjectTiers.length}
              label="subjects"
            />
          </div>
          {/* Parent-friendly tier label */}
          <div className="px-3 py-[10px] rounded-[10px] bg-[var(--surface-2)] text-[13px] text-[var(--text-muted)]">
            Overall: <span className="font-bold text-[var(--text)]">{PARENT_TIER_LABEL[data.overallTier]}</span>
          </div>
          <button
            onClick={() => router.push('/parent/progress')}
            className="mt-[14px] pt-3 border-t border-[var(--border)] w-full flex items-center justify-between bg-transparent border-x-0 border-b-0 cursor-pointer [font-family:var(--font-sans)] min-h-[44px]"
          >
            <span className="text-[13px] font-semibold text-[var(--primary)]">See full progress report</span>
            <ChevRightIcon size={16} className="text-[var(--primary)]" />
          </button>
        </Card>

        {/* Subject summary */}
        <SectionTitle>How they are doing by subject</SectionTitle>
        <div className="flex flex-col gap-2 mb-4">
          {data.subjectTiers.map(({ subject, tier }) => (
            <div
              key={subject}
              className="flex items-center gap-3 p-[13px] rounded-[14px] bg-[var(--surface)] border border-[var(--border)]"
            >
              <span className="flex-1 text-[14px] font-semibold text-[var(--text)]">{subject}</span>
              <TierPill tier={tier} size="sm" />
            </div>
          ))}
        </div>

        {/* Upcoming sessions */}
        {data.upcomingSessions.length > 0 && (
          <>
            <SectionTitle>Coming up today</SectionTitle>
            <div className="flex flex-col gap-2 mb-4">
              {data.upcomingSessions.map(s => {
                const scheduledAt = new Date(s.scheduledAt)
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 p-[13px] rounded-[14px] bg-[var(--surface)] border border-[var(--border)]"
                  >
                    <CalendarIcon size={18} className="text-[var(--text-muted)] shrink-0" />
                    <div className="flex-1">
                      <div className="text-[14px] font-semibold text-[var(--text)]">{s.concept}</div>
                      <div className="text-[12px] text-[var(--text-muted)]">{s.subject}</div>
                    </div>
                    <span className="text-[12px] text-[var(--text-muted)] font-semibold">
                      {scheduledAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        )}

        <Btn variant="primary" full onClick={() => router.push('/parent/schedule')}>
          View full schedule
        </Btn>
      </div>
    </div>
  )
}
