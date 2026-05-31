'use client'
import React, { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Btn, Bar, Card, Skel, SubjectChip, ErrorState, Mono } from '@/components/ui'
import type { SubjectKey } from '@/lib/constants/subjects'

interface SessionQuestion {
  id: string
  text: string
  options: string[]
  correctIndex: number
  explanation: string
}

interface StepObjective {
  type: 'objective'
  title: string
  points: string[]
}
interface StepNote {
  type: 'note'
  title: string
  body?: string
  formula?: string
  callout?: string
}
interface StepQuestion {
  type: 'question'
  text: string
  options: string[]
  correctIndex: number
  explanation: string
}
interface StepSummary {
  type: 'summary'
  title: string
  points: string[]
  xp: number
}

type SessionStep = StepObjective | StepNote | StepQuestion | StepSummary

interface SessionData {
  topicId: string
  concept: string
  subject: SubjectKey
  grade: string
  board: string
  steps: SessionStep[]
  status: 'loading' | 'notes' | 'question' | 'completed' | 'error' | 'no-content'
}

const ROOT_STYLE: React.CSSProperties = {
  background: 'var(--bg)',
  minHeight: '100vh',
  maxWidth: 390,
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
}

function StepKicker({ text }: { text: string }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
      {text}
    </div>
  )
}

function ObjectiveStep({ step }: { step: StepObjective }) {
  return (
    <div>
      <StepKicker text="Lesson" />
      <h1 style={{ margin: '0 0 18px', fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15, color: 'var(--text)' }}>{step.title}</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {step.points.map((p, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 14, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div style={{ width: 28, height: 28, borderRadius: 9, background: 'var(--primary-soft)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{i + 1}</div>
            <span style={{ fontSize: 14.5, fontWeight: 500, lineHeight: 1.35, color: 'var(--text)' }}>{p}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function NoteStep({ step, onAsk }: { step: StepNote; onAsk: () => void }) {
  return (
    <div>
      <StepKicker text="Notes" />
      <h2 style={{ margin: '0 0 16px', fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2, color: 'var(--text)' }}>{step.title}</h2>
      {step.body && <p style={{ margin: '0 0 16px', fontSize: 15.5, lineHeight: 1.55, color: 'var(--text)' }}>{step.body}</p>}
      {step.formula && (
        <div style={{ padding: '18px', borderRadius: 16, background: 'var(--surface-2)', border: '1px dashed var(--border)', textAlign: 'center', marginBottom: 16 }}>
          <Mono style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary)' }}>{step.formula}</Mono>
        </div>
      )}
      {step.callout && (
        <div style={{ display: 'flex', gap: 11, padding: 14, borderRadius: 14, background: 'var(--primary-soft)' }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>💡</span>
          <span style={{ fontSize: 13.5, lineHeight: 1.45, color: 'var(--text)' }}>{step.callout}</span>
        </div>
      )}
      <button
        onClick={onAsk}
        style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px 14px', borderRadius: 12, background: 'transparent', border: '1px dashed var(--border)', cursor: 'pointer', color: 'var(--primary)', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, minHeight: 44 }}
      >
        💬 Confused? Ask Vidya about this
      </button>
    </div>
  )
}

function QuestionStep({ step }: { step: StepQuestion }) {
  const [picked, setPicked] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)
  return (
    <div>
      <StepKicker text="Quick check" />
      <h2 style={{ margin: '0 0 22px', fontSize: 19, fontWeight: 700, lineHeight: 1.4, letterSpacing: '-0.01em', color: 'var(--text)' }}>{step.text}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {step.options.map((opt, i) => {
          const isPick = picked === i
          const isCorrect = i === step.correctIndex
          let bg = 'var(--surface)', bd = 'var(--border)'
          if (revealed) {
            if (isCorrect) { bg = 'var(--tier-strong-soft)'; bd = 'var(--tier-strong)' }
            else if (isPick) { bg = 'var(--tier-critical-soft)'; bd = 'var(--tier-critical)' }
          } else if (isPick) { bg = 'var(--primary-soft)'; bd = 'var(--primary)' }
          return (
            <button
              key={i}
              disabled={revealed}
              onClick={() => setPicked(i)}
              style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '15px 16px', borderRadius: 15, cursor: revealed ? 'default' : 'pointer', textAlign: 'left', background: bg, border: `1.5px solid ${bd}`, transition: 'all .15s', minHeight: 44 }}
            >
              <div style={{ width: 27, height: 27, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12.5, background: isPick && !revealed ? 'var(--primary)' : revealed && isCorrect ? 'var(--tier-strong)' : revealed && isPick ? 'var(--tier-critical)' : 'var(--surface-2)', color: (isPick && !revealed) || (revealed && (isCorrect || isPick)) ? '#fff' : 'var(--text-muted)' }}>{String.fromCharCode(65 + i)}</div>
              <span style={{ flex: 1, fontSize: 14.5, fontWeight: 500, color: 'var(--text)' }}>{opt}</span>
              {revealed && isCorrect && <span style={{ color: 'var(--tier-strong)', fontWeight: 700 }}>✓</span>}
              {revealed && isPick && !isCorrect && <span style={{ color: 'var(--tier-critical)', fontWeight: 700 }}>✗</span>}
            </button>
          )
        })}
      </div>
      {!revealed ? (
        <div style={{ marginTop: 16 }}>
          <Btn full variant="secondary" disabled={picked === null} onClick={() => setRevealed(true)}>Check answer</Btn>
        </div>
      ) : (
        <div style={{ marginTop: 16, padding: 14, borderRadius: 14, background: picked === step.correctIndex ? 'var(--tier-strong-soft)' : 'var(--primary-soft)', display: 'flex', gap: 11 }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>{picked === step.correctIndex ? '✅' : '💡'}</span>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 2, color: 'var(--text)' }}>{picked === step.correctIndex ? 'Correct!' : 'Not quite'}</div>
            <div style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--text)' }}>{step.explanation}</div>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryStep({ step }: { step: StepSummary }) {
  return (
    <div style={{ textAlign: 'center', paddingTop: 12 }}>
      <div style={{ width: 76, height: 76, borderRadius: 24, background: 'var(--tier-strong-soft)', color: 'var(--tier-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', fontSize: 40 }}>✓</div>
      <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)' }}>{step.title}</h1>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 99, background: 'var(--primary-soft)', color: 'var(--primary)', fontSize: 13, fontWeight: 700, marginBottom: 24 }}>
        ⚡ +{step.xp} XP earned
      </div>
      <div style={{ textAlign: 'left', padding: 16, borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Key takeaways</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {step.points.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--tier-strong)', flexShrink: 0, marginTop: 2, fontWeight: 700 }}>✓</span>
              <span style={{ fontSize: 14, lineHeight: 1.4, color: 'var(--text)' }}>{p}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function SessionPage({ params }: { params: { topicId: string } }) {
  const router = useRouter()
  const [sessionStatus] = useState<'loading' | 'active' | 'no-content' | 'error'>('active')
  const [idx, setIdx] = useState(0)
  const [askOpen, setAskOpen] = useState(false)

  // Demo session steps
  const concept = decodeURIComponent(params.topicId)
  const steps: SessionStep[] = [
    {
      type: 'objective',
      title: concept,
      points: ['Understand the core concept', 'Apply it to example problems', 'Test your understanding'],
    },
    {
      type: 'note',
      title: 'Key Concept',
      body: 'This is a fundamental concept in your curriculum. Understanding it will help you solve a wide range of problems.',
      formula: 'ax² + bx + c = 0',
      callout: 'Remember: the discriminant D = b² - 4ac tells you about the nature of roots.',
    },
    {
      type: 'question',
      text: 'Which formula represents the quadratic formula?',
      options: [
        'x = (-b ± √(b² - 4ac)) / 2a',
        'x = (b ± √(b² - 4ac)) / 2a',
        'x = (-b ± √(b² + 4ac)) / 2a',
        'x = (-b ± √(b² - 4ac)) / a',
      ],
      correctIndex: 0,
      explanation: 'The quadratic formula is x = (-b ± √(b² - 4ac)) / 2a. Note the negative sign before b and the 2a in the denominator.',
    },
    {
      type: 'summary',
      title: 'Lesson complete!',
      points: [
        'You learned the key concept',
        'You practiced with an example',
        'You tested your understanding',
      ],
      xp: 45,
    },
  ]

  const subject: SubjectKey = 'math'
  const total = steps.length
  const step = steps[idx]
  const isLast = idx === total - 1

  const next = () => {
    if (isLast) { router.push('/student/dashboard'); return }
    setIdx(i => i + 1)
  }
  const back = () => {
    if (idx === 0) { router.push('/student/dashboard'); return }
    setIdx(i => i - 1)
  }

  // Loading
  if (sessionStatus === 'loading') {
    return (
      <div style={ROOT_STYLE}>
        <div style={{ padding: 20 }}>
          <Skel w={120} h={14} style={{ marginBottom: 16, marginTop: 8 }} />
          <Skel h={6} r={99} style={{ marginBottom: 24 }} />
          <Skel w="70%" h={22} style={{ marginBottom: 18 }} />
          <Skel h={120} r={16} style={{ marginBottom: 14 }} />
          <Skel h={90} r={16} style={{ marginBottom: 14 }} />
          <Skel w="90%" h={14} style={{ marginBottom: 8 }} />
          <Skel w="60%" h={14} />
        </div>
      </div>
    )
  }

  // No content
  if (sessionStatus === 'no-content') {
    return (
      <div style={ROOT_STYLE}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 16px', minHeight: 44 }}>
          <button onClick={() => router.back()} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text)', minWidth: 44, minHeight: 44 }}>‹</button>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: 28 }}>
          <div style={{ width: 80, height: 80, borderRadius: 26, background: 'var(--primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', marginBottom: 22, fontSize: 38 }}>✨</div>
          <div style={{ marginBottom: 8 }}><SubjectChip subject={subject} size="sm" /></div>
          <h1 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)' }}>{concept}</h1>
          <p style={{ margin: 0, fontSize: 14.5, color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: 290 }}>
            A guided lesson is not ready for this topic yet -- but Vidya can teach it to you live, right now.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 18, padding: '10px 14px', borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', alignItems: 'center' }}>
            <span style={{ fontSize: 14 }}>ℹ</span>
            <Mono style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>notes + practice · generating</Mono>
          </div>
          <div style={{ width: '100%', maxWidth: 300, marginTop: 26 }}>
            <Btn full size="lg" onClick={() => router.push('/student/tutor')}>Learn with Vidya chat</Btn>
          </div>
        </div>
      </div>
    )
  }

  // Error
  if (sessionStatus === 'error') {
    return (
      <div style={{ ...ROOT_STYLE, justifyContent: 'center' }}>
        <ErrorState onRetry={() => router.refresh()} />
      </div>
    )
  }

  return (
    <div style={{ ...ROOT_STYLE, position: 'relative' }}>
      {/* Lesson header */}
      <div style={{ padding: '6px 14px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <button onClick={back} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text)', flexShrink: 0, minWidth: 44, minHeight: 44 }}>‹</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text)' }}>{concept}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <SubjectChip subject={subject} size="sm" />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {steps.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 99, background: i <= idx ? 'var(--primary)' : 'var(--surface-3)', opacity: i === idx ? 1 : i < idx ? 1 : 0.6, transition: 'all .3s' }} />
          ))}
        </div>
      </div>

      {/* Step body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 18px 96px' }}>
        {step.type === 'objective' && <ObjectiveStep step={step} />}
        {step.type === 'note' && <NoteStep step={step} onAsk={() => setAskOpen(true)} />}
        {step.type === 'question' && <QuestionStep step={step} />}
        {step.type === 'summary' && <SummaryStep step={step} />}
      </div>

      {/* Footer nav */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 18px 26px', background: 'color-mix(in oklch, var(--surface) 92%, transparent)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setAskOpen(true)}
            title="Ask Vidya about this topic"
            style={{ width: 50, height: 50, borderRadius: 15, background: 'var(--primary-soft)', border: '1px solid color-mix(in oklch, var(--primary) 30%, transparent)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--primary)', flexShrink: 0, gap: 1 }}
          >
            <span style={{ fontSize: 18 }}>💬</span>
            <span style={{ fontSize: 8, fontWeight: 700 }}>Ask</span>
          </button>
          <Btn full size="lg" onClick={next}>
            {isLast ? 'Finish lesson' : 'Continue'}
          </Btn>
        </div>
      </div>

      {/* Ask Vidya sheet (simple) */}
      {askOpen && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setAskOpen(false)} style={{ position: 'absolute', inset: 0, background: 'var(--overlay)' }} />
          <div style={{ position: 'relative', height: '50%', background: 'var(--surface)', borderRadius: '26px 26px 0 0', display: 'flex', flexDirection: 'column', padding: 20 }}>
            <div style={{ width: 38, height: 4, borderRadius: 99, background: 'var(--border)', margin: '0 auto 16px' }} />
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>Ask Vidya about this topic</div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>Open a full Vidya session to ask questions about {concept}.</p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn variant="secondary" full onClick={() => setAskOpen(false)}>Close</Btn>
              <Btn full onClick={() => { setAskOpen(false); router.push('/student/tutor') }}>Open Vidya</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
