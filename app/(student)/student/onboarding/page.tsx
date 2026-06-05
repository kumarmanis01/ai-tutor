'use client'

/**
 * FILE OBJECTIVE:
 * - Multi-step student onboarding: collects name, DOB, board+grade, subjects,
 *   preferred language, and parent email; for under-13 students it also sends
 *   and verifies the parent consent OTP inline against /api/auth/parent/{send,verify}-otp.
 * - Final step POSTs to /api/user/onboarding which transitions accountStatus.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/student/onboarding/page.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-06-04T00:00:00Z | claude | wire inline parent OTP send+verify in consent step;
 *                                   map Hinglish->hi for LanguageCode enum compatibility;
 *                                   tighten OTP regex to exactly 6 digits to match UI copy
 *                                   and the server's always-6-digit generator.
 */

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
// LANG_OPTIONS: label is shown to the user; code maps to Prisma LanguageCode enum (en|hi).
// Backend rejects values outside the enum, so we send the code, never the label.
const LANG_OPTIONS = [
  { label: 'English', code: 'en' },
  { label: 'Hindi', code: 'hi' },
  { label: 'Hinglish (mix)', code: 'hi' },
] as const

function chipBtnClass(on: boolean): string {
  return [
    'inline-flex items-center gap-[6px] h-[44px] px-4 rounded-xl cursor-pointer',
    'font-semibold text-[14px] [font-family:var(--font-sans)] transition-all duration-150 min-w-[44px]',
    on
      ? 'bg-[var(--primary)] text-[var(--on-brand)] border-[1.5px] border-[var(--primary)]'
      : 'bg-[var(--surface)] text-[var(--text)] border-[1.5px] border-[var(--border)]',
  ].join(' ')
}

function StepShell({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="m-0 mb-[6px] text-[26px] font-extrabold tracking-[-0.03em] leading-[1.1] text-[var(--text)]">{title}</h1>
      {sub && <p className="m-0 mb-[26px] text-[15px] text-[var(--text-muted)] leading-[1.45]">{sub}</p>}
      {children}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[12px] font-bold text-[var(--text-muted)] uppercase tracking-[0.04em] mb-2">
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
      className={[
        'w-full h-[54px] px-[18px] rounded-[14px] outline-none',
        'border-[1.5px] border-[var(--border)] bg-[var(--surface)] text-[var(--text)]',
        'text-[16px] font-medium transition-[border] duration-150 box-border',
        mono ? '[font-family:var(--font-mono)]' : '[font-family:var(--font-sans)]',
      ].join(' ')}
      onFocus={e => { e.target.style.borderColor = 'var(--primary)' }}
      onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
    />
  )
}

function InfoNote({ text }: { text: string }) {
  return (
    <div className="flex gap-[10px] p-[14px] rounded-[14px] bg-[var(--primary-soft)] mt-4">
      <span className="text-[var(--primary)] shrink-0">🛡</span>
      <div className="text-[13px] text-[var(--text)] leading-[1.45]">{text}</div>
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
  const [otpCode, setOtpCode] = useState('')
  const [otpVerifying, setOtpVerifying] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [otpSending, setOtpSending] = useState(false)
  const [otpError, setOtpError] = useState('')

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

  const languageCode = useMemo(
    () => LANG_OPTIONS.find(o => o.label === data.lang)?.code ?? 'en',
    [data.lang],
  )

  const sendConsentOtp = async () => {
    if (!data.parentEmail) return
    setOtpSending(true)
    setOtpError('')
    try {
      // Save parent email to DB first so send-otp can read it
      const saveRes = await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          age,
          board: data.board,
          grade: data.grade,
          subjects: data.subjects.map(k => SUBJECTS[k].name.toLowerCase()),
          preferred_language: languageCode,
          parent_email: data.parentEmail,
        }),
      })
      if (!saveRes.ok) {
        setOtpError('Could not save details. Please try again.')
        setOtpSending(false)
        return
      }
      const otpRes = await fetch('/api/auth/parent/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!otpRes.ok) {
        setOtpError('Could not send consent email. Please try again.')
        setOtpSending(false)
        return
      }
      setOtpSent(true)
    } catch {
      setOtpError('Something went wrong. Please try again.')
    } finally {
      setOtpSending(false)
    }
  }

  const verifyConsentOtp = async () => {
    const code = otpCode.trim()
    // Server only ever issues 6-digit codes (see generateOtp in /api/auth/parent/send-otp).
    if (!/^\d{6}$/.test(code)) {
      setOtpError('Enter the 6-digit code your parent received.')
      return
    }
    setOtpVerifying(true)
    setOtpError('')
    try {
      const res = await fetch('/api/auth/parent/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !(json.ok || json.verified || json.alreadyVerified)) {
        setOtpError(typeof json.error === 'string' ? json.error : 'Invalid or expired code. Try again.')
        return
      }
      // Server has set accountStatus=active. Mark consent done so footer CTA unlocks.
      update('consentDone', true)
    } catch {
      setOtpError('Something went wrong. Please try again.')
    } finally {
      setOtpVerifying(false)
    }
  }

  const handleNext = async () => {
    if (step < total - 1) {
      setStep(step + 1)
    } else {
      setIsSubmitting(true)
      try {
        const res = await fetch('/api/user/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: data.name,
            age,
            board: data.board,
            grade: data.grade,
            subjects: data.subjects.map(k => SUBJECTS[k].name.toLowerCase()),
            preferred_language: languageCode,
            parent_email: data.parentEmail || undefined,
          }),
        })
        if (!res.ok) {
          setIsSubmitting(false)
          return
        }
        router.push('/student/diagnostic')
      } catch {
        setIsSubmitting(false)
      }
    }
  }

  return (
    <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto relative flex flex-col h-screen">
      {/* Progress strip */}
      <div className="px-5 pt-2 pb-0 flex items-center gap-3">
        {step > 0 && (
          <button
            onClick={() => setStep(step - 1)}
            className="bg-transparent border-0 cursor-pointer text-[var(--text-muted)] p-0 flex min-w-[44px] min-h-[44px] items-center justify-center text-[22px]"
            aria-label="Go back"
          >
            ‹
          </button>
        )}
        <div className="flex-1">
          <Bar value={step + 1} max={total} h={6} />
        </div>
        <span className="text-[11.5px] text-[var(--text-faint)] [font-family:var(--font-mono)]">{step + 1}/{total}</span>
      </div>

      {/* Step body */}
      <div className="flex-1 px-6 pt-7 pb-0 overflow-auto">
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
            <div className="flex gap-2 flex-wrap mb-[18px]">
              {BOARDS.map(b => (
                <button key={b} onClick={() => update('board', b)} className={chipBtnClass(data.board === b)}>{b}</button>
              ))}
            </div>
            <FieldLabel>Grade</FieldLabel>
            <div className="flex gap-2 flex-wrap">
              {GRADES.map(g => (
                <button
                  key={g}
                  onClick={() => update('grade', String(g))}
                  className={chipBtnClass(data.grade === String(g)) + ' w-[52px] justify-center [font-family:var(--font-mono)]'}
                >
                  {g}
                </button>
              ))}
            </div>
          </StepShell>
        )}

        {cur === 'subjects' && (
          <StepShell title="Pick your subjects" sub="Choose what you want to focus on.">
            <div className="flex flex-col gap-[10px]">
              {(Object.values(SUBJECTS) as Array<typeof SUBJECTS[SubjectKey]>).map(s => {
                const on = data.subjects.includes(s.id as SubjectKey)
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleSubj(s.id as SubjectKey)}
                    className="flex items-center gap-3 px-4 py-[14px] rounded-[14px] cursor-pointer text-left min-h-[44px] transition-all duration-150"
                    style={{
                      background: on ? `color-mix(in oklch, ${s.cssColor} 12%, var(--surface))` : 'var(--surface)',
                      border: `1.5px solid ${on ? s.cssColor : 'var(--border)'}`,
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-[10px] flex items-center justify-center font-bold text-[15px] shrink-0 text-white"
                      style={{ background: s.cssColor }}
                    >
                      {s.short[0]}
                    </div>
                    <span className="flex-1 font-semibold text-[15px] text-[var(--text)]">{s.name}</span>
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white shrink-0"
                      style={{
                        border: `2px solid ${on ? s.cssColor : 'var(--border)'}`,
                        background: on ? s.cssColor : 'transparent',
                      }}
                    >
                      {on && <span className="text-[13px] leading-none">✓</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          </StepShell>
        )}

        {cur === 'lang' && (
          <StepShell title="Preferred language" sub="Vidya can explain in your comfort language.">
            <div className="flex flex-col gap-[10px]">
              {LANG_OPTIONS.map(l => {
                const on = data.lang === l.label
                return (
                  <button
                    key={l.label}
                    onClick={() => update('lang', l.label)}
                    className={[
                      'flex items-center gap-3 p-4 rounded-[14px] cursor-pointer text-left min-h-[44px]',
                      on
                        ? 'bg-[var(--primary-soft)] border-[1.5px] border-[var(--primary)]'
                        : 'bg-[var(--surface)] border-[1.5px] border-[var(--border)]',
                    ].join(' ')}
                  >
                    <span className="text-[20px]">🌐</span>
                    <span className="flex-1 font-semibold text-[15px] text-[var(--text)]">{l.label}</span>
                    {on && <span className="text-[var(--primary)] font-bold">✓</span>}
                  </button>
                )
              })}
            </div>
          </StepShell>
        )}

        {cur === 'consent' && (
          <StepShell title="Parent consent" sub="A quick approval keeps your data safe.">
            <InfoNote text="Under DPDP rules, learners under 13 need verified parental consent before any data is processed." />
            <div className="mt-[18px]">
              <FieldLabel>Parent's email</FieldLabel>
              <TextInput value={data.parentEmail} placeholder="parent@email.com" onType={v => update('parentEmail', v)} />
            </div>
            {!otpSent ? (
              <div className="mt-4">
                <Btn full disabled={!data.parentEmail || otpSending} onClick={sendConsentOtp}>
                  {otpSending ? 'Sending...' : 'Send consent link'}
                </Btn>
                {otpError && (
                  <div className="mt-2 text-[13px] text-[var(--danger)] text-center">{otpError}</div>
                )}
              </div>
            ) : (
              <div className="mt-[18px] p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
                <div className="flex items-center gap-[10px] mb-2">
                  <div className="w-[34px] h-[34px] rounded-[10px] bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center text-[18px]">✉</div>
                  <div className="text-[14px] font-bold text-[var(--text)]">Code sent</div>
                </div>
                <div className="text-[13px] text-[var(--text-muted)] leading-[1.45] mb-3">
                  We emailed a 6-digit code to{' '}
                  <strong className="text-[var(--text)]">{data.parentEmail}</strong>. Ask your parent to share it.
                </div>
                {data.consentDone ? (
                  <div className="flex items-center gap-2 text-[14px] font-semibold text-[var(--tier-strong)]">
                    <span>✓</span> Parent verified
                  </div>
                ) : (
                  <>
                    <FieldLabel>Parent's code</FieldLabel>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="\d{4,6}"
                      maxLength={6}
                      value={otpCode}
                      onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="------"
                      className="w-full h-[50px] px-[14px] rounded-[12px] border-[1.5px] border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-[18px] tracking-[0.3em] text-center [font-family:var(--font-mono)] outline-none box-border mb-3"
                    />
                    <Btn full size="sm" disabled={otpVerifying || otpCode.length < 4} onClick={verifyConsentOtp}>
                      {otpVerifying ? 'Verifying...' : 'Verify code'}
                    </Btn>
                  </>
                )}
                <div className="text-[11.5px] text-[var(--text-faint)] mt-[10px]">
                  Code expires in 5 min.{' '}
                  <button
                    onClick={() => { setOtpSent(false); setOtpError(''); setOtpCode('') }}
                    className="bg-transparent border-0 text-[var(--primary)] font-semibold cursor-pointer [font-family:var(--font-sans)] p-0 text-[11.5px]"
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
      <div className="px-6 pt-3 pb-7 bg-[var(--bg)]">
        <Btn full size="lg" disabled={!canNext || isSubmitting} onClick={handleNext}>
          {isSubmitting ? 'Saving...' : step === total - 1 ? 'Start diagnostic' : 'Continue'}
        </Btn>
      </div>
    </div>
  )
}
