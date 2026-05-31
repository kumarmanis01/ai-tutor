'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppHeader, BottomNav, Card, Btn, EmptyState, ErrorState, SkeletonCard, SubjectChip, Bar } from '@/components/ui'
import type { SubjectKey } from '@/lib/constants/subjects'

interface PathTopic {
  id: string
  concept: string
  subject: SubjectKey
  status: 'upcoming' | 'in_progress' | 'completed' | 'locked'
  mastery?: number
  prerequisitesMet: boolean
}

interface PathProps {
  topics?: PathTopic[]
  isLoading?: boolean
  error?: string | null
}

const STATUS_PILL: Record<string, { label: string; color: string; bg: string }> = {
  completed:   { label: 'Completed',   color: 'var(--tier-strong)', bg: 'var(--tier-strong-soft)' },
  in_progress: { label: 'In progress', color: 'var(--primary)',     bg: 'var(--primary-soft)' },
  upcoming:    { label: 'Upcoming',    color: 'var(--text-faint)',  bg: 'var(--surface-2)' },
  locked:      { label: 'Locked',      color: 'var(--text-faint)',  bg: 'var(--surface-2)' },
}

const ROOT_STYLE: React.CSSProperties = {
  background: 'var(--bg)',
  minHeight: '100vh',
  maxWidth: 390,
  margin: '0 auto',
  position: 'relative',
  paddingBottom: 100,
}

export default function PathPage(_props: PathProps) {
  const router = useRouter()
  const [filter, setFilter] = useState<'all' | SubjectKey>('all')
  const [isLoading] = useState(false)
  const [error] = useState<string | null>(null)

  // Demo topics -- in production these come from the API
  const topics: PathTopic[] = [
    { id: 't1', concept: 'Linear Equations', subject: 'math', status: 'completed', mastery: 85, prerequisitesMet: true },
    { id: 't2', concept: 'Quadratic Equations', subject: 'math', status: 'in_progress', mastery: 45, prerequisitesMet: true },
    { id: 't3', concept: 'Polynomials', subject: 'math', status: 'upcoming', prerequisitesMet: true },
    { id: 't4', concept: 'Cell Biology', subject: 'science', status: 'completed', mastery: 70, prerequisitesMet: true },
    { id: 't5', concept: 'Photosynthesis', subject: 'science', status: 'upcoming', prerequisitesMet: true },
    { id: 't6', concept: 'The French Revolution', subject: 'social', status: 'upcoming', prerequisitesMet: false },
  ]

  const subjectFilters: Array<'all' | SubjectKey> = ['all', ...Array.from(new Set(topics.map(t => t.subject))) as SubjectKey[]]
  const filtered = filter === 'all' ? topics : topics.filter(t => t.subject === filter)
  const nextIncomplete = filtered.find(t => t.status !== 'completed')

  if (isLoading) {
    return (
      <div style={ROOT_STYLE}>
        <div style={{ padding: '14px 20px 18px' }}><div style={{ height: 24, width: 140, borderRadius: 8, background: 'var(--skeleton-base)' }} /></div>
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
        <BottomNav active="path" onChange={tab => router.push(`/student/${tab === 'home' ? 'dashboard' : tab}`)} />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ ...ROOT_STYLE, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100vh', paddingBottom: 80 }}>
        <ErrorState body={error} onRetry={() => {}} />
        <BottomNav active="path" onChange={tab => router.push(`/student/${tab === 'home' ? 'dashboard' : tab}`)} />
      </div>
    )
  }

  if (topics.length === 0) {
    return (
      <div style={ROOT_STYLE}>
        <div style={{ padding: '8px 16px 12px' }}><AppHeader title="Learning path" large /></div>
        <EmptyState
          title="Your path is being built"
          body="Finish your diagnostic and Vidya will map a personalised concept timeline for you."
          action="Start diagnostic"
          onAction={() => router.push('/student/diagnostic')}
        />
        <BottomNav active="path" onChange={tab => router.push(`/student/${tab === 'home' ? 'dashboard' : tab}`)} />
      </div>
    )
  }

  return (
    <div style={ROOT_STYLE}>
      <div style={{ padding: '8px 16px 12px' }}>
        <AppHeader
          title="Learning path"
          large
          right={
            nextIncomplete ? (
              <button
                onClick={() => router.push(`/session/${encodeURIComponent(nextIncomplete.concept)}`)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 34, padding: '0 12px', borderRadius: 10, background: 'var(--primary-soft)', color: 'var(--primary)', border: 'none', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', minHeight: 44 }}
              >
                🎯 Jump to next
              </button>
            ) : undefined
          }
        />
      </div>

      {/* Subject filters */}
      <div style={{ padding: '0 16px 12px', display: 'flex', gap: 7, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {subjectFilters.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 14px', borderRadius: 12, cursor: 'pointer', flexShrink: 0,
              background: filter === f ? 'var(--primary)' : 'var(--surface)',
              color: filter === f ? 'var(--on-brand)' : 'var(--text)',
              border: `1.5px solid ${filter === f ? 'var(--primary)' : 'var(--border)'}`,
              fontWeight: 600, fontSize: 13, fontFamily: 'var(--font-sans)', minHeight: 44,
            }}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div style={{ padding: '0 16px 24px', position: 'relative' }}>
        {/* Rail */}
        <div style={{ position: 'absolute', left: 35, top: 8, bottom: 30, width: 2, background: 'var(--border)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(topic => {
            const st = STATUS_PILL[topic.status]
            const isNext = topic.id === nextIncomplete?.id
            const dotColor = topic.status === 'completed' ? 'var(--tier-strong)' : topic.status === 'in_progress' ? 'var(--primary)' : 'var(--border)'
            return (
              <div key={topic.id} style={{ display: 'flex', gap: 14, position: 'relative', zIndex: 1 }}>
                {/* Timeline dot */}
                <div style={{ flexShrink: 0, width: 38, display: 'flex', justifyContent: 'center', paddingTop: 16 }}>
                  <div style={{
                    width: topic.status === 'completed' ? 24 : 18,
                    height: topic.status === 'completed' ? 24 : 18,
                    borderRadius: 99,
                    background: topic.status === 'upcoming' || topic.status === 'locked' ? 'var(--surface)' : dotColor,
                    border: `3px solid ${topic.status === 'upcoming' || topic.status === 'locked' ? 'var(--border)' : dotColor}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12,
                  }}>
                    {topic.status === 'completed' && '✓'}
                    {topic.status === 'locked' && '🔒'}
                  </div>
                </div>
                {/* Card */}
                <div
                  onClick={() => topic.status !== 'locked' && router.push(`/session/${encodeURIComponent(topic.concept)}`)}
                  style={{
                    flex: 1, cursor: topic.status !== 'locked' ? 'pointer' : 'default', padding: 14, borderRadius: 16,
                    background: 'var(--surface)', border: `1.5px solid ${isNext ? 'var(--primary)' : 'var(--border)'}`,
                    boxShadow: isNext ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                  }}
                >
                  <div style={{ display: 'flex', gap: 6, marginBottom: 7, alignItems: 'center' }}>
                    <SubjectChip subject={topic.subject} size="sm" />
                    <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 8px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>
                      {st.label}
                    </span>
                    {isNext && (
                      <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Next →</span>
                    )}
                  </div>
                  <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.3, color: 'var(--text)' }}>{topic.concept}</div>
                  {topic.status === 'in_progress' && topic.mastery !== undefined && (
                    <div style={{ marginTop: 10 }}>
                      <Bar value={topic.mastery} h={6} />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <BottomNav
        active="path"
        onChange={tab => router.push(`/student/${tab === 'home' ? 'dashboard' : tab}`)}
      />
    </div>
  )
}
