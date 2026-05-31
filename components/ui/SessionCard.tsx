'use client'
import React from 'react'
import { SubjectKey } from '@/lib/constants/subjects'
import { Card } from './Card'
import { SubjectChip } from './SubjectChip'

type SessionStatus = 'UPCOMING' | 'IN_PROGRESS' | 'COMPLETED'

interface SessionCardProps {
  concept: string
  subject: SubjectKey
  status: SessionStatus
  mastery?: number
  onClick?: () => void
  cta?: string
}

const STATUS_MAP: Record<SessionStatus, { label: string; color: string; bg: string }> = {
  UPCOMING:    { label: 'Upcoming',    color: 'var(--text-faint)', bg: 'var(--surface-2)' },
  IN_PROGRESS: { label: 'In progress', color: 'var(--primary)',    bg: 'var(--primary-soft)' },
  COMPLETED:   { label: 'Completed',   color: 'var(--tier-strong)', bg: 'var(--tier-strong-soft)' },
}

export function SessionCard({ concept, subject, status, onClick, cta = 'Start' }: SessionCardProps) {
  const st = STATUS_MAP[status] ?? STATUS_MAP.UPCOMING
  return (
    <Card pad={14} onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 7 }}>
          <SubjectChip subject={subject} size="sm" />
          <span style={{
            display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 8px',
            borderRadius: 99, fontSize: 11, fontWeight: 600,
            background: st.bg, color: st.color, whiteSpace: 'nowrap',
          }}>
            {st.label}
          </span>
        </div>
        <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.3, color: 'var(--text)' }}>
          {concept}
        </div>
      </div>
      {status === 'COMPLETED' ? (
        <div style={{ color: 'var(--tier-strong)', fontSize: 13, fontWeight: 600 }}>Done</div>
      ) : (
        <div style={{ color: status === 'IN_PROGRESS' ? 'var(--primary)' : 'var(--text-faint)', fontSize: 13, fontWeight: 600 }}>
          {cta} &rsaquo;
        </div>
      )}
    </Card>
  )
}
