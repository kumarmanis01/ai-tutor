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
    <div style={{ background: 'var(--bg)', minHeight: '100vh', maxWidth: 390, margin: '0 auto', paddingBottom: 32 }}>
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '16px 16px 14px' }}>
        <div style={{ height: 24, width: 100, borderRadius: 8, background: 'var(--surface-3)' }} />
      </div>
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
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
    <div style={{ background: 'var(--bg)', minHeight: '100vh', maxWidth: 390, margin: '0 auto', padding: 16 }}>
      <ErrorState title="Could not load billing" body="Please check your connection and try again." onRetry={() => {}} />
    </div>
  )

  const emiFailed = data.emiStatus === 'failed'

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', maxWidth: 390, margin: '0 auto', paddingBottom: 32 }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '16px 16px 14px' }}>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)' }}>Billing</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Plan and payment history</div>
      </div>

      <div style={{ padding: '14px 16px 24px' }}>
        {/* Active plan card */}
        <div style={{ borderRadius: 20, padding: 18, background: 'linear-gradient(135deg, var(--brand-600, #4338ca), var(--brand-800, #312e81))', color: '#fff', marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: -16, top: -16, opacity: 0.14 }}>
            <CrownIcon size={100} />
          </div>
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Active plan</div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 14 }}>{data.currentPlan}</div>
            <div style={{ display: 'flex', gap: 24 }}>
              <div>
                <div style={{ fontSize: 11, opacity: 0.8 }}>Monthly</div>
                <Mono style={{ fontSize: 16, fontWeight: 700 }}>{formatINR(data.planPrice)}</Mono>
              </div>
              {data.nextBillingDate && (
                <div>
                  <div style={{ fontSize: 11, opacity: 0.8 }}>Next billing</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>
                    {data.nextBillingDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* EMI failed banner */}
        {emiFailed && (
          <Card pad={16} style={{ marginBottom: 16, border: '1.5px solid var(--tier-critical)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <AlertIcon size={18} style={{ color: 'var(--tier-critical)', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Payment could not be processed</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
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
          <Card pad={14} style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <ClockIcon size={20} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>EMI plan active</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Split into 3 monthly instalments of {formatINR(data.failedAmount ?? 133)}</div>
            </div>
            <CheckCircleIcon size={18} style={{ color: 'var(--tier-strong)' }} />
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
          <Card pad={0} style={{ overflow: 'hidden' }}>
            {data.billingHistory.map((inv, i) => {
              const st = STATUS_STYLE[inv.status]
              return (
                <div
                  key={inv.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderBottom: i < data.billingHistory.length - 1 ? '1px solid var(--border)' : 'none' }}
                >
                  <CardIcon size={19} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{inv.description}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 8 }}>
                      <Mono style={{ fontWeight: 600 }}>{formatINR(inv.amount)}</Mono>
                      <span>{inv.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: st.color, background: st.bg, padding: '3px 9px', borderRadius: 99 }}>
                    {st.label}
                  </span>
                  {inv.status === 'paid' && (
                    <button
                      aria-label="Download invoice"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: 6, minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
