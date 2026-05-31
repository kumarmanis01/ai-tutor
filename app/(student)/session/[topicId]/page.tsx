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

function StepKicker({ text }: { text: string }) {
  return (
    <div className="inline-flex items-center gap-[6px] text-[11.5px] font-bold text-[var(--primary)] uppercase tracking-[0.05em] mb-3">
      {text}
    </div>
  )
}

function ObjectiveStep({ step }: { step: StepObjective }) {
  return (
    <div>
      <StepKicker text="Lesson" />
      <h1 className="m-0 mb-[18px] text-[24px] font-extrabold tracking-[-0.03em] leading-[1.15] text-[var(--text)]">{step.title}</h1>
      <div className="flex flex-col gap-3">
        {step.points.map((p, i) => (
          <div key={i} className="flex gap-3 items-center p-[14px] rounded-[14px] bg-[var(--surface)] border border-[var(--border)]">
            <div className="w-7 h-7 rounded-[9px] bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center [font-family:var(--font-mono)] font-bold text-[13px] shrink-0">{i + 1}</div>
            <span className="text-[14.5px] font-medium leading-[1.35] text-[var(--text)]">{p}</span>
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
      <h2 className="m-0 mb-4 text-[21px] font-extrabold tracking-[-0.02em] leading-[1.2] text-[var(--text)]">{step.title}</h2>
      {step.body && <p className="m-0 mb-4 text-[15.5px] leading-[1.55] text-[var(--text)]">{step.body}</p>}
      {step.formula && (
        <div className="p-[18px] rounded-2xl bg-[var(--surface-2)] border border-dashed border-[var(--border)] text-center mb-4">
          <Mono className="text-[22px] font-bold text-[var(--primary)]">{step.formula}</Mono>
        </div>
      )}
      {step.callout && (
        <div className="flex gap-[11px] p-[14px] rounded-[14px] bg-[var(--primary-soft)]">
          <span className="text-[18px] shrink-0">💡</span>
          <span className="text-[13.5px] leading-[1.45] text-[var(--text)]">{step.callout}</span>
        </div>
      )}
      <button
        onClick={onAsk}
        className="mt-[18px] flex items-center gap-2 w-full px-[14px] py-3 rounded-xl bg-transparent border border-dashed border-[var(--border)] cursor-pointer text-[var(--primary)] [font-family:var(--font-sans)] text-[13px] font-semibold min-h-[44px]"
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
      <h2 className="m-0 mb-[22px] text-[19px] font-bold leading-[1.4] tracking-[-0.01em] text-[var(--text)]">{step.text}</h2>
      <div className="flex flex-col gap-[11px]">
        {step.options.map((opt, i) => {
          const isPick = picked === i
          const isCorrect = i === step.correctIndex
          const bg = revealed
            ? isCorrect ? 'bg-[var(--tier-strong-soft)]' : isPick ? 'bg-[var(--tier-critical-soft)]' : 'bg-[var(--surface)]'
            : isPick ? 'bg-[var(--primary-soft)]' : 'bg-[var(--surface)]'
          const bd = revealed
            ? isCorrect ? 'border-[var(--tier-strong)]' : isPick ? 'border-[var(--tier-critical)]' : 'border-[var(--border)]'
            : isPick ? 'border-[var(--primary)]' : 'border-[var(--border)]'
          const badgeBg = isPick && !revealed
            ? 'bg-[var(--primary)]'
            : revealed && isCorrect
              ? 'bg-[var(--tier-strong)]'
              : revealed && isPick
                ? 'bg-[var(--tier-critical)]'
                : 'bg-[var(--surface-2)]'
          const badgeColor = (isPick && !revealed) || (revealed && (isCorrect || isPick)) ? 'text-white' : 'text-[var(--text-muted)]'
          return (
            <button
              key={i}
              disabled={revealed}
              onClick={() => setPicked(i)}
              className={[
                'flex items-center gap-[13px] px-4 py-[15px] rounded-[15px] text-left transition-all duration-150 min-h-[44px]',
                revealed ? 'cursor-default' : 'cursor-pointer',
                bg, 'border-[1.5px]', bd,
              ].join(' ')}
            >
              <div className={['w-[27px] h-[27px] rounded-[9px] shrink-0 flex items-center justify-center [font-family:var(--font-mono)] font-bold text-[12.5px]', badgeBg, badgeColor].join(' ')}>{String.fromCharCode(65 + i)}</div>
              <span className="flex-1 text-[14.5px] font-medium text-[var(--text)]">{opt}</span>
              {revealed && isCorrect && <span className="text-[var(--tier-strong)] font-bold">✓</span>}
              {revealed && isPick && !isCorrect && <span className="text-[var(--tier-critical)] font-bold">✗</span>}
            </button>
          )
        })}
      </div>
      {!revealed ? (
        <div className="mt-4">
          <Btn full variant="secondary" disabled={picked === null} onClick={() => setRevealed(true)}>Check answer</Btn>
        </div>
      ) : (
        <div className={[
          'mt-4 p-[14px] rounded-[14px] flex gap-[11px]',
          picked === step.correctIndex ? 'bg-[var(--tier-strong-soft)]' : 'bg-[var(--primary-soft)]',
        ].join(' ')}>
          <span className="text-[18px] shrink-0">{picked === step.correctIndex ? '✅' : '💡'}</span>
          <div>
            <div className="text-[13.5px] font-bold mb-[2px] text-[var(--text)]">{picked === step.correctIndex ? 'Correct!' : 'Not quite'}</div>
            <div className="text-[13px] leading-[1.45] text-[var(--text)]">{step.explanation}</div>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryStep({ step }: { step: StepSummary }) {
  return (
    <div className="text-center pt-3">
      <div className="w-[76px] h-[76px] rounded-3xl bg-[var(--tier-strong-soft)] text-[var(--tier-strong)] flex items-center justify-center mx-auto mb-[18px] text-[40px]">✓</div>
      <h1 className="m-0 mb-2 text-[24px] font-extrabold tracking-[-0.03em] text-[var(--text)]">{step.title}</h1>
      <div className="inline-flex items-center gap-[6px] px-[14px] py-[6px] rounded-full bg-[var(--primary-soft)] text-[var(--primary)] text-[13px] font-bold mb-6">
        ⚡ +{step.xp} XP earned
      </div>
      <div className="text-left p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
        <div className="text-[12px] font-bold text-[var(--text-muted)] uppercase tracking-[0.05em] mb-3">Key takeaways</div>
        <div className="flex flex-col gap-[11px]">
          {step.points.map((p, i) => (
            <div key={i} className="flex gap-[10px] items-start">
              <span className="text-[var(--tier-strong)] shrink-0 mt-[2px] font-bold">✓</span>
              <span className="text-[14px] leading-[1.4] text-[var(--text)]">{p}</span>
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
      <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto flex flex-col h-screen">
        <div className="p-5">
          <Skel w={120} h={14} className="mb-4 mt-2" />
          <Skel h={6} r={99} className="mb-6" />
          <Skel w="70%" h={22} className="mb-[18px]" />
          <Skel h={120} r={16} className="mb-[14px]" />
          <Skel h={90} r={16} className="mb-[14px]" />
          <Skel w="90%" h={14} className="mb-2" />
          <Skel w="60%" h={14} />
        </div>
      </div>
    )
  }

  // No content
  if (sessionStatus === 'no-content') {
    return (
      <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto flex flex-col h-screen">
        <div className="flex items-center gap-[10px] px-4 py-[6px] min-h-[44px]">
          <button onClick={() => router.back()} className="bg-[var(--surface-2)] border border-[var(--border)] w-[38px] h-[38px] rounded-[10px] flex items-center justify-center cursor-pointer text-[var(--text)] min-w-[44px] min-h-[44px]">‹</button>
        </div>
        <div className="flex-1 flex flex-col justify-center items-center text-center p-7">
          <div className="w-20 h-20 rounded-[26px] bg-[var(--primary-soft)] flex items-center justify-center text-[var(--primary)] mb-[22px] text-[38px]">✨</div>
          <div className="mb-2"><SubjectChip subject={subject} size="sm" /></div>
          <h1 className="m-0 mb-[10px] text-[22px] font-extrabold tracking-[-0.02em] text-[var(--text)]">{concept}</h1>
          <p className="m-0 text-[14.5px] text-[var(--text-muted)] leading-[1.5] max-w-[290px]">
            A guided lesson is not ready for this topic yet -- but Vidya can teach it to you live, right now.
          </p>
          <div className="flex gap-2 mt-[18px] px-[14px] py-[10px] rounded-xl bg-[var(--surface-2)] border border-[var(--border)] items-center">
            <span className="text-[14px]">ℹ</span>
            <Mono className="text-[11.5px] text-[var(--text-muted)]">notes + practice · generating</Mono>
          </div>
          <div className="w-full max-w-[300px] mt-[26px]">
            <Btn full size="lg" onClick={() => router.push('/student/tutor')}>Learn with Vidya chat</Btn>
          </div>
        </div>
      </div>
    )
  }

  // Error
  if (sessionStatus === 'error') {
    return (
      <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto flex flex-col h-screen justify-center">
        <ErrorState onRetry={() => router.refresh()} />
      </div>
    )
  }

  return (
    <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto flex flex-col h-screen relative">
      {/* Lesson header */}
      <div className="px-[14px] pt-[6px] pb-3 bg-[var(--surface)] border-b border-[var(--border)]">
        <div className="flex items-center gap-[10px] mb-[10px]">
          <button onClick={back} className="bg-[var(--surface-2)] border border-[var(--border)] w-[34px] h-[34px] rounded-[10px] flex items-center justify-center cursor-pointer text-[var(--text)] shrink-0 min-w-[44px] min-h-[44px]">‹</button>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-bold tracking-[-0.01em] leading-[1.2] whitespace-nowrap overflow-hidden text-ellipsis text-[var(--text)]">{concept}</div>
            <div className="flex items-center gap-[6px] mt-[2px]">
              <SubjectChip subject={subject} size="sm" />
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          {steps.map((_, i) => (
            <div
              key={i}
              className={[
                'flex-1 h-1 rounded-full transition-all duration-300',
                i <= idx ? 'bg-[var(--primary)]' : 'bg-[var(--surface-3)]',
                i === idx ? 'opacity-100' : i < idx ? 'opacity-100' : 'opacity-60',
              ].join(' ')}
            />
          ))}
        </div>
      </div>

      {/* Step body */}
      <div className="flex-1 overflow-auto px-[18px] pt-5 pb-24">
        {step.type === 'objective' && <ObjectiveStep step={step} />}
        {step.type === 'note' && <NoteStep step={step} onAsk={() => setAskOpen(true)} />}
        {step.type === 'question' && <QuestionStep step={step} />}
        {step.type === 'summary' && <SummaryStep step={step} />}
      </div>

      {/* Footer nav */}
      <div className="absolute bottom-0 left-0 right-0 px-[18px] pt-3 pb-[26px] [background:color-mix(in_oklch,var(--surface)_92%,transparent)] [backdrop-filter:blur(16px)] [-webkit-backdrop-filter:blur(16px)] border-t border-[var(--border)]">
        <div className="flex items-center gap-[10px]">
          <button
            onClick={() => setAskOpen(true)}
            title="Ask Vidya about this topic"
            className="w-[50px] h-[50px] rounded-[15px] bg-[var(--primary-soft)] border border-[color-mix(in_oklch,var(--primary)_30%,transparent)] flex flex-col items-center justify-center cursor-pointer text-[var(--primary)] shrink-0 gap-[1px]"
          >
            <span className="text-[18px]">💬</span>
            <span className="text-[8px] font-bold">Ask</span>
          </button>
          <Btn full size="lg" onClick={next}>
            {isLast ? 'Finish lesson' : 'Continue'}
          </Btn>
        </div>
      </div>

      {/* Ask Vidya sheet (simple) */}
      {askOpen && (
        <div className="absolute inset-0 z-[60] flex flex-col justify-end">
          <div onClick={() => setAskOpen(false)} className="absolute inset-0 bg-[var(--overlay)]" />
          <div className="relative h-1/2 bg-[var(--surface)] rounded-[26px_26px_0_0] flex flex-col p-5">
            <div className="w-[38px] h-1 rounded-full bg-[var(--border)] mx-auto mb-4" />
            <div className="text-[16px] font-bold mb-3 text-[var(--text)]">Ask Vidya about this topic</div>
            <div className="flex-1 flex flex-col gap-2">
              <p className="text-[14px] text-[var(--text-muted)] m-0">Open a full Vidya session to ask questions about {concept}.</p>
            </div>
            <div className="flex gap-[10px]">
              <Btn variant="secondary" full onClick={() => setAskOpen(false)}>Close</Btn>
              <Btn full onClick={() => { setAskOpen(false); router.push('/student/tutor') }}>Open Vidya</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
