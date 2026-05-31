'use client'
import React, { useState } from 'react'
import {
  Card, EmptyState, ErrorState, SkeletonCard, TierPill,
  SectionTitle, Mono,
  CalendarIcon, ClockIcon, CheckCircleIcon, AlertIcon,
} from '@/components/ui'

type SessionStatus = 'upcoming' | 'completed' | 'missed'

interface ScheduleSession {
  id: string
  concept: string
  subject: string
  scheduledAt: Date
  status: SessionStatus
  durationMinutes: number
}

interface ScheduleProps {
  sessions?: ScheduleSession[]
  isLoading?: boolean
  error?: string | null
}

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const STATUS_STYLE: Record<SessionStatus, { bg: string; color: string; label: string }> = {
  upcoming:  { bg: 'var(--primary-soft)', color: 'var(--primary)',       label: 'Upcoming' },
  completed: { bg: 'var(--tier-strong-soft)', color: 'var(--tier-strong)', label: 'Done' },
  missed:    { bg: 'var(--tier-weak-soft)', color: 'var(--tier-weak)',    label: 'Rescheduled' },
}

function getWeekDates(): Date[] {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((day + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
}

function LoadingState() {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', maxWidth: 390, margin: '0 auto', paddingBottom: 32 }}>
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '16px 16px 14px' }}>
        <div style={{ height: 24, width: 120, borderRadius: 8, background: 'var(--surface-3)' }} />
      </div>
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  )
}

function SessionRow({ session }: { session: ScheduleSession }) {
  const st = STATUS_STYLE[session.status]
  const StatusIcon = session.status === 'completed' ? CheckCircleIcon : session.status === 'missed' ? AlertIcon : CalendarIcon
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: st.bg, color: st.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <StatusIcon size={18} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{session.concept}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{session.subject}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <ClockIcon size={12} style={{ color: 'var(--text-faint)' }} />
            <Mono style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
              {session.scheduledAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </Mono>
          </div>
          <Mono style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 600 }}>{session.durationMinutes} min</Mono>
        </div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: st.color, background: st.bg, padding: '3px 8px', borderRadius: 99, whiteSpace: 'nowrap' }}>
        {st.label}
      </span>
    </div>
  )
}

// --- DEMO DATA ---
const now = new Date()
const DEMO_SESSIONS: ScheduleSession[] = [
  { id: 's1', concept: 'Quadratic Equations', subject: 'Mathematics', scheduledAt: new Date(now.getTime() + 3600000), status: 'upcoming', durationMinutes: 30 },
  { id: 's2', concept: 'Light and Optics', subject: 'Science', scheduledAt: new Date(now.getTime() + 7200000), status: 'upcoming', durationMinutes: 25 },
  { id: 's3', concept: 'Reported Speech', subject: 'English', scheduledAt: new Date(now.getTime() - 86400000), status: 'completed', durationMinutes: 20 },
  { id: 's4', concept: 'The French Revolution', subject: 'Social Studies', scheduledAt: new Date(now.getTime() - 172800000), status: 'completed', durationMinutes: 30 },
  { id: 's5', concept: 'Trigonometry', subject: 'Mathematics', scheduledAt: new Date(now.getTime() - 259200000), status: 'missed', durationMinutes: 30 },
]

export default function ParentSchedulePage() {
  const [isLoading] = useState(false)
  const [error] = useState<string | null>(null)
  const sessions = DEMO_SESSIONS

  const weekDates = getWeekDates()
  const [selectedDay, setSelectedDay] = useState<Date>(weekDates.find(d => isSameDay(d, new Date())) ?? weekDates[0])

  if (isLoading) return <LoadingState />
  if (error) return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', maxWidth: 390, margin: '0 auto', padding: 16 }}>
      <ErrorState title="Could not load schedule" body="Please check your connection and try again." onRetry={() => {}} />
    </div>
  )

  const daySessions = sessions.filter(s => isSameDay(s.scheduledAt, selectedDay))

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', maxWidth: 390, margin: '0 auto', paddingBottom: 32 }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '16px 16px 14px' }}>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)' }}>Schedule</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Sessions this week</div>
      </div>

      {/* Week strip */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '10px 12px' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {weekDates.map((d, i) => {
            const isSelected = isSameDay(d, selectedDay)
            const isToday = isSameDay(d, new Date())
            const hasSessions = sessions.some(s => isSameDay(s.scheduledAt, d))
            return (
              <button
                key={i}
                onClick={() => setSelectedDay(d)}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 4px', borderRadius: 12, background: isSelected ? 'var(--primary)' : 'transparent', border: isToday && !isSelected ? '1.5px solid var(--primary)' : '1.5px solid transparent', cursor: 'pointer', minHeight: 44 }}
              >
                <span style={{ fontSize: 10, fontWeight: 700, color: isSelected ? 'var(--on-brand)' : 'var(--text-muted)' }}>{WEEK_DAYS[i]}</span>
                <Mono style={{ fontSize: 14, fontWeight: 700, color: isSelected ? 'var(--on-brand)' : isToday ? 'var(--primary)' : 'var(--text)' }}>{d.getDate()}</Mono>
                {hasSessions && (
                  <div style={{ width: 5, height: 5, borderRadius: 99, background: isSelected ? 'var(--on-brand)' : 'var(--primary)', opacity: isSelected ? 0.7 : 1 }} />
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ padding: '14px 16px 24px' }}>
        <SectionTitle>
          {selectedDay.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </SectionTitle>

        {daySessions.length === 0 ? (
          <EmptyState
            icon="calendar"
            title="No sessions on this day"
            body="Tap a different day to see sessions, or check upcoming days."
            action="See upcoming"
            onAction={() => {
              const next = weekDates.find(d => sessions.some(s => isSameDay(s.scheduledAt, d) && d > selectedDay))
              if (next) setSelectedDay(next)
            }}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {daySessions.map(s => (
              <SessionRow key={s.id} session={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
