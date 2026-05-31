'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AppHeader, Card, Btn, EmptyState, ErrorState, SkeletonCard, SubjectChip, Segmented } from '@/components/ui'
import type { SubjectKey } from '@/lib/constants/subjects'

// --- Types ---

interface RevisionTopic {
  id: string
  concept: string
  subject: SubjectKey
  strength: number  // 0-1
  dueLabel?: string
}

interface ReviseData {
  dueToday: RevisionTopic[]
  upcoming: RevisionTopic[]
}

// --- Sub-components ---

function StrengthBar({ strength }: { strength: number }) {
  const color = strength < 0.4 ? 'var(--tier-critical)' : strength < 0.7 ? 'var(--tier-weak)' : 'var(--tier-strong)'
  const filled = Math.round(strength * 5)
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-semibold text-[var(--text-muted)]">Memory</span>
      <div className="flex gap-[3px]">
        {[0, 1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="w-[14px] h-[6px] rounded-[3px]"
            style={{ background: i < filled ? color : 'var(--surface-3)' }}
          />
        ))}
      </div>
    </div>
  )
}

function RevisionCard({ r, onRevise, onSnooze, upcoming }: { r: RevisionTopic; onRevise?: () => void; onSnooze?: () => void; upcoming?: boolean }) {
  return (
    <Card pad={14}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="mb-[7px]"><SubjectChip subject={r.subject} size="sm" /></div>
          <div className="text-[14.5px] font-semibold leading-[1.3] mb-[10px] text-[var(--text)]">{r.concept}</div>
          <div className="flex items-center gap-2">
            <StrengthBar strength={r.strength} />
            {upcoming && r.dueLabel && (
              <span className="ml-auto text-[11.5px] text-[var(--text-faint)] font-semibold">{r.dueLabel}</span>
            )}
          </div>
        </div>
      </div>
      {!upcoming && (
        <div className="flex gap-2 mt-3">
          <Btn size="sm" full onClick={onRevise}>Revise now</Btn>
          <Btn size="sm" variant="secondary" onClick={onSnooze}>Snooze</Btn>
        </div>
      )}
    </Card>
  )
}

// --- Page ---

export default function RevisePage() {
  const router = useRouter()
  const [data, setData] = useState<ReviseData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'due' | 'upcoming'>('due')
  const [snoozed, setSnoozed] = useState<string[]>([])

  const fetchRevise = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/student/revise')
      if (!res.ok) throw new Error('Failed to load revisions')
      const json = await res.json() as ReviseData
      setData(json)
    } catch {
      setError('Could not load your revisions. Tap to retry.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchRevise() }, [fetchRevise])

  if (isLoading) {
    return (
      <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto pb-6">
        <div className="px-5 pt-[14px] pb-[18px]"><div className="h-6 w-[120px] rounded-lg bg-[var(--skeleton-base)]" /></div>
        <div className="px-4 flex flex-col gap-3">
          {[0, 1, 2].map(i => <SkeletonCard key={i} />)}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto flex flex-col justify-center">
        <ErrorState body={error ?? 'Something went wrong.'} onRetry={fetchRevise} />
      </div>
    )
  }

  // TODO: wire API -- /api/student/revise returns ReviseData

  const visibleDue = data.dueToday.filter(r => !snoozed.includes(r.id))

  return (
    <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto pb-6">
      <div className="px-4 pt-2 pb-3">
        <AppHeader title="Revisions" sub="Spaced repetition keeps it stuck" large />
      </div>

      <div className="px-4 pb-3">
        <Segmented
          full
          options={[
            { id: 'due', label: `Due Today${visibleDue.length > 0 ? ` · ${visibleDue.length}` : ''}` },
            { id: 'upcoming', label: 'Upcoming' },
          ]}
          value={tab}
          onChange={v => setTab(v as 'due' | 'upcoming')}
        />
      </div>

      <div className="px-4 pb-6">
        {tab === 'due' ? (
          visibleDue.length === 0 ? (
            <EmptyState
              title="You're all caught up"
              body="No revisions due today. Come back tomorrow to keep your memory sharp."
              action="Browse learning path"
              onAction={() => router.push('/student/path')}
            />
          ) : (
            <div className="flex flex-col gap-[10px]">
              {visibleDue.map(r => (
                <RevisionCard
                  key={r.id}
                  r={r}
                  onRevise={() => router.push(`/session/${encodeURIComponent(r.concept)}`)}
                  onSnooze={() => setSnoozed(s => [...s, r.id])}
                />
              ))}
            </div>
          )
        ) : (
          data.upcoming.length === 0 ? (
            <EmptyState
              title="Nothing coming up"
              body="Keep learning and topics will appear here for spaced revision."
              action="Start learning"
              onAction={() => router.push('/student/path')}
            />
          ) : (
            <div className="flex flex-col gap-[10px]">
              {data.upcoming.map(r => <RevisionCard key={r.id} r={r} upcoming />)}
            </div>
          )
        )}
      </div>
    </div>
  )
}
