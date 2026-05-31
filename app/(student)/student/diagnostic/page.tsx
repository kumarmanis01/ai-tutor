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
      <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto flex flex-col h-screen justify-between p-6">
        <div className="flex-1 flex flex-col justify-center items-center text-center">
          <div className="w-[88px] h-[88px] rounded-[28px] bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center mb-6 text-[44px]">
            🎯
          </div>
          <h1 className="m-0 mb-[10px] text-[27px] font-extrabold tracking-[-0.03em] text-[var(--text)]">
            {"Let's find your starting point"}
          </h1>
          <p className="m-0 text-[15px] text-[var(--text-muted)] leading-[1.5] max-w-[300px]">
            A short {totalQ}-question check so Vidya can build a plan that's actually yours. No grades, no pressure.
          </p>
          <div className="flex gap-5 mt-7">
            {[['⏱', `~${totalQ} min`], ['🧠', 'Adaptive'], ['🛡', 'Private']].map(([ic, label]) => (
              <div key={label} className="flex flex-col items-center gap-[6px] text-[var(--text-muted)]">
                <span className="text-[22px]">{ic}</span>
                <span className="text-[12px] font-semibold">{label}</span>
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
      <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto flex flex-col h-screen justify-center items-center p-8 text-center">
        <div className="relative w-[120px] h-[120px] mb-7">
          <svg width="120" height="120" className="[transform:rotate(-90deg)]">
            <circle cx="60" cy="60" r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
            <circle
              cx="60" cy="60" r={r} fill="none" stroke="var(--primary)" strokeWidth="8"
              strokeLinecap="round" strokeDasharray={circ}
              strokeDashoffset={circ * (1 - genPct / 100)}
              style={{ transition: 'stroke-dashoffset .6s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-[32px]">✨</div>
        </div>
        <h2 className="m-0 mb-2 text-[21px] font-extrabold tracking-[-0.02em] text-[var(--text)]">Building your plan</h2>
        <div className="text-[15px] text-[var(--text-muted)] font-medium mb-1">{GENERATING_STAGES[si]}...</div>
        <span className="text-[12px] text-[var(--text-faint)] [font-family:var(--font-mono)]">{genPct}%</span>
      </div>
    )
  }

  // --- ERROR ---
  if (phase === 'error') {
    return (
      <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto flex flex-col h-screen justify-center">
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
      <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto flex flex-col h-screen">
        <div className="flex-1 overflow-auto p-6">
          <div className="text-center mb-6">
            <div className="w-[72px] h-[72px] rounded-3xl bg-[var(--tier-strong-soft)] text-[var(--tier-strong)] flex items-center justify-center mx-auto mb-4 text-[36px]">✓</div>
            <h1 className="m-0 mb-2 text-[25px] font-extrabold tracking-[-0.03em] text-[var(--text)]">Your plan is ready!</h1>
            <p className="m-0 text-[14.5px] text-[var(--text-muted)] leading-[1.5]">
              {"Here's where you're starting. We'll grow these together."}
            </p>
          </div>
          <div className="flex flex-col gap-[10px]">
            {resultTiers.map(r => (
              <Card key={r.subject} pad={14} className="flex items-center gap-[14px]">
                <Ring tier={r.tier} size={48} stroke={5} />
                <div className="flex-1">
                  <SubjectChip subject={r.subject} />
                  <div className="text-[12.5px] text-[var(--text-muted)] mt-[3px]">Starting tier</div>
                </div>
                <TierPill tier={r.tier} />
              </Card>
            ))}
          </div>
          <div className="mt-[18px] p-4 rounded-2xl bg-[var(--primary-soft)] flex gap-3">
            <span className="text-[20px] shrink-0">💡</span>
            <div className="text-[13.5px] leading-[1.45]">
              <strong>First focus:</strong> Start with your weakest subject to make the fastest gains.
            </div>
          </div>
        </div>
        <div className="px-6 pt-3 pb-7">
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
    <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto flex flex-col h-screen">
      {/* Header */}
      <div className="px-5 pt-[10px] pb-1 flex items-center gap-3">
        <SubjectChip subject={cur.subject} size="sm" />
        <div className="flex-1">
          <Bar value={qi + 1} max={totalQ} h={6} />
        </div>
        <span className="text-[11.5px] text-[var(--text-faint)] [font-family:var(--font-mono)]">{qi + 1}/{totalQ}</span>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        <div className="text-[12px] font-bold text-[var(--text-faint)] uppercase tracking-[0.05em] mb-[14px]">
          Question {qi + 1}
        </div>
        <h2 className="m-0 mb-7 text-[20px] font-bold tracking-[-0.02em] leading-[1.35] text-[var(--text)]">
          {cur.text}
        </h2>
        <div className="flex flex-col gap-3">
          {cur.options.map((opt, i) => {
            const on = picked === i
            return (
              <button
                key={i}
                onClick={() => setPicked(i)}
                className={[
                  'flex items-center gap-[14px] px-[18px] py-4 rounded-2xl cursor-pointer text-left min-h-[44px] transition-all duration-150',
                  on ? 'bg-[var(--primary-soft)] border-[1.5px] border-[var(--primary)]' : 'bg-[var(--surface)] border-[1.5px] border-[var(--border)]',
                ].join(' ')}
              >
                <div className={[
                  'w-[30px] h-[30px] rounded-[10px] shrink-0 flex items-center justify-center [font-family:var(--font-mono)] font-bold text-[13px]',
                  on ? 'bg-[var(--primary)] text-[var(--on-brand)]' : 'bg-[var(--surface-2)] text-[var(--text-muted)]',
                ].join(' ')}>
                  {String.fromCharCode(65 + i)}
                </div>
                <span className="text-[15.5px] font-medium text-[var(--text)]">{opt}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="px-6 pt-3 pb-7">
        <Btn full size="lg" disabled={picked === null} onClick={submit}>
          {qi < totalQ - 1 ? 'Next question' : 'Submit'}
        </Btn>
      </div>
    </div>
  )
}
