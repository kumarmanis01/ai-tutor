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

const ROOT_STYLE: React.CSSProperties = {
  background: 'var(--bg)',
  minHeight: '100vh',
  maxWidth: 390,
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
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
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: '82%', padding: '11px 14px', borderRadius: 18,
        borderBottomRightRadius: isUser ? 5 : 18, borderBottomLeftRadius: isUser ? 18 : 5,
        background: isUser ? 'var(--primary)' : 'var(--surface)',
        color: isUser ? 'var(--on-brand)' : 'var(--text)',
        border: isUser ? 'none' : '1px solid var(--border)',
        boxShadow: isUser ? 'none' : 'var(--shadow-sm)',
        fontSize: 14.5, lineHeight: 1.5, whiteSpace: 'pre-wrap',
      }}>
        {loading ? (
          <div style={{ display: 'flex', gap: 4, padding: '3px 2px' }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--text-faint)', display: 'inline-block' }} />
            ))}
          </div>
        ) : text}
        {streaming && (
          <span style={{ display: 'inline-block', width: 7, height: 15, background: 'var(--primary)', marginLeft: 2, verticalAlign: 'middle', borderRadius: 1 }} />
        )}
      </div>
    </div>
  )
}

// Gate screen: diagnostic not complete or not in rollout
function GateScreen({ reason }: { reason: 'diagnostic' | 'rollout' }) {
  const router = useRouter()
  return (
    <div style={{ ...ROOT_STYLE, justifyContent: 'center', alignItems: 'center', padding: 32, textAlign: 'center' }}>
      <div style={{ width: 80, height: 80, borderRadius: 26, background: 'var(--primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22, fontSize: 38 }}>
        {reason === 'diagnostic' ? '🧠' : '✨'}
      </div>
      <h1 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)' }}>
        {reason === 'diagnostic' ? 'Complete your diagnostic first' : 'Vidya is coming soon'}
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: 14.5, color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: 280 }}>
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
    <div style={ROOT_STYLE}>
      {/* Header */}
      <div style={{ padding: '6px 16px 10px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => router.push('/student/dashboard')}
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', width: 36, height: 36, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text)', minWidth: 44, minHeight: 44 }}
          >
            ‹
          </button>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: 'linear-gradient(135deg, var(--primary), oklch(0.4 0.2 270))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20 }}>
            ✨
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>Vidya</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Your AI tutor</div>
          </div>
          <SubjectChip subject="math" size="sm" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <Bar value={progress} h={5} />
          <Mono style={{ fontSize: 10.5, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>session {progress}%</Mono>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', padding: '16px 16px 8px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {msgs.map((m, i) => <Bubble key={i} role={m.role} text={m.text} />)}
        {isLoading && <Bubble role="vidya" loading />}
        {streaming && <Bubble role="vidya" text={streamText} streaming />}

        {phase === 'complete' && (
          <div style={{ borderRadius: 18, padding: 18, background: 'var(--surface)', border: '1px solid var(--border)', textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--tier-strong-soft)', color: 'var(--tier-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 28 }}>✓</div>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)' }}>Session complete!</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, marginBottom: 8 }}>+45 XP · Concept mastery improved</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>How was this session?</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 14 }}>
              {[1, 2, 3, 4, 5].map(s => (
                <button key={s} onClick={() => setRating(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: s <= rating ? 'var(--tier-fair)' : 'var(--border)', padding: 0, fontSize: 28, minWidth: 44, minHeight: 44 }}>
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
        <div style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', paddingBottom: 24 }}>
          {/* Hint toggle */}
          <button
            onClick={() => setHintOpen(!hintOpen)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontFamily: 'var(--font-sans)', minHeight: 44 }}
          >
            <span>💡</span>
            <span style={{ fontSize: 13, fontWeight: 600, flex: 1, textAlign: 'left' }}>Need a hint?</span>
            <span style={{ transform: hintOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s', display: 'inline-block' }}>▾</span>
          </button>
          {hintOpen && (
            <div style={{ padding: '0 16px 12px' }}>
              <div style={{ padding: 12, borderRadius: 12, background: 'var(--primary-soft)', fontSize: 13, lineHeight: 1.45, color: 'var(--text)' }}>
                {"Try breaking the problem into smaller parts. What's the first thing you need to find?"}
              </div>
            </div>
          )}
          {/* Input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px 8px' }}>
            <button
              onClick={() => router.push('/student/whiteboard')}
              style={{ width: 44, height: 44, borderRadius: 13, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0, fontSize: 20 }}
              title="Whiteboard"
            >
              ✏
            </button>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 22, padding: '0 6px 0 16px' }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send()}
                placeholder="Ask Vidya anything..."
                style={{ flex: 1, height: 44, border: 'none', outline: 'none', background: 'transparent', fontSize: 14.5, fontFamily: 'var(--font-sans)', color: 'var(--text)' }}
              />
              <button
                onClick={send}
                disabled={!input.trim() || streaming}
                style={{ width: 34, height: 34, borderRadius: 11, background: input.trim() && !streaming ? 'var(--primary)' : 'var(--surface-3)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: input.trim() && !streaming ? 'var(--on-brand)' : 'var(--text-faint)', flexShrink: 0, fontSize: 16 }}
              >
                ›
              </button>
            </div>
          </div>
          {!streaming && (
            <div style={{ textAlign: 'center', paddingBottom: 4 }}>
              <button
                onClick={() => setPhase('complete')}
                style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', minHeight: 44 }}
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
