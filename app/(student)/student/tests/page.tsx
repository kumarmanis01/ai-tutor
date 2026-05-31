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

const ROOT_STYLE: React.CSSProperties = {
  background: 'var(--bg)',
  minHeight: '100vh',
  maxWidth: 390,
  margin: '0 auto',
  position: 'relative',
  paddingBottom: 100,
}

function TestCard({ t, onStart, locked }: { t: TestItem; onStart: () => void; locked?: boolean }) {
  return (
    <Card pad={14} onClick={locked ? undefined : onStart}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <SubjectChip subject={t.subject} size="sm" />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>📄 {t.questionCount} Q</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>⏱ {t.durationMinutes} min</span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3, marginBottom: 4, color: 'var(--text)' }}>{t.title}</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: locked ? 0 : 14 }}>{t.reason ?? t.date}</div>
      {!locked ? (
        <Btn size="sm" full onClick={onStart}>Start test</Btn>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 12, color: 'var(--text-faint)', fontSize: 12.5, fontWeight: 600 }}>
          🔒 {t.date}
        </div>
      )}
    </Card>
  )
}

function TestHistoryCard({ t, onView }: { t: TestItem; onView: () => void }) {
  if (!t.tier || t.bestScore === undefined) return null
  return (
    <Card pad={14} onClick={onView} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
      <Ring tier={t.tier} size={50} stroke={5}>
        <Mono style={{ fontSize: 12, fontWeight: 700 }}>{t.bestScore}%</Mono>
      </Ring>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ marginBottom: 5 }}><SubjectChip subject={t.subject} size="sm" /></div>
        <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, color: 'var(--text)' }}>{t.title}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 3 }}>
          +{t.xpEarned ?? 0} XP · {t.date}
        </div>
      </div>
      <span style={{ color: 'var(--text-faint)' }}>›</span>
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
    <div style={{ ...ROOT_STYLE, paddingBottom: 0, display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ padding: '8px 16px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <button
            onClick={() => router.push('/student/tests')}
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text)', minWidth: 44, minHeight: 44 }}
          >
            ✕
          </button>
          <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{test.title}</div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 30, padding: '0 11px', borderRadius: 99, background: time < 120 ? 'var(--tier-critical-soft)' : 'var(--surface-2)', color: time < 120 ? 'var(--tier-critical)' : 'var(--text)', border: '1px solid var(--border)' }}>
            ⏱ <Mono style={{ fontSize: 13, fontWeight: 600 }}>{mm}:{ss}</Mono>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bar value={qi + 1} max={questions.length} h={5} />
          <Mono style={{ fontSize: 11, color: 'var(--text-faint)' }}>{qi + 1}/{questions.length}</Mono>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Question {qi + 1}</div>
        <h2 style={{ margin: '0 0 26px', fontSize: 20, fontWeight: 700, lineHeight: 1.35, letterSpacing: '-0.02em', color: 'var(--text)' }}>{cur.q}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {cur.options.map((opt, i) => {
            const on = picked === i
            return (
              <button key={i} onClick={() => setPicked(i)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '15px 18px', borderRadius: 16, cursor: 'pointer', textAlign: 'left', background: on ? 'var(--primary-soft)' : 'var(--surface)', border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border)'}`, minHeight: 44 }}>
                <div style={{ width: 28, height: 28, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12.5, background: on ? 'var(--primary)' : 'var(--surface-2)', color: on ? 'var(--on-brand)' : 'var(--text-muted)' }}>
                  {String.fromCharCode(65 + i)}
                </div>
                <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>{opt}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div style={{ padding: '12px 24px 28px' }}>
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
    <div style={{ ...ROOT_STYLE, overflow: 'auto' }}>
      <div style={{ padding: 24 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ position: 'relative', width: 130, height: 130, margin: '0 auto 16px' }}>
            <Ring tier={tier} size={130} stroke={10}>
              <div style={{ textAlign: 'center' }}>
                <Mono style={{ fontSize: 34, fontWeight: 700, color: 'var(--text)' }}>{score}<span style={{ fontSize: 18, color: 'var(--text-faint)' }}>%</span></Mono>
              </div>
            </Ring>
          </div>
          <h1 style={{ margin: '0 0 6px', fontSize: 23, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)' }}>
            {score >= 70 ? 'Solid work!' : 'Good effort!'}
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>
            <TierPill tier={tier} size="sm" />
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
          <Card pad={14} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ color: 'var(--primary)', marginBottom: 4, fontSize: 22 }}>⚡</div>
            <Mono style={{ fontSize: 22, fontWeight: 700 }}>+{Math.round(score * 1.5)}</Mono>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>XP earned</div>
          </Card>
          <Card pad={14} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ color: 'var(--tier-strong)', marginBottom: 4, fontSize: 22 }}>🎯</div>
            <Mono style={{ fontSize: 22, fontWeight: 700 }}>{score}%</Mono>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>accuracy</div>
          </Card>
        </div>
        <Btn full size="lg" onClick={onPractice}>Practice weak areas with Vidya</Btn>
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', minHeight: 44 }}>
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
      <div style={ROOT_STYLE}>
        <div style={{ padding: '14px 20px 18px' }}><div style={{ height: 24, width: 140, borderRadius: 8, background: 'var(--skeleton-base)' }} /></div>
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
        <BottomNav active="tests" onChange={t => router.push(`/student/${t === 'home' ? 'dashboard' : t}`)} />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ ...ROOT_STYLE, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100vh', paddingBottom: 80 }}>
        <ErrorState body={error} onRetry={() => {}} />
        <BottomNav active="tests" onChange={t => router.push(`/student/${t === 'home' ? 'dashboard' : t}`)} />
      </div>
    )
  }

  return (
    <div style={ROOT_STYLE}>
      <div style={{ padding: '8px 16px 12px' }}>
        <AppHeader title="Tests and Mocks" large />
      </div>

      {/* Freemium gate notice */}
      {!isPremium && (
        <div style={{ padding: '0 16px 14px' }}>
          <div style={{ padding: '10px 14px', borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16 }}>📋</span>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Free plan: {testsUsed}/{FREE_TIER_CHAPTER_TEST_LIMIT} chapter test used.{' '}
              </span>
              <button onClick={() => router.push('/student/upgrade')} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', padding: 0, fontSize: 13 }}>
                Upgrade for unlimited
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mock exam hero */}
      <div style={{ padding: '0 16px 14px' }}>
        <div
          onClick={() => {
            const mockTest: TestItem = { id: 'mock1', title: 'CBSE Class 10 - Maths Mock', subject: 'math', type: 'mock', questionCount: 30, durationMinutes: 60, isLocked: false }
            setActiveTest(mockTest)
            setMode('running')
          }}
          style={{ cursor: 'pointer', borderRadius: 20, padding: 18, background: 'linear-gradient(135deg, var(--primary), oklch(0.3 0.2 270))', color: '#fff', position: 'relative', overflow: 'hidden' }}
        >
          <div style={{ position: 'absolute', right: -20, top: -20, opacity: 0.15, fontSize: 120 }}>📋</div>
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: 99, marginBottom: 10 }}>
              📋 Full mock
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>CBSE Class 10 - Maths Mock</div>
            <div style={{ fontSize: 13, opacity: 0.88, marginBottom: 14 }}>Section-based · 80 marks · 3 hours</div>
            <Btn variant="secondary" onClick={() => {}} style={{ background: '#fff', color: 'var(--primary)', border: 'none' }}>Start mock exam</Btn>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding: '0 16px 12px' }}>
        <Segmented
          full
          options={[{ id: 'recommended', label: 'Recommended' }, { id: 'upcoming', label: 'Upcoming' }, { id: 'history', label: 'History' }]}
          value={tab}
          onChange={setTab}
        />
      </div>

      <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
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
