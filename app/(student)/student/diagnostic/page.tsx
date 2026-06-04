'use client'
import React, { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Btn, ErrorState } from '@/components/ui'
import DiagnosticFlow from '@/components/student/diagnostic/DiagnosticFlow'

interface ResolvedSubject {
  id: string
  name: string
  slug: string
}

interface ProfileResponse {
  board: string | null
  grade: string | null
  resolvedSubjects?: ResolvedSubject[]
}

type Phase = 'loading' | 'picker' | 'running' | 'no-subjects' | 'error'

function DiagnosticPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const subjectIdFromQuery = searchParams.get('subjectId') ?? ''
  const [phase, setPhase] = useState<Phase>('loading')
  const [profile, setProfile] = useState<ProfileResponse | null>(null)
  const [picked, setPicked] = useState<ResolvedSubject | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/user/profile')
        if (!res.ok) throw new Error('Failed to load profile')
        const json = (await res.json()) as ProfileResponse
        if (cancelled) return
        setProfile(json)
        const subjects = json.resolvedSubjects ?? []
        if (subjects.length === 0) {
          setPhase('no-subjects')
          return
        }
        if (subjectIdFromQuery) {
          const match = subjects.find((s) => s.id === subjectIdFromQuery)
          if (match) {
            setPicked(match)
            setPhase('running')
            return
          }
        }
        if (subjects.length === 1) {
          setPicked(subjects[0])
          setPhase('running')
          return
        }
        setPhase('picker')
      } catch {
        if (!cancelled) {
          setErrorMsg('Could not load your subjects. Tap to retry.')
          setPhase('error')
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [subjectIdFromQuery])

  if (phase === 'loading') {
    return (
      <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto p-6 flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-full border-[3px] border-[var(--border)] border-t-[var(--primary)] [animation:spz-spin_0.8s_linear_infinite]" />
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto p-4">
        <ErrorState title="Could not load diagnostic" body={errorMsg ?? 'Please try again.'} onRetry={() => setPhase('loading')} />
      </div>
    )
  }

  if (phase === 'no-subjects') {
    return (
      <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto p-6 flex flex-col items-center justify-center text-center gap-3">
        <div className="text-[20px] font-extrabold text-[var(--text)]">No subjects set yet</div>
        <p className="text-[14px] text-[var(--text-muted)] m-0">
          Finish onboarding to pick your subjects, then come back here.
        </p>
        <Btn onClick={() => router.push('/student/onboarding')}>Go to onboarding</Btn>
      </div>
    )
  }

  if (phase === 'picker') {
    const subjects = profile?.resolvedSubjects ?? []
    return (
      <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto px-6 pt-8 pb-6">
        <h1 className="text-[24px] font-extrabold tracking-[-0.03em] text-[var(--text)] mb-2">Pick a subject</h1>
        <p className="text-[14px] text-[var(--text-muted)] mb-5">
          We'll calibrate your starting level with a short, adaptive quiz.
        </p>
        <div className="flex flex-col gap-[10px]">
          {subjects.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setPicked(s)
                setPhase('running')
              }}
              className="flex items-center gap-3 p-4 rounded-[14px] cursor-pointer text-left min-h-[44px] bg-[var(--surface)] border-[1.5px] border-[var(--border)] hover:border-[var(--primary)] transition-colors"
            >
              <span className="flex-1 font-semibold text-[15px] text-[var(--text)]">{s.name}</span>
              <span className="text-[var(--text-muted)] text-[18px]">›</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // phase === 'running'
  if (!picked || !profile) {
    return null
  }

  return (
    <DiagnosticFlow
      subjectId={picked.id}
      subjectName={picked.name}
      questions={[]}
      initialAnswers={[]}
      initialIndex={0}
      boardSlug={profile.board ?? ''}
      grade={profile.grade ?? ''}
      subjectSlug={picked.slug}
      afterResultsPath="/student/dashboard"
    />
  )
}

const spinnerFallback = (
  <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto p-6 flex flex-col items-center justify-center">
    <div className="w-12 h-12 rounded-full border-[3px] border-[var(--border)] border-t-[var(--primary)] [animation:spz-spin_0.8s_linear_infinite]" />
  </div>
)

export default function DiagnosticPage() {
  return <Suspense fallback={spinnerFallback}><DiagnosticPageContent /></Suspense>
}
