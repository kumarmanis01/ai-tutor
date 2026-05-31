'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AppHeader, BottomNav, EmptyState, ErrorState, SkeletonCard, SubjectChip, Bar } from '@/components/ui'
import type { SubjectKey } from '@/lib/constants/subjects'

// --- Types ---

interface PathTopic {
  id: string
  concept: string
  subject: SubjectKey
  status: 'upcoming' | 'in_progress' | 'completed' | 'locked'
  mastery?: number
  prerequisitesMet: boolean
}

interface PathData {
  topics: PathTopic[]
}

// --- Constants ---

const STATUS_PILL: Record<string, { label: string; color: string; bg: string }> = {
  completed:   { label: 'Completed',   color: 'var(--tier-strong)', bg: 'var(--tier-strong-soft)' },
  in_progress: { label: 'In progress', color: 'var(--primary)',     bg: 'var(--primary-soft)' },
  upcoming:    { label: 'Upcoming',    color: 'var(--text-faint)',  bg: 'var(--surface-2)' },
  locked:      { label: 'Locked',      color: 'var(--text-faint)',  bg: 'var(--surface-2)' },
}

// --- Page ---

export default function PathPage() {
  const router = useRouter()
  const [data, setData] = useState<PathData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | SubjectKey>('all')

  const fetchPath = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/student/path')
      if (!res.ok) throw new Error('Failed to load learning path')
      const json = await res.json() as PathData
      setData(json)
    } catch {
      setError('Could not load your learning path. Tap to retry.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchPath() }, [fetchPath])

  const navTo = (tab: string) => router.push(`/student/${tab === 'home' ? 'dashboard' : tab}`)

  if (isLoading) {
    return (
      <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto relative pb-[100px]">
        <div className="px-5 pt-[14px] pb-[18px]"><div className="h-6 w-[140px] rounded-lg bg-[var(--skeleton-base)]" /></div>
        <div className="px-4 flex flex-col gap-3">
          {[0, 1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
        <BottomNav active="path" onChange={navTo} />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto relative flex flex-col justify-center pb-20">
        <ErrorState body={error ?? 'Something went wrong.'} onRetry={fetchPath} />
        <BottomNav active="path" onChange={navTo} />
      </div>
    )
  }

  // TODO: wire API -- /api/student/path returns PathData

  const topics = data.topics

  if (topics.length === 0) {
    return (
      <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto relative pb-[100px]">
        <div className="px-4 pt-2 pb-3"><AppHeader title="Learning path" large /></div>
        <EmptyState
          title="Your path is being built"
          body="Finish your diagnostic and Vidya will map a personalised concept timeline for you."
          action="Start diagnostic"
          onAction={() => router.push('/student/diagnostic')}
        />
        <BottomNav active="path" onChange={navTo} />
      </div>
    )
  }

  const subjectFilters: Array<'all' | SubjectKey> = ['all', ...Array.from(new Set(topics.map(t => t.subject))) as SubjectKey[]]
  const filtered = filter === 'all' ? topics : topics.filter(t => t.subject === filter)
  const nextIncomplete = filtered.find(t => t.status !== 'completed')

  return (
    <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto relative pb-[100px]">
      <div className="px-4 pt-2 pb-3">
        <AppHeader
          title="Learning path"
          large
          right={
            nextIncomplete ? (
              <button
                onClick={() => router.push(`/session/${encodeURIComponent(nextIncomplete.concept)}`)}
                className="inline-flex items-center gap-[5px] h-[34px] px-3 rounded-[10px] bg-[var(--primary-soft)] text-[var(--primary)] border-0 text-[12.5px] font-bold cursor-pointer [font-family:var(--font-sans)] min-h-[44px]"
              >
                🎯 Jump to next
              </button>
            ) : undefined
          }
        />
      </div>

      {/* Subject filters */}
      <div className="px-4 pb-3 flex gap-[7px] overflow-x-auto [scrollbar-width:none]">
        {subjectFilters.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={[
              'inline-flex items-center h-[34px] px-[14px] rounded-xl cursor-pointer shrink-0',
              'font-semibold text-[13px] [font-family:var(--font-sans)] min-h-[44px]',
              filter === f
                ? 'bg-[var(--primary)] text-[var(--on-brand)] border-[1.5px] border-[var(--primary)]'
                : 'bg-[var(--surface)] text-[var(--text)] border-[1.5px] border-[var(--border)]',
            ].join(' ')}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="px-4 pb-6 relative">
        {/* Rail */}
        <div className="absolute left-[35px] top-2 bottom-[30px] w-[2px] bg-[var(--border)]" />
        <div className="flex flex-col gap-3">
          {filtered.map(topic => {
            const st = STATUS_PILL[topic.status]
            const isNext = topic.id === nextIncomplete?.id
            const dotColor = topic.status === 'completed' ? 'var(--tier-strong)' : topic.status === 'in_progress' ? 'var(--primary)' : 'var(--border)'
            const dotSize = topic.status === 'completed' ? 'w-6 h-6' : 'w-[18px] h-[18px]'
            const dotBg = (topic.status === 'upcoming' || topic.status === 'locked') ? 'bg-[var(--surface)]' : ''
            return (
              <div key={topic.id} className="flex gap-[14px] relative z-[1]">
                {/* Timeline dot */}
                <div className="shrink-0 w-[38px] flex justify-center pt-4">
                  <div
                    className={[
                      dotSize, 'rounded-full flex items-center justify-center text-white text-[12px]',
                      dotBg,
                    ].join(' ')}
                    style={{
                      background: (topic.status === 'upcoming' || topic.status === 'locked') ? 'var(--surface)' : dotColor,
                      border: `3px solid ${(topic.status === 'upcoming' || topic.status === 'locked') ? 'var(--border)' : dotColor}`,
                    }}
                  >
                    {topic.status === 'completed' && '✓'}
                    {topic.status === 'locked' && '🔒'}
                  </div>
                </div>
                {/* Card */}
                <div
                  onClick={() => topic.status !== 'locked' && router.push(`/session/${encodeURIComponent(topic.concept)}`)}
                  className={[
                    'flex-1 p-[14px] rounded-2xl bg-[var(--surface)]',
                    topic.status !== 'locked' ? 'cursor-pointer' : 'cursor-default',
                    isNext ? 'shadow-[var(--shadow-md)] border-[1.5px] border-[var(--primary)]' : 'shadow-[var(--shadow-sm)] border-[1.5px] border-[var(--border)]',
                  ].join(' ')}
                >
                  <div className="flex gap-[6px] mb-[7px] items-center">
                    <SubjectChip subject={topic.subject} size="sm" />
                    <span
                      className="inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-semibold whitespace-nowrap"
                      style={{ background: st.bg, color: st.color }}
                    >
                      {st.label}
                    </span>
                    {isNext && (
                      <span className="ml-auto text-[10.5px] font-bold text-[var(--primary)] uppercase tracking-[0.04em]">Next →</span>
                    )}
                  </div>
                  <div className="text-[14.5px] font-semibold leading-[1.3] text-[var(--text)]">{topic.concept}</div>
                  {topic.status === 'in_progress' && topic.mastery !== undefined && (
                    <div className="mt-[10px]">
                      <Bar value={topic.mastery} h={6} />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <BottomNav active="path" onChange={navTo} />
    </div>
  )
}
