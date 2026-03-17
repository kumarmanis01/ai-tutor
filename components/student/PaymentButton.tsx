'use client'

import React, { useCallback, useState } from 'react'
import Script from 'next/script'

declare global {
  interface Window {
    Razorpay?: any
  }
}

interface PaymentButtonProps {
  planMonths?: number
  studentName?: string | null
  studentEmail?: string | null
  onSuccess: () => void
  onFailure: () => void
}

export function PaymentButton({
  planMonths = 1,
  studentName,
  studentEmail,
  onSuccess,
  onFailure,
}: PaymentButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sdkReady, setSdkReady] = useState(false)

  const handleClick = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planMonths }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.orderId || !json?.keyId) {
        throw new Error(typeof json?.error === 'string' ? json.error : 'Could not start payment')
      }

      if (!window.Razorpay) {
        throw new Error('Payment SDK not loaded')
      }

      const { orderId, amount, keyId } = json as {
        orderId: string
        amount: number
        keyId: string
      }

      const options = {
        key: keyId,
        amount,
        currency: 'INR',
        name: 'Spinzy Academy',
        description: '₹99/month — Unlimited Sessions',
        image: 'https://spinzy.in/logos/logo-razorpay.png',
        order_id: orderId,
        prefill: {
          name: studentName ?? '',
          email: studentEmail ?? '',
        },
        theme: { color: '#F97316' },
        handler: async (response: any) => {
          try {
            const verifyRes = await fetch('/api/payments/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              }),
            })
            const verifyJson = await verifyRes.json().catch(() => ({}))
            if (!verifyRes.ok || !verifyJson?.success) {
              throw new Error(typeof verifyJson?.error === 'string' ? verifyJson.error : 'Verification failed')
            }
            onSuccess()
          } catch {
            setError('Payment verification failed. Please contact support if you were charged.')
            onFailure()
          } finally {
            setLoading(false)
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false)
            onFailure()
          },
        },
      }

      const rz = new window.Razorpay(options)
      rz.open()
    } catch (error) {
      const err = error as Error
      setError(err.message || 'Payment failed. Please try again.')
      setLoading(false)
      onFailure()
    }
  }, [planMonths, studentName, studentEmail, onSuccess, onFailure])

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
        onLoad={() => setSdkReady(true)}
      />
      <div className="space-y-2">
        <button
          type="button"
          onClick={handleClick}
          disabled={loading || !sdkReady}
          className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {loading ? 'Processing…' : 'Upgrade for ₹99/month'}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </>
  )
}

export default PaymentButton

