'use client'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppHeader, BottomNav, Card, Btn, EmptyState, ErrorState, SkeletonCard, TierPill, SectionTitle, Ring, Bar, Segmented, SubjectChip, Mono } from '@/components/ui'
import { FREE_TIER_CHAPTER_TEST_LIMIT } from '@/lib/constants/freemium'
import type { TierKey } from '@/lib/constants/tiers'
import type { SubjectKey } from '@/lib/constants/subjects'

interface TestItem {
  id: string
  title: string
  subject: SubjectKey
  type: 'chapter' | 'mock'
  questionCount: number
  durationMinutes: number
  isLocked: boolean
  bestScore?: number
  reason?: string
  date?: string
  tier?: TierKey
  xpEarned?: number
}

interface TestsProps {
  tests?: TestItem[]
  testsUsed?: number
  isPremium?: boolean
  isLoading?: boolean
  error?: string | null
}

type Mode = 'list' | 'running' | 'results'

function TestCard({ t, onStart, locked }: { t: TestItem; onStart: () => void; locked?: boolean }) {
  return (
    <Card pad={14} onClick={locked ? undefined : onStart}>
      <div className="flex gap-[6px] mb-2">
        <SubjectChip subject={t.subject} size="sm" />
        <span className="inline-flex items-center gap-1 text-[11.5px] text-[var(--text-muted)] font-semibold">📄 {t.questionCount} Q</span>
        <span className="inline-flex items-center gap-1 text-[11.5px] text-[var(--text-muted)] font-semibold">⏱ {t.durationMinutes} min</span>
      </div>
      <div className="text-[15px] font-bold leading-[1.3] mb-1 text-[var(--text)]">{t.title}</div>
      <div className={['text-[12.5px] text-[var(--text-muted)]', locked ? '' : 'mb-[14px]'].join(' ')}>{t.reason ?? t.date}</div>
      {!locked ? (
        <Btn size="sm" full onClick={onStart}>Start test</Btn>
      ) : (
        <div className="flex items-center gap-[7px] mt-3 text-[var(--text-faint)] text-[12.5px] font-semibold">
          🔒 {t.date}
        </div>
      )}
    </Card>
  )
}

function TestHistoryCard({ t, onView }: { t: TestItem; onView: () => void }) {
  if (!t.tier || t.bestScore === undefined) return null
  return (
    <Card pad={14} onClick={onView} className="flex items-center gap-3 cursor-pointer">
      <Ring tier={t.tier} size={50} stroke={5}>
        <Mono className="text-[12px] font-bold">{t.bestScore}%</Mono>
      </Ring>
      <div className="flex-1 min-w-0">
        <div className="mb-[5px]"><SubjectChip subject={t.subject} size="sm" /></div>
        <div className="text-[14px] font-semibold leading-[1.3] text-[var(--text)]">{t.title}</div>
        <div className="text-[11.5px] text-[var(--text-faint)] mt-[3px]">
          +{t.xpEarned ?? 0} XP · {t.date}
        </div>
      </div>
      <span className="text-[var(--text-faint)]">›</span>
    </Card>
  )
}

// Test runner
function TestRunner({ test, onDone }: { test: TestItem; onDone: (score: number) => void }) {
  const router = useRouter()
  const questions = [
    { q: 'What is the value of x in: 2x + 4 = 10?', options: ['2', '3', '7', '4'], correct: 1 },
    { q: 'Which of the following is a quadratic equation?', options: ['x + 2 = 0', 'x² + 2x = 0', '2x = 4', 'x/2 = 1'], correct: 1 },
    { q: 'The discriminant of x² - 5x + 6 = 0 is:', options: ['1', '25', '-24', 'positive'], correct: 0 },
  ]
  const [qi, setQi] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [answers, setAnswers] = useState<(number | null)[]>([])
  const [time, setTime] = useState(test.durationMinutes * 60)

  useEffect(() => {
    const t = setInterval(() => setTime(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [])

  const cur = questions[qi]
  const mm = String(Math.floor(time / 60)).padStart(2, '0')
  const ss = String(time % 60).padStart(2, '0')

  const submit = () => {
    const updated = [...answers, picked]
    setAnswers(updated)
    setPicked(null)
    if (qi < questions.length - 1) {
      setQi(qi + 1)
    } else {
      const correct = updated.filter((a, i) => a === questions[i].correct).length
      onDone(Math.round((correct / questions.length) * 100))
    }
  }

  return (
    <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto relative flex flex-col h-screen pb-0">
      <div className="px-4 pt-2 pb-3 bg-[var(--surface)] border-b border-[var(--border)]">
        <div className="flex items-center gap-[10px] mb-[10px]">
          <button
            onClick={() => router.push('/student/tests')}
            className="bg-[var(--surface-2)] border border-[var(--border)] w-[34px] h-[34px] rounded-[10px] flex items-center justify-center cursor-pointer text-[var(--text)] min-w-[44px] min-h-[44px]"
          >
            ✕
          </button>
          <div className="flex-1 text-[14px] font-bold text-[var(--text)]">{test.title}</div>
          <span className={[
            'inline-flex items-center gap-[5px] h-[30px] px-[11px] rounded-full border border-[var(--border)]',
            time < 120 ? 'bg-[var(--tier-critical-soft)] text-[var(--tier-critical)]' : 'bg-[var(--surface-2)] text-[var(--text)]',
          ].join(' ')}>
            ⏱ <Mono className="text-[13px] font-semibold">{mm}:{ss}</Mono>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Bar value={qi + 1} max={questions.length} h={5} />
          <Mono className="text-[11px] text-[var(--text-faint)]">{qi + 1}/{questions.length}</Mono>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <div className="text-[12px] font-bold text-[var(--text-faint)] uppercase tracking-[0.05em] mb-3">Question {qi + 1}</div>
        <h2 className="m-0 mb-[26px] text-[20px] font-bold leading-[1.35] tracking-[-0.02em] text-[var(--text)]">{cur.q}</h2>
        <div className="flex flex-col gap-3">
          {cur.options.map((opt, i) => {
            const on = picked === i
            return (
              <button
                key={i}
                onClick={() => setPicked(i)}
                className={[
                  'flex items-center gap-[14px] px-[18px] py-[15px] rounded-2xl cursor-pointer text-left min-h-[44px]',
                  on ? 'bg-[var(--primary-soft)] border-[1.5px] border-[var(--primary)]' : 'bg-[var(--surface)] border-[1.5px] border-[var(--border)]',
                ].join(' ')}
              >
                <div className={[
                  'w-7 h-7 rounded-[9px] shrink-0 flex items-center justify-center [font-family:var(--font-mono)] font-bold text-[12.5px]',
                  on ? 'bg-[var(--primary)] text-[var(--on-brand)]' : 'bg-[var(--surface-2)] text-[var(--text-muted)]',
                ].join(' ')}>
                  {String.fromCharCode(65 + i)}
                </div>
                <span className="text-[15px] font-medium text-[var(--text)]">{opt}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="px-6 pt-3 pb-7">
        <Btn full size="lg" disabled={picked === null} onClick={submit}>
          {qi < questions.length - 1 ? 'Next' : 'Submit test'}
        </Btn>
      </div>
    </div>
  )
}

// Results screen
function TestResults({ score, onBack, onPractice }: { score: number; onBack: () => void; onPractice: () => void }) {
  const tier: TierKey = score >= 80 ? 'strong' : score >= 60 ? 'ontrack' : score >= 40 ? 'fair' : 'weak'
  return (
    <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto relative pb-[100px] overflow-auto">
      <div className="p-6">
        <div className="text-center mb-6">
          <div className="relative w-[130px] h-[130px] mx-auto mb-4">
            <Ring tier={tier} size={130} stroke={10}>
              <div className="text-center">
                <Mono className="text-[34px] font-bold text-[var(--text)]">{score}<span className="text-[18px] text-[var(--text-faint)]">%</span></Mono>
              </div>
            </Ring>
          </div>
          <h1 className="m-0 mb-[6px] text-[23px] font-extrabold tracking-[-0.03em] text-[var(--text)]">
            {score >= 70 ? 'Solid work!' : 'Good effort!'}
          </h1>
          <p className="m-0 text-[14px] text-[var(--text-muted)]">
            <TierPill tier={tier} size="sm" />
          </p>
        </div>
        <div className="flex gap-3 mb-[18px]">
          <Card pad={14} className="flex-1 text-center">
            <div className="text-[var(--primary)] mb-1 text-[22px]">⚡</div>
            <Mono className="text-[22px] font-bold">+{Math.round(score * 1.5)}</Mono>
            <div className="text-[11.5px] text-[var(--text-muted)] font-semibold">XP earned</div>
          </Card>
          <Card pad={14} className="flex-1 text-center">
            <div className="text-[var(--tier-strong)] mb-1 text-[22px]">🎯</div>
            <Mono className="text-[22px] font-bold">{score}%</Mono>
            <div className="text-[11.5px] text-[var(--text-muted)] font-semibold">accuracy</div>
          </Card>
        </div>
        <Btn full size="lg" onClick={onPractice}>Practice weak areas with Vidya</Btn>
        <div className="text-center mt-3">
          <button onClick={onBack} className="bg-transparent border-0 text-[var(--text-muted)] text-[13px] font-semibold cursor-pointer [font-family:var(--font-sans)] min-h-[44px]">
            Back to tests
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TestsPage(_props: TestsProps) {
  const router = useRouter()
  const [tab, setTab] = useState('recommended')
  const [mode, setMode] = useState<Mode>('list')
  const [activeTest, setActiveTest] = useState<TestItem | null>(null)
  const [testScore, setTestScore] = useState(0)
  const [isLoading] = useState(false)
  const [error] = useState<string | null>(null)

  // Demo data
  const isPremium = false
  const testsUsed = 1

  const recommendedTests: TestItem[] = [
    { id: 'c1', title: 'Quadratic Equations - Chapter Test', subject: 'math', type: 'chapter', questionCount: 15, durationMinutes: 20, isLocked: false, reason: 'Based on your recent progress' },
    { id: 'c2', title: 'Photosynthesis - Quick Quiz', subject: 'science', type: 'chapter', questionCount: 10, durationMinutes: 10, isLocked: !isPremium && testsUsed >= FREE_TIER_CHAPTER_TEST_LIMIT, reason: 'Strengthen your understanding' },
  ]
  const upcomingTests: TestItem[] = [
    { id: 'u1', title: 'Polynomials - Chapter Test', subject: 'math', type: 'chapter', questionCount: 12, durationMinutes: 15, isLocked: true, date: 'Unlocks in 3 days' },
  ]
  const historyTests: TestItem[] = [
    { id: 'h1', title: 'Linear Equations', subject: 'math', type: 'chapter', questionCount: 10, durationMinutes: 12, isLocked: false, bestScore: 73, tier: 'ontrack', xpEarned: 150, date: '2 days ago' },
  ]

  if (mode === 'running' && activeTest) {
    return <TestRunner test={activeTest} onDone={score => { setTestScore(score); setMode('results') }} />
  }

  if (mode === 'results') {
    return (
      <TestResults
        score={testScore}
        onBack={() => setMode('list')}
        onPractice={() => router.push('/student/tutor')}
      />
    )
  }

  if (isLoading) {
    return (
      <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto relative pb-[100px]">
        <div className="px-5 pt-[14px] pb-[18px]"><div className="h-6 w-[140px] rounded-lg bg-[var(--skeleton-base)]" /></div>
        <div className="px-4 flex flex-col gap-3">
          {[0, 1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
        <BottomNav active="tests" onChange={t => router.push(`/student/${t === 'home' ? 'dashboard' : t}`)} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto relative flex flex-col justify-center pb-20">
        <ErrorState body={error} onRetry={() => {}} />
        <BottomNav active="tests" onChange={t => router.push(`/student/${t === 'home' ? 'dashboard' : t}`)} />
      </div>
    )
  }

  return (
    <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto relative pb-[100px]">
      <div className="px-4 pt-2 pb-3">
        <AppHeader title="Tests and Mocks" large />
      </div>

      {/* Freemium gate notice */}
      {!isPremium && (
        <div className="px-4 pt-0 pb-[14px]">
          <div className="p-[10px] px-[14px] rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center gap-[10px]">
            <span className="text-[16px]">📋</span>
            <div className="flex-1">
              <span className="text-[13px] text-[var(--text-muted)]">
                Free plan: {testsUsed}/{FREE_TIER_CHAPTER_TEST_LIMIT} chapter test used.{' '}
              </span>
              <button onClick={() => router.push('/student/upgrade')} className="bg-transparent border-0 text-[var(--primary)] font-bold cursor-pointer [font-family:var(--font-sans)] p-0 text-[13px]">
                Upgrade for unlimited
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mock exam hero */}
      <div className="px-4 pt-0 pb-[14px]">
        <div
          onClick={() => {
            const mockTest: TestItem = { id: 'mock1', title: 'CBSE Class 10 - Maths Mock', subject: 'math', type: 'mock', questionCount: 30, durationMinutes: 60, isLocked: false }
            setActiveTest(mockTest)
            setMode('running')
          }}
          className="cursor-pointer rounded-[20px] p-[18px] [background:linear-gradient(135deg,var(--primary),oklch(0.3_0.2_270))] text-white relative overflow-hidden"
        >
          <div className="absolute right-[-20px] top-[-20px] opacity-[0.15] text-[120px]">📋</div>
          <div className="relative">
            <div className="inline-flex items-center gap-[6px] text-[11px] font-bold uppercase tracking-[0.06em] bg-[rgba(255,255,255,0.2)] px-[10px] py-1 rounded-full mb-[10px]">
              📋 Full mock
            </div>
            <div className="text-[18px] font-extrabold tracking-[-0.02em] mb-1">CBSE Class 10 - Maths Mock</div>
            <div className="text-[13px] opacity-[0.88] mb-[14px]">Section-based · 80 marks · 3 hours</div>
            <Btn variant="secondary" onClick={() => {}}>Start mock exam</Btn>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-0 pb-3">
        <Segmented
          full
          options={[{ id: 'recommended', label: 'Recommended' }, { id: 'upcoming', label: 'Upcoming' }, { id: 'history', label: 'History' }]}
          value={tab}
          onChange={setTab}
        />
      </div>

      <div className="px-4 pt-0 pb-6 flex flex-col gap-[10px]">
        {tab === 'recommended' && recommendedTests.map(t => (
          <TestCard
            key={t.id}
            t={t}
            locked={t.isLocked}
            onStart={() => {
              if (t.isLocked) { router.push('/student/upgrade'); return }
              setActiveTest(t)
              setMode('running')
            }}
          />
        ))}
        {tab === 'upcoming' && (
          upcomingTests.length === 0 ? (
            <EmptyState title="Nothing scheduled" body="Upcoming tests unlock as you progress through your learning path." />
          ) : (
            upcomingTests.map(t => <TestCard key={t.id} t={t} locked onStart={() => {}} />)
          )
        )}
        {tab === 'history' && (
          historyTests.length === 0 ? (
            <EmptyState title="No tests taken yet" body="Complete a test to see your history here." action="Browse tests" onAction={() => setTab('recommended')} />
          ) : (
            historyTests.map(t => <TestHistoryCard key={t.id} t={t} onView={() => { setTestScore(t.bestScore ?? 0); setMode('results') }} />)
          )
        )}
      </div>

      <BottomNav
        active="tests"
        onChange={t => router.push(`/student/${t === 'home' ? 'dashboard' : t}`)}
      />
    </div>
  )
}
