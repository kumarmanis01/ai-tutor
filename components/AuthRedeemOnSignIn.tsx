'use client';
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function AuthRedeemOnSignIn() {
  const params = useSearchParams();

  useEffect(() => {
    const ref = params.get('ref');
    if (!ref) return;
    // call redeem API (user must be signed in already)
    fetch('/api/referral/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: ref }),
    }).catch(() => {});
  }, [params]);

  return null;
}
