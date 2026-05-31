'use client'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Btn, Bar, Card, Ring, TierPill, SubjectChip, ErrorState } from '@/components/ui'
import type { TierKey } from '@/lib/constants/tiers'
import type { SubjectKey } from '@/lib/constants/subjects'

interface DiagnosticQuestion {
  id: string
  subject: SubjectKey
  text: string
  options: string[]
  correctIndex: number
}

interface DiagnosticProps {
  questions?: DiagnosticQuestion[]
  currentIndex?: number
  onAnswer?: (questionId: string, answerIndex: number) => void
  onComplete?: () => void
  isLoading?: boolean
  error?: string | null
}

type Phase = 'intro' | 'running' | 'generating' | 'results' | 'error'

const GENERATING_STAGES = [
  'Reviewing your answers',
  'Mapping concept gaps',
  'Calibrating difficulty',
  'Building your learning path',
  'Almost ready',
]

const ROOT_STYLE: React.CSSProperties = {
  background: 'var(--bg)',
  minHeight: '100vh',
  maxWidth: 390,
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
}

export default function DiagnosticPage(_props: DiagnosticProps) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('intro')
  const [qi, setQi] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [answers, setAnswers] = useState<(number | null)[]>([])
  const [genPct, setGenPct] = useState(0)

  // Demo questions -- in production these come from API
  const questions: DiagnosticQuestion[] = [
    {
      id: 'q1', subject: 'math',
      text: 'What is the discriminant of a quadratic equation ax² + bx + c = 0?',
      options: ['b² - 4ac', 'b² + 4ac', '-b² + 4ac', '4ac - b²'],
      correctIndex: 0,
    },
    {
      id: 'q2', subject: 'science',
      text: 'Which gas is produced during photosynthesis?',
      options: ['Carbon dioxide', 'Oxygen', 'Nitrogen', 'Hydrogen'],
      correctIndex: 1,
    },
    {
      id: 'q3', subject: 'math',
      text: 'If x + 3 = 7, what is x?',
      options: ['2', '3', '4', '10'],
      correctIndex: 2,
    },
  ]
  const totalQ = questions.length

  // Generation progress animation
  useEffect(() => {
    if (phase !== 'generating') return
    setGenPct(0)
    const steps = [18, 42, 67, 88, 100]
    let i = 0
    const t = setInterval(() => {
      setGenPct(steps[i])
      i++
      if (i >= steps.length) {
        clearInterval(t)
        setTimeout(() => setPhase('results'), 700)
      }
    }, 650)
    return () => clearInterval(t)
  }, [phase])

  const submit = () => {
    const updated = [...answers, picked]
    setAnswers(updated)
    setPicked(null)
    if (qi < totalQ - 1) {
      setQi(qi + 1)
    } else {
      setPhase('generating')
    }
  }

  // --- INTRO ---
  if (phase === 'intro') {
    return (
      <div style={{ ...ROOT_STYLE, justifyContent: 'space-between', padding: 24 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ width: 88, height: 88, borderRadius: 28, background: 'var(--primary-soft)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, fontSize: 44 }}>
            🎯
          </div>
          <h1 style={{ margin: '0 0 10px', fontSize: 27, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)' }}>
            {"Let's find your starting point"}
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: 300 }}>
            A short {totalQ}-question check so Vidya can build a plan that's actually yours. No grades, no pressure.
          </p>
          <div style={{ display: 'flex', gap: 20, marginTop: 28 }}>
            {[['⏱', `~${totalQ} min`], ['🧠', 'Adaptive'], ['🛡', 'Private']].map(([ic, label]) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
                <span style={{ fontSize: 22 }}>{ic}</span>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
        <Btn full size="lg" onClick={() => setPhase('running')}>
          Begin diagnostic
        </Btn>
      </div>
    )
  }

  // --- GENERATING ---
  if (phase === 'generating') {
    const si = Math.min(GENERATING_STAGES.length - 1, Math.floor(genPct / 22))
    const r = 52
    const circ = 2 * Math.PI * r
    return (
      <div style={{ ...ROOT_STYLE, justifyContent: 'center', alignItems: 'center', padding: 32, textAlign: 'center' }}>
        <div style={{ position: 'relative', width: 120, height: 120, marginBottom: 28 }}>
          <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="60" cy="60" r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
            <circle
              cx="60" cy="60" r={r} fill="none" stroke="var(--primary)" strokeWidth="8"
              strokeLinecap="round" strokeDasharray={circ}
              strokeDashoffset={circ * (1 - genPct / 100)}
              style={{ transition: 'stroke-dashoffset .6s ease' }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>✨</div>
        </div>
        <h2 style={{ margin: '0 0 8px', fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)' }}>Building your plan</h2>
        <div style={{ fontSize: 15, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 4 }}>{GENERATING_STAGES[si]}...</div>
        <span style={{ fontSize: 12, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>{genPct}%</span>
      </div>
    )
  }

  // --- ERROR ---
  if (phase === 'error') {
    return (
      <div style={{ ...ROOT_STYLE, justifyContent: 'center' }}>
        <ErrorState
          title="Couldn't generate your plan"
          body="Our tutor engine hit a snag. Your responses are saved."
          onRetry={() => setPhase('generating')}
        />
      </div>
    )
  }

  // --- RESULTS ---
  if (phase === 'results') {
    const resultTiers: Array<{ subject: SubjectKey; tier: TierKey }> = [
      { subject: 'math', tier: 'fair' },
      { subject: 'science', tier: 'ontrack' },
      { subject: 'social', tier: 'weak' },
    ]
    return (
      <div style={{ ...ROOT_STYLE }}>
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ width: 72, height: 72, borderRadius: 24, background: 'var(--tier-strong-soft)', color: 'var(--tier-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 36 }}>✓</div>
            <h1 style={{ margin: '0 0 8px', fontSize: 25, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)' }}>Your plan is ready!</h1>
            <p style={{ margin: 0, fontSize: 14.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {"Here's where you're starting. We'll grow these together."}
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {resultTiers.map(r => (
              <Card key={r.subject} pad={14} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <Ring tier={r.tier} size={48} stroke={5} />
                <div style={{ flex: 1 }}>
                  <SubjectChip subject={r.subject} />
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>Starting tier</div>
                </div>
                <TierPill tier={r.tier} />
              </Card>
            ))}
          </div>
          <div style={{ marginTop: 18, padding: 16, borderRadius: 16, background: 'var(--primary-soft)', display: 'flex', gap: 12 }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>💡</span>
            <div style={{ fontSize: 13.5, lineHeight: 1.45 }}>
              <strong>First focus:</strong> Start with your weakest subject to make the fastest gains.
            </div>
          </div>
        </div>
        <div style={{ padding: '12px 24px 28px' }}>
          <Btn full size="lg" onClick={() => router.push('/student/dashboard')}>
            Go to dashboard
          </Btn>
        </div>
      </div>
    )
  }

  // --- RUNNING ---
  const cur = questions[qi]
  return (
    <div style={{ ...ROOT_STYLE }}>
      {/* Header */}
      <div style={{ padding: '10px 20px 4px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <SubjectChip subject={cur.subject} size="sm" />
        <div style={{ flex: 1 }}>
          <Bar value={qi + 1} max={totalQ} h={6} />
        </div>
        <span style={{ fontSize: 11.5, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>{qi + 1}/{totalQ}</span>
      </div>

      <div style={{ flex: 1, padding: 24, overflow: 'auto' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>
          Question {qi + 1}
        </div>
        <h2 style={{ margin: '0 0 28px', fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.35, color: 'var(--text)' }}>
          {cur.text}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {cur.options.map((opt, i) => {
            const on = picked === i
            return (
              <button
                key={i}
                onClick={() => setPicked(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px',
                  borderRadius: 16, cursor: 'pointer', textAlign: 'left', minHeight: 44,
                  background: on ? 'var(--primary-soft)' : 'var(--surface)',
                  border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
                  transition: 'all .15s',
                }}
              >
                <div style={{
                  width: 30, height: 30, borderRadius: 10, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13,
                  background: on ? 'var(--primary)' : 'var(--surface-2)',
                  color: on ? 'var(--on-brand)' : 'var(--text-muted)',
                }}>
                  {String.fromCharCode(65 + i)}
                </div>
                <span style={{ fontSize: 15.5, fontWeight: 500, color: 'var(--text)' }}>{opt}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ padding: '12px 24px 28px' }}>
        <Btn full size="lg" disabled={picked === null} onClick={submit}>
          {qi < totalQ - 1 ? 'Next question' : 'Submit'}
        </Btn>
      </div>
    </div>
  )
}
