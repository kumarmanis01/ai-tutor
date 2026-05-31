'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppHeader, Card, Btn, Bar, Mono } from '@/components/ui'
import { FREE_TIER_SESSION_LIMIT } from '@/lib/constants/freemium'

interface UpgradeProps {
  currentPlan?: 'free' | 'premium'
  triggerReason?: 'session_limit' | 'test_limit' | 'feature_locked' | null
  onSelectPlan?: (planId: string) => void
  paymentStatus?: 'idle' | 'success' | 'error'
}

const PLAN_FEATURES = [
  'Unlimited Vidya AI tutoring sessions',
  'Unlimited chapter tests and mock exams',
  'Detailed performance analytics and reports',
  'Personalised study plan with daily targets',
  'Priority support from our team',
]

const PLANS = [
  {
    id: 'monthly',
    label: 'Monthly',
    price: 399,
    period: '/month',
    perMonth: null,
    save: null,
  },
  {
    id: 'annual',
    label: 'Annual',
    price: 2999,
    period: '/year',
    perMonth: '₹250/month',
    save: 'Save 37%',
  },
]

const ROOT_STYLE: React.CSSProperties = {
  background: 'var(--bg)',
  minHeight: '100vh',
  maxWidth: 390,
  margin: '0 auto',
  paddingBottom: 110,
}

export default function UpgradePage(props: UpgradeProps) {
  const router = useRouter()
  const { triggerReason, currentPlan = 'free' } = props
  const [selectedPlan, setSelectedPlan] = useState('annual')
  const [phase, setPhase] = useState<'plans' | 'paying' | 'success'>(
    props.paymentStatus === 'success' ? 'success' : 'plans'
  )

  const isLocked = triggerReason === 'session_limit' || triggerReason === 'test_limit'

  const handlePay = () => {
    setPhase('paying')
    // In production: open Razorpay
    setTimeout(() => setPhase('success'), 1900)
  }

  // --- SUCCESS ---
  if (phase === 'success') {
    return (
      <div style={{ minHeight: '100vh', maxWidth: 390, margin: '0 auto', background: 'linear-gradient(170deg, var(--primary), oklch(0.3 0.2 270))', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: 32, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        {/* Confetti dots */}
        {Array.from({ length: 14 }, (_, i) => (
          <div key={i} style={{ position: 'absolute', top: -10, left: `${(i * 7 + 5) % 100}%`, width: 8, height: 12, borderRadius: 2, background: ['#fff', 'var(--tier-fair)', 'var(--tier-strong)', 'var(--primary-soft)'][i % 4] }} />
        ))}
        <div style={{ width: 100, height: 100, borderRadius: 32, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, color: '#fff', fontSize: 52 }}>
          👑
        </div>
        <h1 style={{ margin: '0 0 10px', fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', color: '#fff' }}>
          {"You're Premium!"}
        </h1>
        <p style={{ margin: '0 0 28px', fontSize: 15, color: 'rgba(255,255,255,0.9)', lineHeight: 1.5, maxWidth: 280 }}>
          Unlimited Vidya sessions, mock exams and full progress reports are now unlocked.
        </p>
        <div style={{ width: '100%', maxWidth: 300 }}>
          <Btn full size="lg" onClick={() => router.push('/student/dashboard')} variant="secondary" style={{ background: '#fff', color: 'var(--primary)', border: 'none' }}>
            Start learning
          </Btn>
        </div>
      </div>
    )
  }

  // --- PAYING ---
  if (phase === 'paying') {
    return (
      <div style={{ ...ROOT_STYLE, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: 32, textAlign: 'center', paddingBottom: 24 }}>
        <div style={{ width: 56, height: 56, borderRadius: 99, border: '4px solid var(--border)', borderTopColor: 'var(--primary)', marginBottom: 24, animation: 'spz-spin 0.8s linear infinite' }} />
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Securely processing...</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          🛡 Razorpay · 256-bit encrypted
        </div>
      </div>
    )
  }

  // Already premium
  if (currentPlan === 'premium') {
    return (
      <div style={{ ...ROOT_STYLE, display: 'flex', flexDirection: 'column', padding: 24 }}>
        <AppHeader title="" back onBack={() => router.back()} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 16 }}>
          <div style={{ fontSize: 52 }}>👑</div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>{"You're already Premium!"}</h1>
          <p style={{ margin: 0, fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.5 }}>Enjoy unlimited access to all Spinzy features.</p>
          <Btn onClick={() => router.push('/student/dashboard')}>Back to dashboard</Btn>
        </div>
      </div>
    )
  }

  const activePlan = PLANS.find(p => p.id === selectedPlan) ?? PLANS[1]

  return (
    <div style={ROOT_STYLE}>
      <div style={{ padding: '8px 16px 0' }}>
        <AppHeader title="" back onBack={() => router.back()} />
      </div>

      {/* Hero */}
      <div style={{ padding: '4px 24px 20px', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: 'oklch(0.80 0.13 88 / 0.16)', color: 'var(--tier-fair)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 32 }}>
          👑
        </div>
        <h1 style={{ margin: '0 0 8px', fontSize: 25, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)' }}>
          Unlock your full potential
        </h1>
        <p style={{ margin: 0, fontSize: 14.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Premium gives unlimited practice, tests, and personalised guidance from Vidya.
        </p>
      </div>

      {/* Session limit warning */}
      {isLocked && (
        <div style={{ padding: '0 16px 16px' }}>
          <div style={{ borderRadius: 16, padding: 16, background: 'var(--tier-critical-soft)', border: '1px solid color-mix(in oklch, var(--tier-critical) 25%, transparent)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>
                {triggerReason === 'session_limit' ? "Today's free sessions" : "Free chapter test used"}
              </span>
              <Mono style={{ fontSize: 13, fontWeight: 700, color: 'var(--tier-critical)' }}>
                {FREE_TIER_SESSION_LIMIT}/{FREE_TIER_SESSION_LIMIT} used
              </Mono>
            </div>
            <Bar value={100} color="var(--tier-critical)" />
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 8 }}>
              Resets at midnight, or go unlimited now ↓
            </div>
          </div>
        </div>
      )}

      {/* Plan selector */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {PLANS.map(p => {
          const on = selectedPlan === p.id
          return (
            <div
              key={p.id}
              onClick={() => setSelectedPlan(p.id)}
              style={{ cursor: 'pointer', borderRadius: 18, padding: 18, background: 'var(--surface)', border: `2px solid ${on ? 'var(--primary)' : 'var(--border)'}`, boxShadow: on ? 'var(--shadow-md)' : 'none', position: 'relative' }}
            >
              {p.save && (
                <span style={{ position: 'absolute', top: -10, right: 16, background: 'var(--tier-strong)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99 }}>
                  {p.save}
                </span>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 24, height: 24, borderRadius: 99, border: `2px solid ${on ? 'var(--primary)' : 'var(--border)'}`, background: on ? 'var(--primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
                  {on && <span style={{ fontSize: 14, lineHeight: 1 }}>✓</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{p.label}</div>
                  {p.perMonth && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.perMonth}, billed yearly</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Mono style={{ fontSize: 20, fontWeight: 700 }}>₹{p.price.toLocaleString('en-IN')}</Mono>
                  <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{p.period}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Features */}
      <div style={{ padding: '20px 24px 0' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Everything included</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {PLAN_FEATURES.map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div style={{ width: 22, height: 22, borderRadius: 99, background: 'var(--tier-strong-soft)', color: 'var(--tier-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, fontWeight: 700 }}>✓</div>
              <span style={{ fontSize: 14, color: 'var(--text)' }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky CTA */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 390, padding: '14px 20px 28px', background: 'color-mix(in oklch, var(--surface) 92%, transparent)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderTop: '1px solid var(--border)' }}>
        <Btn full size="lg" onClick={handlePay}>
          Continue · ₹{activePlan.price.toLocaleString('en-IN')}{activePlan.period}
        </Btn>
        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-faint)', marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          🛡 Secure payment via Razorpay · Cancel anytime
        </div>
      </div>
    </div>
  )
}
