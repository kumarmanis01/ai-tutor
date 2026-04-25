'use client';
import React, { useState } from 'react';
import { toast } from '@/lib/toast';

type Props = { installmentId: string };

const STRINGS: Record<string, any> = {
  en: {
    confirmTitle: 'Retry payment',
    confirmBody:
      'Do you want to retry charging this installment? We will attempt to process the payment immediately.',
    confirmButton: 'Retry now',
    cancelButton: 'Cancel',
    success: 'Retry request submitted. We will attempt to charge the installment shortly.',
    error: 'Could not submit retry request. Please contact support.',
  },
  hi: {
    confirmTitle: 'भुगतान फिर से प्रयास करें',
    confirmBody:
      'क्या आप इस किस्त का भुगतान फिर से करने का प्रयास करना चाहते हैं? हम तुरंत भुगतान करने का प्रयास करेंगे।',
    confirmButton: 'अब पुनः प्रयास करें',
    cancelButton: 'रद्द करें',
    success: 'पुनः प्रयास अनुरोध भेज दिया गया। हम जल्द ही भुगतान करने का प्रयास करेंगे।',
    error: 'पुनः प्रयास अनुरोध भेजा नहीं जा सका। कृपया सहायता से संपर्क करें।',
  },
};

function detectLang() {
  try {
    if (typeof navigator !== 'undefined') {
      const locale =
        navigator.language || (document.documentElement && document.documentElement.lang) || 'en';
      return locale.startsWith('hi') ? 'hi' : 'en';
    }
  } catch {}
  return 'en';
}

export default function RetryInstallmentButton({ installmentId }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const lang = detectLang();
  const t = STRINGS[lang];

  const onConfirm = async () => {
    setLoading(true);
    setOpen(false);
    try {
      const res = await fetch('/api/parent/installment/retry', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ installmentId }),
      });
      const j = await res.json();
      if (j?.success) {
        setBanner({ type: 'success', message: t.success });
        toast(t.success);
      } else {
        setBanner({ type: 'error', message: t.error });
        toast(t.error);
      }
    } catch {
      setBanner({ type: 'error', message: t.error });
      toast(t.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-block rounded-md bg-indigo-600 px-3 py-1 text-white text-xs"
      >
        {t.confirmButton}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          <div className="absolute inset-0 bg-black opacity-40" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-md p-4 max-w-sm w-full" role="document">
            <h3 className="font-semibold text-lg">{t.confirmTitle}</h3>
            <p className="mt-2 text-sm">{t.confirmBody}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3 py-1 rounded bg-gray-100 text-sm"
              >
                {t.cancelButton}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={loading}
                className="px-3 py-1 rounded bg-indigo-600 text-white text-sm"
              >
                {t.confirmButton}
              </button>
            </div>
          </div>
        </div>
      )}

      {banner && (
        <div
          role="status"
          aria-live="polite"
          className={
            banner.type === 'success'
              ? 'mt-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800'
              : 'mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800'
          }
        >
          {banner.message}
        </div>
      )}
    </>
  );
}
