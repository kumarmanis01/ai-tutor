'use client'
import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Btn, Bar, Card, Skel,
} from '@/components/ui'
import { SUBJECTS, SubjectKey } from '@/lib/constants/subjects'

// Steps: name -> dob -> board -> subjects -> lang -> (if minor) consent -> done
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

const BOARDS = ['CBSE', 'ICSE', 'State Board']
const GRADES = [4, 5, 6, 7, 8, 9, 10, 11, 12]
const LANGS = ['English', 'Hindi', 'Hinglish (mix)']

function chipStyle(on: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    height: 44,
    padding: '0 18px',
    borderRadius: 12,
    cursor: 'pointer',
    background: on ? 'var(--primary)' : 'var(--surface)',
    color: on ? 'var(--on-brand)' : 'var(--text)',
    border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
    fontWeight: 600,
    fontSize: 14,
    fontFamily: 'var(--font-sans)',
    transition: 'all .15s',
  }
}

interface FauxInputProps {
  value: string
  placeholder: string
  onType: (v: string) => void
  mono?: boolean
  autofocus?: boolean
  type?: string
}

function FauxInput({ value, placeholder, onType, mono, autofocus, type = 'text' }: FauxInputProps) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (autofocus && ref.current) ref.current.focus()
  }, [autofocus])
  return (
    <input
      ref={ref}
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={e => onType(e.target.value)}
      style={{
        width: '100%', height: 54, padding: '0 18px', borderRadius: 14,
        outline: 'none', border: '1.5px solid var(--border)',
        background: 'var(--surface)', color: 'var(--text)',
        fontSize: 16, fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
        fontWeight: 500, transition: 'border .15s', boxSizing: 'border-box',
      }}
      onFocus={e => { e.target.style.borderColor = 'var(--primary)' }}
      onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
    />
  )
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

function InfoNote({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: 14, borderRadius: 14, background: 'var(--primary-soft)', marginTop: 16 }}>
      <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.45 }}>{text}</div>
    </div>
  )
}

export default function StudentOnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [data, setData] = useState<OnboardingData>({
    name: '', dob: '', board: '', grade: '', subjects: [], lang: '',
    parentEmail: '', consentDone: false,
  })
  const [otpSent, setOtpSent] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const age = useMemo(() => {
    if (!data.dob) return null
    const parts = data.dob.split('-')
    const year = parts.length === 3 ? parseInt(parts[2] ?? parts[0] ?? '') : parseInt(data.dob.slice(-4))
    return year ? 2026 - year : null
  }, [data.dob])

  const needsConsent = age !== null && age < 13

  const steps: StepId[] = ['name', 'dob', 'board', 'subjects', 'lang']
  if (needsConsent) steps.push('consent')
  const total = steps.length
  const cur = steps[step] as StepId

  const update = <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) =>
    setData(d => ({ ...d, [k]: v }))

  const toggleSubj = (s: SubjectKey) =>
    setData(d => ({
      ...d,
      subjects: d.subjects.includes(s)
        ? d.subjects.filter(x => x !== s)
        : [...d.subjects, s],
    }))

  const canNext: boolean = {
    name: data.name.trim().length > 1,
    dob: !!data.dob,
    board: !!(data.board && data.grade),
    subjects: data.subjects.length > 0,
    lang: !!data.lang,
    consent: data.consentDone,
  }[cur] ?? false

  const handleNext = async () => {
    if (step < total - 1) {
      setStep(step + 1)
    } else {
      setIsSaving(true)
      // Navigate to diagnostic after final step
      router.push('/student/diagnostic')
    }
  }

  return (
    <div style={{ maxWidth: 390, margin: '0 auto', display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: 'var(--bg)' }}>
      {/* progress bar */}
      <div style={{ padding: '8px 20px 0', display: 'flex', alignItems: 'center', gap: 12, minHeight: 44 }}>
        {step > 0 && (
          <button
            onClick={() => setStep(step - 1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex', minWidth: 44, minHeight: 44, alignItems: 'center' }}
          >
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7"/></svg>
          </button>
        )}
        <div style={{ flex: 1 }}><Bar value={step + 1} max={total} h={6} /></div>
        <span style={{ fontSize: 11.5, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>{step + 1}/{total}</span>
      </div>

      {/* step content */}
      <div key={cur} style={{ flex: 1, padding: '28px 24px', overflow: 'auto' }}>
        {cur === 'name' && (
          <StepShell title="Let's get started" sub="What should Vidya call you?">
            <FauxInput value={data.name} placeholder="Your first name" onType={v => update('name', v)} autofocus />
          </StepShell>
        )}

        {cur === 'dob' && (
          <StepShell title="When were you born?" sub="This personalises your study plan.">
            <FauxInput value={data.dob} placeholder="DD-MM-YYYY" onType={v => update('dob', v)} mono />
            {needsConsent && (
              <InfoNote text="You're under 13 -- we'll need a parent's consent in a moment (DPDP rule)." />
            )}
          </StepShell>
        )}

        {cur === 'board' && (
          <StepShell title="Your board & grade" sub="We'll align content to your syllabus.">
            <FieldLabel>Board</FieldLabel>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
              {BOARDS.map(b => (
                <button key={b} onClick={() => update('board', b)} style={chipStyle(data.board === b)}>{b}</button>
              ))}
            </div>
            <FieldLabel>Grade</FieldLabel>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {GRADES.map(g => (
                <button
                  key={g}
                  onClick={() => update('grade', String(g))}
                  style={{ ...chipStyle(data.grade === String(g)), width: 50, justifyContent: 'center', fontFamily: 'var(--font-mono)' }}
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
              {(Object.values(SUBJECTS) as typeof SUBJECTS[SubjectKey][]).map(s => {
                const on = data.subjects.includes(s.id as SubjectKey)
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleSubj(s.id as SubjectKey)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                      borderRadius: 14, cursor: 'pointer', minHeight: 44,
                      background: on ? `color-mix(in oklch, ${s.cssColor} 12%, var(--surface))` : 'var(--surface)',
                      border: `1.5px solid ${on ? s.cssColor : 'var(--border)'}`,
                      transition: 'all .15s', textAlign: 'left',
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, background: s.cssColor, color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, flexShrink: 0,
                    }}>
                      {s.short.charAt(0)}
                    </div>
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>{s.name}</span>
                    <div style={{
                      width: 24, height: 24, borderRadius: 99, flexShrink: 0,
                      border: `2px solid ${on ? s.cssColor : 'var(--border)'}`,
                      background: on ? s.cssColor : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {on && <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>}
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
                      display: 'flex', alignItems: 'center', gap: 12, padding: 16,
                      borderRadius: 14, cursor: 'pointer', minHeight: 44,
                      background: on ? 'var(--primary-soft)' : 'var(--surface)',
                      border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
                      textAlign: 'left',
                    }}
                  >
                    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={on ? 'var(--primary)' : 'var(--text-faint)'} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>{l}</span>
                    {on && <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>}
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
              <FauxInput
                value={data.parentEmail}
                placeholder="parent@email.com"
                onType={v => update('parentEmail', v)}
                type="email"
              />
            </div>
            {!otpSent ? (
              <div style={{ marginTop: 16 }}>
                <Btn
                  full
                  disabled={!data.parentEmail.includes('@')}
                  onClick={() => setOtpSent(true)}
                >
                  Send consent link
                </Btn>
              </div>
            ) : (
              <div style={{ marginTop: 18, padding: 16, borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Consent link sent</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: 12 }}>
                  We emailed a secure approval link to <strong style={{ color: 'var(--text)' }}>{data.parentEmail}</strong>. Your parent taps it to approve.
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 10 }}>Link expires in 30 min.</div>
                {/* In production this would be set via webhook; for now allow manual confirm */}
                {!data.consentDone && (
                  <Btn full size="sm" variant="secondary" onClick={() => update('consentDone', true)}>
                    Confirm parent approved
                  </Btn>
                )}
                {data.consentDone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--tier-strong)', fontWeight: 700, fontSize: 14 }}>
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                    Parent approved
                  </div>
                )}
              </div>
            )}
          </StepShell>
        )}
      </div>

      {/* CTA */}
      <div style={{ padding: '12px 24px 28px', background: 'var(--bg)' }}>
        <Btn full size="lg" disabled={!canNext || isSaving} onClick={handleNext}>
          {isSaving ? 'Saving...' : step === total - 1 ? 'Start diagnostic' : 'Continue'}
          {!isSaving && (
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 4 }}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          )}
        </Btn>
      </div>
    </div>
  )
}
