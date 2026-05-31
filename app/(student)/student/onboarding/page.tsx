'use client'
import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Btn, Bar } from '@/components/ui'
import { SUBJECTS, SubjectKey } from '@/lib/constants/subjects'

type StepId = 'name' | 'dob' | 'board' | 'subjects' | 'lang' | 'consent'

interface OnboardingData {
  name: string
  dob: string
  board: string
  grade: string
  subjects: SubjectKey[]
  lang: string
  parentEmail: string
  consentDone: boolean
}

const BOARDS = ['CBSE', 'ICSE', 'State Board'] as const
const GRADES = [6, 7, 8, 9, 10, 11, 12] as const
const LANGS = ['English', 'Hindi', 'Hinglish (mix)'] as const

const ROOT_STYLE: React.CSSProperties = {
  background: 'var(--bg)',
  minHeight: '100vh',
  maxWidth: 390,
  margin: '0 auto',
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
}

function chipBtnStyle(on: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 44,
    padding: '0 16px',
    borderRadius: 12,
    cursor: 'pointer',
    background: on ? 'var(--primary)' : 'var(--surface)',
    color: on ? 'var(--on-brand)' : 'var(--text)',
    border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
    fontWeight: 600,
    fontSize: 14,
    fontFamily: 'var(--font-sans)',
    transition: 'all .15s',
    minWidth: 44,
  }
}

function StepShell({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 style={{ margin: '0 0 6px', fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, color: 'var(--text)' }}>{title}</h1>
      {sub && <p style={{ margin: '0 0 26px', fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.45 }}>{sub}</p>}
      {children}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
      {children}
    </div>
  )
}

function TextInput({ value, placeholder, onType, mono, autoFocus }: {
  value: string
  placeholder: string
  onType: (v: string) => void
  mono?: boolean
  autoFocus?: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (autoFocus && ref.current) ref.current.focus()
  }, [autoFocus])
  return (
    <input
      ref={ref}
      value={value}
      placeholder={placeholder}
      onChange={e => onType(e.target.value)}
      style={{
        width: '100%',
        height: 54,
        padding: '0 18px',
        borderRadius: 14,
        outline: 'none',
        border: '1.5px solid var(--border)',
        background: 'var(--surface)',
        color: 'var(--text)',
        fontSize: 16,
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
        fontWeight: 500,
        transition: 'border .15s',
        boxSizing: 'border-box',
      }}
      onFocus={e => { e.target.style.borderColor = 'var(--primary)' }}
      onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
    />
  )
}

function InfoNote({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: 14, borderRadius: 14, background: 'var(--primary-soft)', marginTop: 16 }}>
      <span style={{ color: 'var(--primary)', flexShrink: 0 }}>🛡</span>
      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.45 }}>{text}</div>
    </div>
  )
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [data, setData] = useState<OnboardingData>({
    name: '',
    dob: '',
    board: '',
    grade: '',
    subjects: [],
    lang: '',
    parentEmail: '',
    consentDone: false,
  })
  const [otpSent, setOtpSent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // grade/board immutable after first save -- strip from all PATCH handlers
  const age = useMemo(() => {
    if (!data.dob) return null
    const parts = data.dob.split('-')
    if (parts.length !== 3) return null
    const year = parts[0].length === 4 ? parseInt(parts[0]) : parseInt(parts[2])
    return isNaN(year) ? null : 2026 - year
  }, [data.dob])

  const needsConsent = age !== null && age < 13

  const steps: StepId[] = ['name', 'dob', 'board', 'subjects', 'lang']
  if (needsConsent) steps.push('consent')
  const total = steps.length
  const cur = steps[step]

  const canNext: boolean = (() => {
    if (cur === 'name') return data.name.trim().length > 1
    if (cur === 'dob') return !!data.dob
    if (cur === 'board') return !!(data.board && data.grade)
    if (cur === 'subjects') return data.subjects.length > 0
    if (cur === 'lang') return !!data.lang
    if (cur === 'consent') return data.consentDone
    return false
  })()

  const update = <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) =>
    setData(d => ({ ...d, [k]: v }))

  const toggleSubj = (s: SubjectKey) =>
    setData(d => ({
      ...d,
      subjects: d.subjects.includes(s)
        ? d.subjects.filter(x => x !== s)
        : [...d.subjects, s],
    }))

  const handleNext = async () => {
    if (step < total - 1) {
      setStep(step + 1)
    } else {
      setIsSubmitting(true)
      try {
        await fetch('/api/student/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        router.push('/student/diagnostic')
      } catch {
        setIsSubmitting(false)
      }
    }
  }

  return (
    <div style={ROOT_STYLE}>
      {/* Progress strip */}
      <div style={{ padding: '8px 20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        {step > 0 && (
          <button
            onClick={() => setStep(step - 1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex', minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', fontSize: 22 }}
            aria-label="Go back"
          >
            ‹
          </button>
        )}
        <div style={{ flex: 1 }}>
          <Bar value={step + 1} max={total} h={6} />
        </div>
        <span style={{ fontSize: 11.5, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>{step + 1}/{total}</span>
      </div>

      {/* Step body */}
      <div style={{ flex: 1, padding: '28px 24px', overflow: 'auto' }}>
        {cur === 'name' && (
          <StepShell title="Let's get started" sub="What should Vidya call you?">
            <TextInput value={data.name} placeholder="Your first name" onType={v => update('name', v)} autoFocus />
          </StepShell>
        )}

        {cur === 'dob' && (
          <StepShell title="When were you born?" sub="This personalises your study plan.">
            <TextInput value={data.dob} placeholder="DD-MM-YYYY" onType={v => update('dob', v)} mono />
            {needsConsent && (
              <InfoNote text="You're under 13 -- we'll need a parent's consent in a moment (DPDP rule)." />
            )}
          </StepShell>
        )}

        {cur === 'board' && (
          <StepShell title="Your board and grade" sub="We'll align content to your syllabus.">
            <FieldLabel>Board</FieldLabel>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
              {BOARDS.map(b => (
                <button key={b} onClick={() => update('board', b)} style={chipBtnStyle(data.board === b)}>{b}</button>
              ))}
            </div>
            <FieldLabel>Grade</FieldLabel>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {GRADES.map(g => (
                <button
                  key={g}
                  onClick={() => update('grade', String(g))}
                  style={{ ...chipBtnStyle(data.grade === String(g)), width: 52, justifyContent: 'center', fontFamily: 'var(--font-mono)' }}
                >
                  {g}
                </button>
              ))}
            </div>
          </StepShell>
        )}

        {cur === 'subjects' && (
          <StepShell title="Pick your subjects" sub="Choose what you want to focus on.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(Object.values(SUBJECTS) as Array<typeof SUBJECTS[SubjectKey]>).map(s => {
                const on = data.subjects.includes(s.id as SubjectKey)
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleSubj(s.id as SubjectKey)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '14px 16px',
                      borderRadius: 14,
                      cursor: 'pointer',
                      background: on ? `color-mix(in oklch, ${s.cssColor} 12%, var(--surface))` : 'var(--surface)',
                      border: `1.5px solid ${on ? s.cssColor : 'var(--border)'}`,
                      transition: 'all .15s',
                      textAlign: 'left',
                      minHeight: 44,
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: s.cssColor, color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: 15, flexShrink: 0,
                    }}>
                      {s.short[0]}
                    </div>
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>{s.name}</span>
                    <div style={{
                      width: 24, height: 24, borderRadius: 99,
                      border: `2px solid ${on ? s.cssColor : 'var(--border)'}`,
                      background: on ? s.cssColor : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', flexShrink: 0,
                    }}>
                      {on && <span style={{ fontSize: 13, lineHeight: 1 }}>✓</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          </StepShell>
        )}

        {cur === 'lang' && (
          <StepShell title="Preferred language" sub="Vidya can explain in your comfort language.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {LANGS.map(l => {
                const on = data.lang === l
                return (
                  <button
                    key={l}
                    onClick={() => update('lang', l)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '16px', borderRadius: 14, cursor: 'pointer',
                      background: on ? 'var(--primary-soft)' : 'var(--surface)',
                      border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
                      textAlign: 'left', minHeight: 44,
                    }}
                  >
                    <span style={{ fontSize: 20 }}>🌐</span>
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>{l}</span>
                    {on && <span style={{ color: 'var(--primary)', fontWeight: 700 }}>✓</span>}
                  </button>
                )
              })}
            </div>
          </StepShell>
        )}

        {cur === 'consent' && (
          <StepShell title="Parent consent" sub="A quick approval keeps your data safe.">
            <InfoNote text="Under DPDP rules, learners under 13 need verified parental consent before any data is processed." />
            <div style={{ marginTop: 18 }}>
              <FieldLabel>Parent's email</FieldLabel>
              <TextInput value={data.parentEmail} placeholder="parent@email.com" onType={v => update('parentEmail', v)} />
            </div>
            {!otpSent ? (
              <div style={{ marginTop: 16 }}>
                <Btn full disabled={!data.parentEmail} onClick={() => setOtpSent(true)}>
                  Send consent link
                </Btn>
              </div>
            ) : (
              <div style={{ marginTop: 18, padding: 16, borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--primary-soft)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>✉</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Consent link sent</div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: 12 }}>
                  We emailed a secure approval link to{' '}
                  <strong style={{ color: 'var(--text)' }}>{data.parentEmail}</strong>. Your parent taps it to approve.
                </div>
                <Btn full size="sm" variant="secondary" onClick={() => update('consentDone', true)}>
                  {data.consentDone ? 'Parent approved' : 'Mark as approved'}
                </Btn>
                <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 10 }}>
                  Link expires in 30 min.{' '}
                  <button
                    onClick={() => setOtpSent(false)}
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', padding: 0, fontSize: 11.5 }}
                  >
                    Resend
                  </button>
                </div>
              </div>
            )}
          </StepShell>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 24px 28px', background: 'var(--bg)' }}>
        <Btn full size="lg" disabled={!canNext || isSubmitting} onClick={handleNext}>
          {isSubmitting ? 'Saving...' : step === total - 1 ? 'Start diagnostic' : 'Continue'}
        </Btn>
      </div>
    </div>
  )
}
