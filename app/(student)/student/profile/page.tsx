'use client'

/**
 * FILE OBJECTIVE:
 * - Student profile page: identity hero, XP/streak/tier stats, academic preferences,
 *   badges sidebar, parent access, display settings, and account danger zone.
 *
 * ARCHITECTURE:
 * - 'use client' — uses useCurrentUser (SWR) + useSession for live data.
 * - No imports from OLD_student/, design-reference/, or OLD_parent/.
 * - All styling via CSS tokens (var(--...)) and components/ui primitives.
 * - No inline styles except Avatar dynamic hue (allowed by constraint).
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/student/profile/page.spec.tsx
 *
 * EDIT LOG:
 * - 2026-06-04 | claude | full rewrite: migrate minimal stub to complete profile page
 *                          using components/ui design system; add XP/streak/badges/
 *                          academic prefs/parent access/danger zone sections.
 */

import React, { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  AppHeader,
  Avatar,
  Btn,
  Card,
  ErrorState,
  Skel,
  SectionTitle,
  TierPill,
} from '@/components/ui'
import LogoutButton from '@/components/Auth/LogoutButton'
import FontSizeToggle from '@/components/UI/FontSizeToggle'
import ParentAccessCard from '@/components/Profile/ParentAccessCard'
import ProfileWidgets from '@/components/ProfileWidgets'
import AuthRedeemOnSignIn from '@/components/AuthRedeemOnSignIn'
import useCurrentUser from '@/hooks/useCurrentUser'
import { extractBadges } from '@/lib/extractBadge'
import { getLevelTierName } from '@/lib/student/xpLevels'
import { LANGUAGES } from '@/components/CascadingFilters'
import type { User } from '@/lib/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMemberSince(val: string | Date | undefined | null): string {
  if (!val) return ''
  try {
    return new Date(val).toLocaleDateString('en-IN', { year: 'numeric', month: 'long' })
  } catch {
    return String(val)
  }
}

function resolveLanguageLabel(code: string | null | undefined): string | null {
  if (!code) return null
  return LANGUAGES.find((l) => l.code === code)?.name ?? code
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div className="bg-[var(--bg)] min-h-screen max-w-[420px] mx-auto pb-8">
      <div className="px-4 pt-2 pb-3"><Skel w={120} h={24} r={8} /></div>
      <div className="px-4 pb-5 flex flex-col items-center gap-3 pt-4">
        <Skel w={76} h={76} r={99} />
        <Skel w={150} h={20} r={8} />
        <Skel w={110} h={14} r={8} />
        <div className="flex gap-2"><Skel w={80} h={24} r={99} /><Skel w={80} h={24} r={99} /></div>
      </div>
      <div className="px-4 flex flex-col gap-3">
        {[1, 2, 3, 4].map((i) => <Skel key={i} h={56} r={14} />)}
      </div>
    </div>
  )
}

// ─── KV row ──────────────────────────────────────────────────────────────────

function KVRow({
  label,
  value,
  fixed,
  last,
}: {
  label: string
  value: React.ReactNode
  fixed?: boolean
  last?: boolean
}) {
  if (!value && value !== 0) return null
  return (
    <div
      className={[
        'flex items-center justify-between px-4 py-[13px] min-h-[44px]',
        !last ? 'border-b border-[var(--border)]' : '',
      ].join(' ')}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-[0.05em] mb-[2px]">
          {label}
        </div>
        <div className="text-[14.5px] font-medium text-[var(--text)] leading-snug">{value}</div>
      </div>
      {fixed && (
        <span className="ml-3 text-[11px] text-[var(--text-faint)] font-semibold shrink-0">Fixed</span>
      )}
    </div>
  )
}

// ─── Stat pill ───────────────────────────────────────────────────────────────

function StatPill({ icon, label }: { icon: string; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold"
      style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </span>
  )
}

// ─── Subject chips ────────────────────────────────────────────────────────────

function SubjectList({ subjects }: { subjects: string[] }) {
  if (subjects.length === 0) return <span className="text-[var(--text-faint)]">—</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      {subjects.map((s) => (
        <span
          key={s}
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11.5px] font-medium"
          style={{ background: 'var(--primary-10, oklch(0.55 0.22 260 / 0.12))', color: 'var(--primary)' }}
        >
          {s}
        </span>
      ))}
    </div>
  )
}

// ─── Deletion dialog ──────────────────────────────────────────────────────────

function DeletionDialog({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const [confirmText, setConfirmText] = useState('')
  const [pending, setPending] = useState(false)

  async function handleDelete() {
    setPending(true)
    try {
      const res = await fetch('/api/student/account/deletion-request', { method: 'POST' })
      if (res.ok) onSuccess()
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4 sm:pb-0">
      <div
        className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <h4 className="text-[16px] font-bold text-[var(--text)] mb-1">This cannot be undone</h4>
        <p className="text-[13px] text-[var(--text-muted)] mb-4">
          Type <strong>DELETE</strong> to confirm permanent account deletion (within 30 days).
        </p>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="DELETE"
          className="w-full px-3 py-2 mb-4 rounded-xl text-[14px] text-[var(--text)]"
          style={{ background: 'var(--bg)', border: '1.5px solid var(--border)' }}
        />
        <div className="flex gap-2">
          <Btn variant="ghost" full onClick={onClose}>Cancel</Btn>
          <Btn
            variant="danger"
            full
            disabled={confirmText !== 'DELETE' || pending}
            onClick={handleDelete}
          >
            {pending ? 'Submitting…' : 'Confirm'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StudentProfilePage() {
  const router = useRouter()
  const { data: session } = useSession()
  const { data: profile, loading, error, mutate } = useCurrentUser()

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deletionDone, setDeletionDone] = useState(false)

  const handleDeletionSuccess = useCallback(() => {
    setShowDeleteDialog(false)
    setDeletionDone(true)
    router.push('/login/student?message=deletion-requested')
  }, [router])

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen text-[var(--text-muted)] text-sm">
        You are not signed in.
      </div>
    )
  }

  if (loading) return <ProfileSkeleton />

  if (error || !profile) {
    return (
      <div className="bg-[var(--bg)] min-h-screen max-w-[420px] mx-auto flex flex-col justify-center px-4">
        <ErrorState body="Could not load your profile." onRetry={() => mutate()} />
      </div>
    )
  }

  // ── Derived display values ─────────────────────────────────────────────────
  const typedProfile = profile as User & {
    resolvedSubjects?: { name: string }[]
    preferences?: { badgeShowcase?: string[] }
  }

  const displayName   = typedProfile.name ?? session.user?.name ?? ''
  const displayEmail  = typedProfile.email ?? session.user?.email ?? ''
  const avatarLetter  = displayName[0]?.toUpperCase() ?? 'S'
  const level         = typedProfile.level ?? 1
  const tierName      = getLevelTierName(level)
  const currentStreak = typedProfile.currentStreak ?? 0
  const longestStreak = typedProfile.longestStreak ?? 0
  const totalXp       = typedProfile.totalXp ?? 0
  const isAdmin       = (typedProfile as any).role === 'admin' || (session.user as any)?.role === 'admin'

  const subjectDisplay: string[] =
    typedProfile.resolvedSubjects && typedProfile.resolvedSubjects.length > 0
      ? typedProfile.resolvedSubjects.map((s) => s.name)
      : (typedProfile.subjects ?? [])

  const languageLabel = resolveLanguageLabel(typedProfile.language)
  const badges        = extractBadges(typedProfile)
  const memberSince   = formatMemberSince(typedProfile.createdAt)

  return (
    <div className="bg-[var(--bg)] min-h-screen max-w-[420px] mx-auto pb-10">
      <AuthRedeemOnSignIn />

      {/* Header */}
      <div className="px-4 pt-2 pb-3">
        <AppHeader title="Profile" back onBack={() => router.push('/student/dashboard')} />
      </div>

      {/* ── Identity hero ── */}
      <div className="px-4 pb-5 flex flex-col items-center gap-3 text-center">
        {/* Avatar: dynamic hue allowed per constraint */}
        <Avatar letter={avatarLetter} hue={240} size={76} ring />

        <div>
          <h1 className="text-[21px] font-extrabold tracking-[-0.02em] text-[var(--text)] leading-tight">
            {displayName}
          </h1>
          <p className="text-[12.5px] text-[var(--text-muted)] mt-0.5">{displayEmail}</p>
          {memberSince && (
            <p className="text-[11px] text-[var(--text-faint)] mt-0.5">Member since {memberSince}</p>
          )}
        </div>

        {/* Grade + Board chips */}
        <div className="flex flex-wrap justify-center gap-2">
          {typedProfile.grade && (
            <span
              className="inline-flex items-center h-[24px] px-[10px] rounded-full text-[11.5px] font-semibold"
              style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
            >
              Class {typedProfile.grade}
            </span>
          )}
          {typedProfile.board && (
            <span
              className="inline-flex items-center h-[24px] px-[10px] rounded-full text-[11.5px] font-semibold"
              style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
            >
              {typedProfile.board}
            </span>
          )}
          {/* XP tier */}
          <TierPill
            tier={
              level >= 30 ? 'strong'
              : level >= 20 ? 'ontrack'
              : level >= 10 ? 'fair'
              : level >= 3  ? 'weak'
              : 'critical'
            }
            size="sm"
          />
        </div>

        {/* Stat pills */}
        <div className="flex flex-wrap justify-center gap-2">
          <StatPill icon="🔥" label={`${currentStreak}d streak · best ${longestStreak}d`} />
          <StatPill icon="⚡" label={`Lv ${level} · ${tierName}`} />
          <StatPill icon="✨" label={`${totalXp.toLocaleString()} XP`} />
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="px-4 flex flex-col gap-2 mb-5">
        <Btn variant="primary" full onClick={() => router.push('/student/onboarding?edit=1')}>
          ✏️  Edit profile
        </Btn>
        {isAdmin && (
          <Btn variant="secondary" full onClick={() => router.push('/admin')}>
            Admin panel
          </Btn>
        )}
      </div>

      {/* ── Academic preferences ── */}
      <SectionTitle>Academic</SectionTitle>
      <Card pad={0} className="mx-4 overflow-hidden mb-4">
        <KVRow label="Grade"    value={typedProfile.grade ? `Class ${typedProfile.grade}` : null} fixed />
        <KVRow label="Board"    value={typedProfile.board} fixed />
        <KVRow label="Language" value={languageLabel} />
        <KVRow label="Subjects" value={subjectDisplay.length > 0 ? <SubjectList subjects={subjectDisplay} /> : null} />
        <KVRow label="Country"  value={typedProfile.country ?? null} last />
      </Card>

      {/* ── Account & plan ── */}
      <SectionTitle>Account</SectionTitle>
      <Card pad={0} className="mx-4 overflow-hidden mb-4">
        <KVRow label="Plan"          value={typedProfile.plan} />
        <KVRow label="Billing cycle" value={(typedProfile as any).billingCycle ?? null} />
        <KVRow label="Parent email"  value={typedProfile.parentEmail ?? null} last />
      </Card>

      {/* Manage subscription */}
      <div className="px-4 mb-5">
        <Btn variant="outline" full onClick={() => router.push('/student/upgrade')}>
          Manage subscription
        </Btn>
      </div>

      {/* ── Badges sidebar (inline on mobile) ── */}
      {badges.length > 0 && (
        <>
          <SectionTitle>Badges</SectionTitle>
          <div className="px-4 mb-5">
            <ProfileWidgets badges={badges} showLeaderboard={false} showChallenge={false} />
          </div>
        </>
      )}

      {/* ── Parent access ── */}
      <SectionTitle>Parent access</SectionTitle>
      <div className="px-4 mb-5">
        <ParentAccessCard />
      </div>

      {/* ── Display & accessibility ── */}
      <SectionTitle>Display</SectionTitle>
      <Card pad={0} className="mx-4 overflow-hidden mb-5">
        <div className="flex items-center justify-between px-4 py-[13px] min-h-[44px]">
          <div>
            <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-[0.05em] mb-[2px]">
              Font size
            </div>
            <div className="text-[13px] text-[var(--text-muted)]">Adjust text size across the app</div>
          </div>
          <FontSizeToggle />
        </div>
      </Card>

      {/* ── Sign out ── */}
      <div className="px-4 mb-5">
        <LogoutButton />
      </div>

      {/* ── Danger zone ── */}
      <SectionTitle>Privacy &amp; data</SectionTitle>
      <div className="px-4 mb-6">
        {deletionDone ? (
          <p className="text-[13px] text-[var(--text-muted)] text-center py-2">
            Deletion request submitted. Your data will be removed within 30 days.
          </p>
        ) : (
          <Btn variant="danger" full onClick={() => setShowDeleteDialog(true)}>
            Request account deletion
          </Btn>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="text-center text-[11px] text-[var(--text-faint)] [font-family:var(--font-mono)]">
        Spinzy Academy · v1.0.0
      </div>

      {/* ── Deletion dialog ── */}
      {showDeleteDialog && (
        <DeletionDialog
          onClose={() => setShowDeleteDialog(false)}
          onSuccess={handleDeletionSuccess}
        />
      )}
    </div>
  )
}
