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
    <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto pb-8">
      <div className="bg-[var(--surface)] border-b border-[var(--border)] px-4 pt-4 pb-[14px]">
        <div className="h-6 w-[120px] rounded-lg bg-[var(--surface-3)]" />
      </div>
      <div className="px-4 pt-[14px] flex flex-col gap-3">
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
    <div className="flex items-start gap-3 p-[14px] rounded-[14px] bg-[var(--surface)] border border-[var(--border)]">
      <div
        className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
        style={{ background: st.bg, color: st.color }}
      >
        <StatusIcon size={18} />
      </div>
      <div className="flex-1">
        <div className="text-[14px] font-bold text-[var(--text)] mb-[2px]">{session.concept}</div>
        <div className="text-[12px] text-[var(--text-muted)] mb-[6px]">{session.subject}</div>
        <div className="flex items-center gap-[10px]">
          <div className="flex items-center gap-1">
            <ClockIcon size={12} style={{ color: 'var(--text-faint)' }} />
            <Mono className="text-[11px] text-[var(--text-muted)] font-semibold">
              {session.scheduledAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </Mono>
          </div>
          <Mono className="text-[11px] text-[var(--text-faint)] font-semibold">{session.durationMinutes} min</Mono>
        </div>
      </div>
      <span
        className="text-[11px] font-bold px-2 py-[3px] rounded-full whitespace-nowrap"
        style={{ color: st.color, background: st.bg }}
      >
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
    <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto p-4">
      <ErrorState title="Could not load schedule" body="Please check your connection and try again." onRetry={() => {}} />
    </div>
  )

  const daySessions = sessions.filter(s => isSameDay(s.scheduledAt, selectedDay))

  return (
    <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto pb-8">
      {/* Header */}
      <div className="bg-[var(--surface)] border-b border-[var(--border)] px-4 pt-4 pb-[14px]">
        <div className="text-[18px] font-extrabold tracking-[-0.02em] text-[var(--text)]">Schedule</div>
        <div className="text-[12px] text-[var(--text-muted)] mt-[2px]">Sessions this week</div>
      </div>

      {/* Week strip */}
      <div className="bg-[var(--surface)] border-b border-[var(--border)] px-3 py-[10px]">
        <div className="flex gap-1">
          {weekDates.map((d, i) => {
            const isSelected = isSameDay(d, selectedDay)
            const isToday = isSameDay(d, new Date())
            const hasSessions = sessions.some(s => isSameDay(s.scheduledAt, d))
            return (
              <button
                key={i}
                onClick={() => setSelectedDay(d)}
                className={[
                  'flex-1 flex flex-col items-center gap-1 px-1 py-2 rounded-xl cursor-pointer min-h-[44px]',
                  isSelected ? 'bg-[var(--primary)]' : 'bg-transparent',
                  isToday && !isSelected ? 'border-[1.5px] border-[var(--primary)]' : 'border-[1.5px] border-transparent',
                ].join(' ')}
              >
                <span className={['text-[10px] font-bold', isSelected ? 'text-[var(--on-brand)]' : 'text-[var(--text-muted)]'].join(' ')}>{WEEK_DAYS[i]}</span>
                <Mono className={['text-[14px] font-bold', isSelected ? 'text-[var(--on-brand)]' : isToday ? 'text-[var(--primary)]' : 'text-[var(--text)]'].join(' ')}>{d.getDate()}</Mono>
                {hasSessions && (
                  <div
                    className="w-[5px] h-[5px] rounded-full"
                    style={{ background: isSelected ? 'var(--on-brand)' : 'var(--primary)', opacity: isSelected ? 0.7 : 1 }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="px-4 pt-[14px] pb-6">
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
          <div className="flex flex-col gap-[10px]">
            {daySessions.map(s => (
              <SessionRow key={s.id} session={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
