'use client'
import React, { useState } from 'react'
import {
  Card, Btn, EmptyState, ErrorState, SkeletonCard,
  SectionTitle, Mono,
  CrownIcon, CardIcon, CheckCircleIcon, AlertIcon, ClockIcon, DownloadIcon, RefreshIcon,
} from '@/components/ui'

type PaymentStatus = 'paid' | 'pending' | 'failed'
type EmiStatus = 'active' | 'failed' | null

interface BillingRecord {
  id: string
  amount: number
  date: Date
  status: PaymentStatus
  description: string
}

interface PaymentData {
  currentPlan: string
  planPrice: number
  nextBillingDate?: Date
  billingHistory: BillingRecord[]
  emiStatus?: EmiStatus
  failedAmount?: number
  isLoading?: boolean
  error?: string | null
}

const STATUS_STYLE: Record<PaymentStatus, { bg: string; color: string; label: string }> = {
  paid:    { bg: 'var(--tier-strong-soft)', color: 'var(--tier-strong)', label: 'Paid' },
  pending: { bg: 'var(--tier-fair-soft)',   color: 'var(--tier-fair)',   label: 'Pending' },
  failed:  { bg: 'var(--tier-critical-soft)', color: 'var(--tier-critical)', label: 'Failed' },
}

function LoadingState() {
  return (
    <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto pb-8">
      <div className="bg-[var(--surface)] border-b border-[var(--border)] px-4 pt-4 pb-[14px]">
        <div className="h-6 w-[100px] rounded-lg bg-[var(--surface-3)]" />
      </div>
      <div className="px-4 pt-[14px] flex flex-col gap-3">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  )
}

function formatINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`
}

// --- DEMO DATA ---
const DEMO: PaymentData = {
  currentPlan: 'Spinzy Premium',
  planPrice: 399,
  nextBillingDate: new Date(Date.now() + 15 * 86400000),
  emiStatus: 'active',
  failedAmount: 133,
  billingHistory: [
    { id: 'inv1', amount: 133, date: new Date(Date.now() - 30 * 86400000), status: 'paid', description: 'Premium · Instalment 1/3' },
    { id: 'inv2', amount: 133, date: new Date(Date.now() - 60 * 86400000), status: 'paid', description: 'Premium · Instalment 2/3' },
    { id: 'inv3', amount: 133, date: new Date(Date.now() - 90 * 86400000), status: 'paid', description: 'Premium · Instalment 3/3' },
    { id: 'inv4', amount: 399, date: new Date(Date.now() - 120 * 86400000), status: 'paid', description: 'Premium · Monthly' },
  ],
}

export default function ParentPaymentsPage() {
  const [isLoading] = useState(false)
  const [error] = useState<string | null>(null)
  const data = DEMO

  if (isLoading) return <LoadingState />
  if (error) return (
    <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto p-4">
      <ErrorState title="Could not load billing" body="Please check your connection and try again." onRetry={() => {}} />
    </div>
  )

  const emiFailed = data.emiStatus === 'failed'

  return (
    <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto pb-8">
      {/* Header */}
      <div className="bg-[var(--surface)] border-b border-[var(--border)] px-4 pt-4 pb-[14px]">
        <div className="text-[18px] font-extrabold tracking-[-0.02em] text-[var(--text)]">Billing</div>
        <div className="text-[12px] text-[var(--text-muted)] mt-[2px]">Plan and payment history</div>
      </div>

      <div className="px-4 pt-[14px] pb-6">
        {/* Active plan card */}
        <div className="rounded-[20px] p-[18px] [background:linear-gradient(135deg,var(--brand-600,#4338ca),var(--brand-800,#312e81))] text-white mb-4 relative overflow-hidden">
          <div className="absolute right-[-16px] top-[-16px] opacity-[0.14]">
            <CrownIcon size={100} />
          </div>
          <div className="relative">
            <div className="text-[11px] opacity-[0.85] font-bold uppercase tracking-[0.06em] mb-1">Active plan</div>
            <div className="text-[22px] font-extrabold tracking-[-0.02em] mb-[14px]">{data.currentPlan}</div>
            <div className="flex gap-6">
              <div>
                <div className="text-[11px] opacity-[0.8]">Monthly</div>
                <Mono className="text-[16px] font-bold">{formatINR(data.planPrice)}</Mono>
              </div>
              {data.nextBillingDate && (
                <div>
                  <div className="text-[11px] opacity-[0.8]">Next billing</div>
                  <div className="text-[14px] font-bold">
                    {data.nextBillingDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* EMI failed banner */}
        {emiFailed && (
          <Card pad={16} className="mb-4 border-[1.5px] border-[var(--tier-critical)]">
            <div className="flex items-center gap-[10px] mb-[10px]">
              <AlertIcon size={18} className="text-[var(--tier-critical)] shrink-0" />
              <div>
                <div className="text-[14px] font-bold text-[var(--text)]">Payment could not be processed</div>
                <div className="text-[12px] text-[var(--text-muted)]">
                  Your {data.failedAmount ? formatINR(data.failedAmount) : ''} instalment was declined. Retry to keep Premium active.
                </div>
              </div>
            </div>
            <Btn variant="danger" full size="sm" icon={<RefreshIcon size={16} />} onClick={() => {}}>
              Retry payment {data.failedAmount ? `· ${formatINR(data.failedAmount)}` : ''}
            </Btn>
          </Card>
        )}

        {/* EMI active info */}
        {data.emiStatus === 'active' && !emiFailed && (
          <Card pad={14} className="mb-4 flex items-center gap-3">
            <ClockIcon size={20} className="text-[var(--text-muted)] shrink-0" />
            <div className="flex-1">
              <div className="text-[13px] font-semibold text-[var(--text)]">EMI plan active</div>
              <div className="text-[12px] text-[var(--text-muted)]">Split into 3 monthly instalments of {formatINR(data.failedAmount ?? 133)}</div>
            </div>
            <CheckCircleIcon size={18} className="text-[var(--tier-strong)]" />
          </Card>
        )}

        {/* Payment history */}
        <SectionTitle>Payment history</SectionTitle>
        {data.billingHistory.length === 0 ? (
          <EmptyState
            icon="doc"
            title="No payments yet"
            body="Your billing history will appear here once your first payment is processed."
            action="Upgrade plan"
            onAction={() => {}}
          />
        ) : (
          <Card pad={0} className="overflow-hidden">
            {data.billingHistory.map((inv, i) => {
              const st = STATUS_STYLE[inv.status]
              return (
                <div
                  key={inv.id}
                  className={['flex items-center gap-3 p-[14px]', i < data.billingHistory.length - 1 ? 'border-b border-[var(--border)]' : ''].join(' ')}
                >
                  <CardIcon size={19} className="text-[var(--text-faint)] shrink-0" />
                  <div className="flex-1">
                    <div className="text-[14px] font-semibold text-[var(--text)]">{inv.description}</div>
                    <div className="text-[12px] text-[var(--text-muted)] flex gap-2">
                      <Mono className="font-semibold">{formatINR(inv.amount)}</Mono>
                      <span>{inv.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>
                  <span
                    className="text-[11px] font-bold px-[9px] py-[3px] rounded-full"
                    style={{ color: st.color, background: st.bg }}
                  >
                    {st.label}
                  </span>
                  {inv.status === 'paid' && (
                    <button
                      aria-label="Download invoice"
                      className="bg-transparent border-0 cursor-pointer text-[var(--primary)] p-[6px] min-h-[44px] min-w-[44px] flex items-center justify-center"
                      onClick={() => {}}
                    >
                      <DownloadIcon size={18} />
                    </button>
                  )}
                </div>
              )
            })}
          </Card>
        )}
      </div>
    </div>
  )
}
