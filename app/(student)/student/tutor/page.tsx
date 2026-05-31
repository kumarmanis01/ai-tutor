'use client'
import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Btn, Bar, SubjectChip, Mono } from '@/components/ui'

interface TutorMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface TutorProps {
  messages?: TutorMessage[]
  isLoading?: boolean
  isDiagnosticComplete?: boolean
  isInRollout?: boolean
  onSend?: (message: string) => void
}

interface BubbleProps {
  role: 'user' | 'vidya'
  text?: string
  loading?: boolean
  streaming?: boolean
}

function Bubble({ role, text, loading, streaming }: BubbleProps) {
  const isUser = role === 'user'
  return (
    <div className={['flex', isUser ? 'justify-end' : 'justify-start'].join(' ')}>
      <div className={[
        'max-w-[82%] px-[14px] py-[11px] text-[14.5px] leading-[1.5] whitespace-pre-wrap',
        'rounded-[18px]',
        isUser
          ? 'rounded-br-[5px] bg-[var(--primary)] text-[var(--on-brand)] border-0'
          : 'rounded-bl-[5px] bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] shadow-[var(--shadow-sm)]',
      ].join(' ')}>
        {loading ? (
          <div className="flex gap-1 py-[3px] px-[2px]">
            {[0, 1, 2].map(i => (
              <span key={i} className="w-[7px] h-[7px] rounded-full bg-[var(--text-faint)] inline-block" />
            ))}
          </div>
        ) : text}
        {streaming && (
          <span className="inline-block w-[7px] h-[15px] bg-[var(--primary)] ml-[2px] align-middle rounded-[1px]" />
        )}
      </div>
    </div>
  )
}

// Gate screen: diagnostic not complete or not in rollout
function GateScreen({ reason }: { reason: 'diagnostic' | 'rollout' }) {
  const router = useRouter()
  return (
    <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto flex flex-col h-screen justify-center items-center p-8 text-center">
      <div className="w-20 h-20 rounded-[26px] bg-[var(--primary-soft)] flex items-center justify-center mb-[22px] text-[38px]">
        {reason === 'diagnostic' ? '🧠' : '✨'}
      </div>
      <h1 className="m-0 mb-[10px] text-[22px] font-extrabold tracking-[-0.02em] text-[var(--text)]">
        {reason === 'diagnostic' ? 'Complete your diagnostic first' : 'Vidya is coming soon'}
      </h1>
      <p className="m-0 mb-6 text-[14.5px] text-[var(--text-muted)] leading-[1.5] max-w-[280px]">
        {reason === 'diagnostic'
          ? 'Vidya needs to understand your starting point before she can personalise your tutoring.'
          : "We're rolling out Vidya gradually. You'll get access soon!"}
      </p>
      <Btn
        onClick={() => reason === 'diagnostic' ? router.push('/student/diagnostic') : router.push('/student/dashboard')}
      >
        {reason === 'diagnostic' ? 'Start diagnostic' : 'Back to dashboard'}
      </Btn>
    </div>
  )
}

export default function TutorPage(_props: TutorProps) {
  const router = useRouter()
  const [msgs, setMsgs] = useState<Array<{ role: 'user' | 'vidya'; text: string }>>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [hintOpen, setHintOpen] = useState(false)
  const [progress, setProgress] = useState(35)
  const [phase, setPhase] = useState<'chat' | 'complete'>('chat')
  const [rating, setRating] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Gate checks -- in production, read from session/feature flags
  const isDiagnosticComplete = true
  const isInRollout = true

  useEffect(() => {
    if (!isDiagnosticComplete || !isInRollout) return
    // Initial greeting
    const t = setTimeout(() => {
      setIsLoading(true)
      setTimeout(() => {
        setIsLoading(false)
        startStream("Hello! I'm Vidya, your personal tutor. What would you like to learn today? I'm here to guide you with questions and hints -- not just give you answers!")
      }, 1200)
    }, 400)
    return () => clearTimeout(t)
  }, [isDiagnosticComplete, isInRollout])

  const startStream = (full: string) => {
    setStreaming(true)
    setStreamText('')
    let i = 0
    const step = Math.max(2, Math.round(full.length / 90))
    const iv = setInterval(() => {
      i += step
      const chunk = full.slice(0, i)
      setStreamText(chunk)
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      if (i >= full.length) {
        clearInterval(iv)
        setStreaming(false)
        setMsgs(m => [...m, { role: 'vidya', text: full }])
        setStreamText('')
      }
    }, 45)
  }

  const send = () => {
    if (!input.trim() || streaming) return
    const txt = input.trim()
    setMsgs(m => [...m, { role: 'user', text: txt }])
    setInput('')
    setProgress(p => Math.min(95, p + 20))
    setTimeout(() => {
      startStream("That's a great question! Let me guide you through it. What do you think the first step might be? Think about what information you already have.")
    }, 600)
  }

  if (!isDiagnosticComplete) return <GateScreen reason="diagnostic" />
  if (!isInRollout) return <GateScreen reason="rollout" />

  return (
    <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto flex flex-col h-screen">
      {/* Header */}
      <div className="px-4 pt-[6px] pb-[10px] border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center gap-[10px]">
          <button
            onClick={() => router.push('/student/dashboard')}
            className="bg-[var(--surface-2)] border border-[var(--border)] w-9 h-9 rounded-[11px] flex items-center justify-center cursor-pointer text-[var(--text)] min-w-[44px] min-h-[44px]"
          >
            ‹
          </button>
          <div className="w-[38px] h-[38px] rounded-xl flex items-center justify-center text-white text-[20px] [background:linear-gradient(135deg,var(--primary),oklch(0.4_0.2_270))]">
            ✨
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-bold tracking-[-0.02em] text-[var(--text)]">Vidya</div>
            <div className="text-[11.5px] text-[var(--text-muted)]">Your AI tutor</div>
          </div>
          <SubjectChip subject="math" size="sm" />
        </div>
        <div className="flex items-center gap-2 mt-[10px]">
          <Bar value={progress} h={5} />
          <Mono className="text-[10.5px] text-[var(--text-faint)] whitespace-nowrap">session {progress}%</Mono>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-auto px-4 pt-4 pb-2 flex flex-col gap-[14px]">
        {msgs.map((m, i) => <Bubble key={i} role={m.role} text={m.text} />)}
        {isLoading && <Bubble role="vidya" loading />}
        {streaming && <Bubble role="vidya" text={streamText} streaming />}

        {phase === 'complete' && (
          <div className="rounded-[18px] p-[18px] bg-[var(--surface)] border border-[var(--border)] text-center">
            <div className="w-[52px] h-[52px] rounded-2xl bg-[var(--tier-strong-soft)] text-[var(--tier-strong)] flex items-center justify-center mx-auto mb-3 text-[28px]">✓</div>
            <div className="text-[16px] font-extrabold tracking-[-0.02em] text-[var(--text)]">Session complete!</div>
            <div className="text-[13px] text-[var(--text-muted)] mt-1 mb-2">+45 XP · Concept mastery improved</div>
            <div className="text-[12.5px] font-semibold text-[var(--text-muted)] mb-2">How was this session?</div>
            <div className="flex gap-2 justify-center mb-[14px]">
              {[1, 2, 3, 4, 5].map(s => (
                <button key={s} onClick={() => setRating(s)} className={['bg-transparent border-0 cursor-pointer p-0 text-[28px] min-w-[44px] min-h-[44px]', s <= rating ? 'text-[var(--tier-fair)]' : 'text-[var(--border)]'].join(' ')}>
                  ★
                </button>
              ))}
            </div>
            <Btn full onClick={() => router.push('/student/dashboard')}>Back to dashboard</Btn>
          </div>
        )}
      </div>

      {/* Composer */}
      {phase !== 'complete' && (
        <div className="bg-[var(--surface)] border-t border-[var(--border)] pb-6">
          {/* Hint toggle */}
          <button
            onClick={() => setHintOpen(!hintOpen)}
            className="w-full flex items-center gap-2 px-4 py-[10px] bg-transparent border-0 cursor-pointer text-[var(--primary)] [font-family:var(--font-sans)] min-h-[44px]"
          >
            <span>💡</span>
            <span className="text-[13px] font-semibold flex-1 text-left">Need a hint?</span>
            <span
              className="inline-block transition-transform duration-200"
              style={{ transform: hintOpen ? 'rotate(180deg)' : 'none' }}
            >▾</span>
          </button>
          {hintOpen && (
            <div className="px-4 pb-3">
              <div className="p-3 rounded-xl bg-[var(--primary-soft)] text-[13px] leading-[1.45] text-[var(--text)]">
                {"Try breaking the problem into smaller parts. What's the first thing you need to find?"}
              </div>
            </div>
          )}
          {/* Input */}
          <div className="flex items-center gap-2 px-3 pt-1 pb-2">
            <button
              onClick={() => router.push('/student/whiteboard')}
              className="w-[44px] h-[44px] rounded-[13px] bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center cursor-pointer text-[var(--text-muted)] shrink-0 text-[20px]"
              title="Whiteboard"
            >
              ✏
            </button>
            <div className="flex-1 flex items-center bg-[var(--surface-2)] border border-[var(--border)] rounded-[22px] pl-4 pr-[6px]">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send()}
                placeholder="Ask Vidya anything..."
                className="flex-1 h-[44px] border-0 outline-none bg-transparent text-[14.5px] [font-family:var(--font-sans)] text-[var(--text)]"
              />
              <button
                onClick={send}
                disabled={!input.trim() || streaming}
                className={[
                  'w-[34px] h-[34px] rounded-[11px] border-0 flex items-center justify-center cursor-pointer shrink-0 text-[16px]',
                  input.trim() && !streaming ? 'bg-[var(--primary)] text-[var(--on-brand)]' : 'bg-[var(--surface-3)] text-[var(--text-faint)]',
                ].join(' ')}
              >
                ›
              </button>
            </div>
          </div>
          {!streaming && (
            <div className="text-center pb-1">
              <button
                onClick={() => setPhase('complete')}
                className="bg-transparent border-0 text-[var(--text-faint)] text-[12px] font-semibold cursor-pointer [font-family:var(--font-sans)] min-h-[44px]"
              >
                End session
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
