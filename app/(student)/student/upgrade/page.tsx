'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Script from 'next/script'
import { AppHeader, Card, Btn, Bar, Mono } from '@/components/ui'
import { FREE_TIER_SESSION_LIMIT } from '@/lib/constants/freemium'

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay?: any
  }
}

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

// UI plan id -> server canonical plan id used by /api/student/subscription/{order,verify}
const PLAN_ID_MAP: Record<string, string> = {
  monthly: 'standard_monthly',
  annual: 'standard_annual',
}

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

const CONFETTI_COLORS = ['bg-white', 'bg-[var(--tier-fair)]', 'bg-[var(--tier-strong)]', 'bg-[var(--primary-soft)]'] as const

export default function UpgradePage(props: UpgradeProps) {
  const router = useRouter()
  const { triggerReason, currentPlan = 'free' } = props
  const [selectedPlan, setSelectedPlan] = useState('annual')
  const [phase, setPhase] = useState<'plans' | 'paying' | 'success' | 'error'>(
    props.paymentStatus === 'success' ? 'success' : 'plans'
  )
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const isLocked = triggerReason === 'session_limit' || triggerReason === 'test_limit'

  const handlePay = async () => {
    const canonicalPlanId = PLAN_ID_MAP[selectedPlan]
    if (!canonicalPlanId) {
      setErrorMsg('Unknown plan. Please pick a plan and try again.')
      setPhase('error')
      return
    }
    setPhase('paying')
    setErrorMsg(null)
    try {
      const orderRes = await fetch('/api/student/subscription/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: canonicalPlanId }),
      })
      const orderJson = await orderRes.json().catch(() => ({}))
      if (!orderRes.ok || !orderJson?.orderId || !orderJson?.keyId) {
        throw new Error(typeof orderJson?.error === 'string' ? orderJson.error : 'Could not create order')
      }
      if (!window.Razorpay) {
        throw new Error('Payment SDK not loaded. Please refresh and try again.')
      }
      const options = {
        key: orderJson.keyId,
        amount: orderJson.amount,
        currency: orderJson.currency ?? 'INR',
        name: 'Spinzy Academy',
        description: `${selectedPlan === 'annual' ? 'Annual' : 'Monthly'} subscription`,
        order_id: orderJson.orderId,
        theme: { color: '#534AB7' },
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            const verifyRes = await fetch('/api/student/subscription/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                planId: canonicalPlanId,
              }),
            })
            const verifyJson = await verifyRes.json().catch(() => ({}))
            if (!verifyRes.ok || !verifyJson?.success) {
              throw new Error('Verification failed. If you were charged, contact support.')
            }
            setPhase('success')
          } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : 'Payment could not be confirmed.')
            setPhase('error')
          }
        },
        modal: {
          ondismiss: () => {
            // User closed checkout without paying -- return to plan selection.
            setPhase('plans')
          },
        },
      }
      const rz = new window.Razorpay(options)
      rz.open()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Payment failed. Please try again.')
      setPhase('error')
    }
  }

  // --- ERROR ---
  if (phase === 'error') {
    return (
      <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto p-6 flex flex-col">
        <AppHeader title="" back onBack={() => setPhase('plans')} />
        <div className="flex-1 flex flex-col justify-center items-center text-center gap-3">
          <div className="w-16 h-16 rounded-[20px] bg-[var(--tier-critical-soft)] text-[var(--tier-critical)] flex items-center justify-center text-[32px]">!</div>
          <h1 className="text-[22px] font-extrabold text-[var(--text)] m-0">Payment didn't go through</h1>
          <p className="text-[14px] text-[var(--text-muted)] leading-[1.5] m-0 max-w-[300px]">
            {errorMsg ?? 'Please try again, or contact support if you were charged.'}
          </p>
          <Btn onClick={() => setPhase('plans')}>Try again</Btn>
        </div>
      </div>
    )
  }

  // --- SUCCESS ---
  if (phase === 'success') {
    return (
      <div className="min-h-screen max-w-[390px] mx-auto bg-[linear-gradient(170deg,var(--primary),oklch(0.3_0.2_270))] flex flex-col justify-center items-center p-8 text-center relative overflow-hidden">
        {/* Confetti dots -- left position is runtime-computed */}
        {Array.from({ length: 14 }, (_, i) => (
          <div
            key={i}
            className={['absolute top-[-10px] w-2 h-3 rounded-[2px]', CONFETTI_COLORS[i % 4]].join(' ')}
            style={{ left: `${(i * 7 + 5) % 100}%` }}
          />
        ))}
        <div className="w-[100px] h-[100px] rounded-[32px] bg-white/[0.18] flex items-center justify-center mb-6 text-[52px]">
          👑
        </div>
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em] text-white m-0 mb-[10px]">
          {"You're Premium!"}
        </h1>
        <p className="text-[15px] text-white/90 leading-[1.5] max-w-[280px] m-0 mb-7">
          Unlimited Vidya sessions, mock exams and full progress reports are now unlocked.
        </p>
        <div className="w-full max-w-[300px]">
          <Btn full size="lg" onClick={() => router.push('/student/dashboard')} variant="secondary" className="!bg-white !text-[var(--primary)] !border-0">
            Start learning
          </Btn>
        </div>
      </div>
    )
  }

  // --- PAYING ---
  if (phase === 'paying') {
    return (
      <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto flex flex-col justify-center items-center p-8 text-center pb-6">
        <div className="w-14 h-14 rounded-full border-[4px] border-[var(--border)] border-t-[var(--primary)] mb-6 [animation:spz-spin_0.8s_linear_infinite]" />
        <div className="text-[16px] font-bold text-[var(--text)]">Securely processing...</div>
        <div className="text-[13px] text-[var(--text-muted)] mt-[6px] flex items-center gap-[6px]">
          🛡 Razorpay · 256-bit encrypted
        </div>
      </div>
    )
  }

  // Already premium
  if (currentPlan === 'premium') {
    return (
      <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto pb-[110px] flex flex-col p-6">
        <AppHeader title="" back onBack={() => router.back()} />
        <div className="flex-1 flex flex-col justify-center items-center text-center gap-4">
          <div className="text-[52px]">👑</div>
          <h1 className="text-[24px] font-extrabold text-[var(--text)] m-0">{"You're already Premium!"}</h1>
          <p className="text-[15px] text-[var(--text-muted)] leading-[1.5] m-0">Enjoy unlimited access to all Spinzy features.</p>
          <Btn onClick={() => router.push('/student/dashboard')}>Back to dashboard</Btn>
        </div>
      </div>
    )
  }

  const activePlan = PLANS.find(p => p.id === selectedPlan) ?? PLANS[1]

  return (
    <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto pb-[110px]">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <div className="px-4 pt-2">
        <AppHeader title="" back onBack={() => router.back()} />
      </div>

      {/* Hero */}
      <div className="px-6 pb-5 text-center">
        <div className="w-16 h-16 rounded-[20px] bg-[oklch(0.80_0.13_88_/_0.16)] text-[var(--tier-fair)] flex items-center justify-center mx-auto mb-[14px] text-[32px]">
          👑
        </div>
        <h1 className="text-[25px] font-extrabold tracking-[-0.03em] text-[var(--text)] m-0 mb-2">
          Unlock your full potential
        </h1>
        <p className="text-[14.5px] text-[var(--text-muted)] leading-[1.5] m-0">
          Premium gives unlimited practice, tests, and personalised guidance from Vidya.
        </p>
      </div>

      {/* Session limit warning */}
      {isLocked && (
        <div className="px-4 pb-4">
          <div className="rounded-[16px] p-4 bg-[var(--tier-critical-soft)] border border-[color-mix(in_oklch,var(--tier-critical)_25%,transparent)]">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[13.5px] font-bold text-[var(--text)]">
                {triggerReason === 'session_limit' ? "Today's free sessions" : "Free chapter test used"}
              </span>
              <Mono className="text-[13px] font-bold text-[var(--tier-critical)]">
                {FREE_TIER_SESSION_LIMIT}/{FREE_TIER_SESSION_LIMIT} used
              </Mono>
            </div>
            <Bar value={100} color="var(--tier-critical)" />
            <div className="text-[12.5px] text-[var(--text-muted)] mt-2">
              Resets at midnight, or go unlimited now ↓
            </div>
          </div>
        </div>
      )}

      {/* Plan selector */}
      <div className="px-4 flex flex-col gap-3">
        {PLANS.map(p => {
          const on = selectedPlan === p.id
          return (
            <div
              key={p.id}
              onClick={() => setSelectedPlan(p.id)}
              className={[
                'cursor-pointer rounded-[18px] p-[18px] bg-[var(--surface)] relative border-2',
                on ? 'border-[var(--primary)] shadow-[var(--shadow-md)]' : 'border-[var(--border)]',
              ].join(' ')}
            >
              {p.save && (
                <span className="absolute top-[-10px] right-4 bg-[var(--tier-strong)] text-white text-[11px] font-bold px-[10px] py-[3px] rounded-full">
                  {p.save}
                </span>
              )}
              <div className="flex items-center gap-3">
                <div className={[
                  'w-6 h-6 rounded-full border-2 flex items-center justify-center text-white shrink-0',
                  on ? 'border-[var(--primary)] bg-[var(--primary)]' : 'border-[var(--border)] bg-transparent',
                ].join(' ')}>
                  {on && <span className="text-[14px] leading-none">✓</span>}
                </div>
                <div className="flex-1">
                  <div className="text-[15px] font-bold text-[var(--text)]">{p.label}</div>
                  {p.perMonth && <div className="text-[12px] text-[var(--text-muted)]">{p.perMonth}, billed yearly</div>}
                </div>
                <div className="text-right">
                  <Mono className="text-[20px] font-bold">₹{p.price.toLocaleString('en-IN')}</Mono>
                  <div className="text-[11.5px] text-[var(--text-faint)]">{p.period}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Features */}
      <div className="px-6 pt-5">
        <div className="text-[12px] font-bold text-[var(--text-muted)] uppercase tracking-[0.05em] mb-3">Everything included</div>
        <div className="flex flex-col gap-[11px]">
          {PLAN_FEATURES.map(f => (
            <div key={f} className="flex items-center gap-[11px]">
              <div className="w-[22px] h-[22px] rounded-full bg-[var(--tier-strong-soft)] text-[var(--tier-strong)] flex items-center justify-center shrink-0 text-[12px] font-bold">✓</div>
              <span className="text-[14px] text-[var(--text)]">{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] px-5 pt-[14px] pb-7 bg-[color-mix(in_oklch,var(--surface)_92%,transparent)] backdrop-blur-[16px] border-t border-[var(--border)]">
        <Btn full size="lg" onClick={handlePay}>
          Continue · ₹{activePlan.price.toLocaleString('en-IN')}{activePlan.period}
        </Btn>
        <div className="text-center text-[11px] text-[var(--text-faint)] mt-2 flex items-center justify-center gap-[5px]">
          🛡 Secure payment via Razorpay · Cancel anytime
        </div>
      </div>
    </div>
  )
}
