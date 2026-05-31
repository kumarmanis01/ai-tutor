'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppHeader, Card, Btn, EmptyState, ErrorState, SkeletonCard, SubjectChip, Segmented } from '@/components/ui'
import type { SubjectKey } from '@/lib/constants/subjects'

interface RevisionTopic {
  id: string
  concept: string
  subject: SubjectKey
  strength: number  // 0-1
  dueLabel?: string
}

interface ReviseProps {
  topics?: RevisionTopic[]
  isLoading?: boolean
  error?: string | null
}

const ROOT_STYLE: React.CSSProperties = {
  background: 'var(--bg)',
  minHeight: '100vh',
  maxWidth: 390,
  margin: '0 auto',
  paddingBottom: 24,
}

function StrengthBar({ strength }: { strength: number }) {
  const color = strength < 0.4 ? 'var(--tier-critical)' : strength < 0.7 ? 'var(--tier-weak)' : 'var(--tier-strong)'
  const filled = Math.round(strength * 5)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Memory</span>
      <div style={{ display: 'flex', gap: 3 }}>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} style={{ width: 14, height: 6, borderRadius: 3, background: i < filled ? color : 'var(--surface-3)' }} />
        ))}
      </div>
    </div>
  )
}

function RevisionCard({ r, onRevise, onSnooze, upcoming }: { r: RevisionTopic; onRevise?: () => void; onSnooze?: () => void; upcoming?: boolean }) {
  return (
    <Card pad={14}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ marginBottom: 7 }}><SubjectChip subject={r.subject} size="sm" /></div>
          <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.3, marginBottom: 10, color: 'var(--text)' }}>{r.concept}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StrengthBar strength={r.strength} />
            {upcoming && r.dueLabel && (
              <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text-faint)', fontWeight: 600 }}>{r.dueLabel}</span>
            )}
          </div>
        </div>
      </div>
      {!upcoming && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Btn size="sm" full onClick={onRevise}>Revise now</Btn>
          <Btn size="sm" variant="secondary" onClick={onSnooze}>Snooze</Btn>
        </div>
      )}
    </Card>
  )
}

export default function RevisePage(_props: ReviseProps) {
  const router = useRouter()
  const [tab, setTab] = useState<'due' | 'upcoming'>('due')
  const [snoozed, setSnoozed] = useState<string[]>([])
  const [isLoading] = useState(false)
  const [error] = useState<string | null>(null)

  // Demo topics -- in production from API
  const dueTodayTopics: RevisionTopic[] = [
    { id: 'r1', concept: 'Quadratic Equations', subject: 'math', strength: 0.35 },
    { id: 'r2', concept: 'Photosynthesis', subject: 'science', strength: 0.6 },
    { id: 'r3', concept: 'Linear Equations', subject: 'math', strength: 0.75 },
  ]
  const upcomingTopics: RevisionTopic[] = [
    { id: 'r4', concept: 'The French Revolution', subject: 'social', strength: 0.5, dueLabel: 'Tomorrow' },
    { id: 'r5', concept: 'Polynomials', subject: 'math', strength: 0.8, dueLabel: 'In 3 days' },
  ]

  const visibleDue = dueTodayTopics.filter(r => !snoozed.includes(r.id))

  if (isLoading) {
    return (
      <div style={ROOT_STYLE}>
        <div style={{ padding: '14px 20px 18px' }}><div style={{ height: 24, width: 120, borderRadius: 8, background: 'var(--skeleton-base)' }} /></div>
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2].map(i => <SkeletonCard key={i} />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ ...ROOT_STYLE, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100vh' }}>
        <ErrorState body={error} onRetry={() => {}} />
      </div>
    )
  }

  return (
    <div style={ROOT_STYLE}>
      <div style={{ padding: '8px 16px 12px' }}>
        <AppHeader title="Revisions" sub="Spaced repetition keeps it stuck" large />
      </div>

      <div style={{ padding: '0 16px 12px' }}>
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

      <div style={{ padding: '0 16px 24px' }}>
        {tab === 'due' ? (
          visibleDue.length === 0 ? (
            <EmptyState
              title="You're all caught up"
              body="No revisions due today. Come back tomorrow to keep your memory sharp."
              action="Browse learning path"
              onAction={() => router.push('/student/path')}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
          upcomingTopics.length === 0 ? (
            <EmptyState
              title="Nothing coming up"
              body="Keep learning and topics will appear here for spaced revision."
              action="Start learning"
              onAction={() => router.push('/student/path')}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {upcomingTopics.map(r => <RevisionCard key={r.id} r={r} upcoming />)}
            </div>
          )
        )}
      </div>
    </div>
  )
}
