'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { AppHeader, Card, Btn, ErrorState, Skel, Avatar, SectionTitle } from '@/components/ui'

// --- Types ---

interface StudentProfileData {
  id: string
  name: string
  email: string
  grade: string | null   // immutable after first save
  board: string | null   // immutable after first save
  language: string
  learningStyle: string | null
  plan: string
}

// --- Loading skeleton ---

function ProfileLoading() {
  return (
    <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto pb-8">
      <div className="px-4 pt-2 pb-3"><Skel w={120} h={24} r={8} /></div>
      <div className="px-4 pb-5 flex flex-col items-center gap-3 pt-4">
        <Skel w={72} h={72} r={99} />
        <Skel w={140} h={20} r={8} />
        <Skel w={100} h={14} r={8} />
      </div>
      <div className="px-4 flex flex-col gap-3">
        <Skel h={56} r={14} />
        <Skel h={56} r={14} />
        <Skel h={56} r={14} />
        <Skel h={56} r={14} />
      </div>
    </div>
  )
}

// --- Row components ---

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-[14px] border-b border-[var(--border)] last:border-b-0 min-h-[44px]">
      <div>
        <div className="text-[11.5px] font-bold text-[var(--text-muted)] uppercase tracking-[0.04em] mb-[2px]">{label}</div>
        <div className="text-[15px] font-medium text-[var(--text)]">{value || '--'}</div>
      </div>
    </div>
  )
}

function ImmutableRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-[14px] border-b border-[var(--border)] last:border-b-0 min-h-[44px]">
      <div>
        <div className="text-[11.5px] font-bold text-[var(--text-muted)] uppercase tracking-[0.04em] mb-[2px]">{label}</div>
        <div className="text-[15px] font-medium text-[var(--text)]">{value || '--'}</div>
      </div>
      <span className="text-[11px] text-[var(--text-faint)] font-semibold">Fixed</span>
    </div>
  )
}

// --- Page ---

export default function StudentProfilePage() {
  const router = useRouter()
  const [data, setData] = useState<StudentProfileData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProfile = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/user/profile')
      if (!res.ok) throw new Error('Failed to load profile')
      const json = await res.json() as StudentProfileData
      setData(json)
    } catch {
      setError('Could not load your profile. Tap to retry.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  if (isLoading) return <ProfileLoading />

  if (error || !data) {
    return (
      <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto flex flex-col justify-center">
        <ErrorState body={error ?? 'Something went wrong.'} onRetry={fetchProfile} />
      </div>
    )
  }

  const initials = data.name?.[0]?.toUpperCase() ?? 'S'

  return (
    <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto pb-8">
      <div className="px-4 pt-2 pb-3">
        <AppHeader title="Profile" back onBack={() => router.push('/student/dashboard')} />
      </div>

      {/* Identity hero */}
      <div className="flex flex-col items-center gap-[10px] px-4 pb-5">
        <Avatar letter={initials} hue={240} size={72} />
        <div className="text-[20px] font-extrabold tracking-[-0.02em] text-[var(--text)]">{data.name}</div>
        <div className="flex items-center gap-2">
          {data.grade && (
            <span className="inline-flex items-center h-[24px] px-[10px] rounded-full bg-[var(--surface-2)] text-[11.5px] font-semibold text-[var(--text-muted)]">
              Class {data.grade}
            </span>
          )}
          {data.board && (
            <span className="inline-flex items-center h-[24px] px-[10px] rounded-full bg-[var(--surface-2)] text-[11.5px] font-semibold text-[var(--text-muted)]">
              {data.board}
            </span>
          )}
        </div>
      </div>

      {/* Contact */}
      <SectionTitle>Contact</SectionTitle>
      <Card pad={0} className="mx-4 overflow-hidden mb-4">
        <InfoRow label="Name" value={data.name} />
        <InfoRow label="Email" value={data.email} />
      </Card>

      {/* Academic (immutable) */}
      <SectionTitle>Academic</SectionTitle>
      <Card pad={0} className="mx-4 overflow-hidden mb-4">
        {/* grade/board immutable after first save -- strip from all PATCH handlers */}
        {data.grade && <ImmutableRow label="Grade" value={`Class ${data.grade}`} />}
        {data.board && <ImmutableRow label="Board" value={data.board} />}
        <InfoRow label="Language" value={data.language} />
        {data.learningStyle && <InfoRow label="Learning style" value={data.learningStyle} />}
      </Card>

      {/* Account actions */}
      <div className="px-4 flex flex-col gap-3">
        <Btn variant="secondary" full onClick={() => router.push('/student/upgrade')}>
          Manage subscription
        </Btn>
        <Btn variant="danger" full onClick={() => signOut({ callbackUrl: '/login/student' })}>
          Sign out
        </Btn>
      </div>

      <div className="text-center mt-6 text-[11px] text-[var(--text-faint)] [font-family:var(--font-mono)]">
        Spinzy Academy · v1.0.0
      </div>
    </div>
  )
}
