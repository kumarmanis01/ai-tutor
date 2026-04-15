'use client';

/**
 * FILE OBJECTIVE:
 * - Small client widget to list and manage saved payment methods for the current user.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/SavedPaymentMethods.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-09T00:00:00Z | copilot | added SavedPaymentMethods UI component
 */

import React, { useEffect, useState } from 'react';
import { logger } from '@/lib/logger'

type Method = {
  id: string;
  provider: string;
  providerPaymentMethodId?: string | null;
  type: string;
  last4?: string | null;
  cardBrand?: string | null;
  expiryMonth?: number | null;
  expiryYear?: number | null;
  isDefault: boolean;
  verified: boolean;
};

export default function SavedPaymentMethods() {
  const [methods, setMethods] = useState<Method[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/payments/methods');
      if (!res.ok) throw new Error('Failed to load');
      const j = await res.json();
      setMethods(j.methods ?? []);
    } catch (err) {
      logger.debug('SavedPaymentMethods: failed to load methods', { error: String(err) })
      setMethods([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleVerify(id: string) {
    setActionLoading(id);
    try {
      const res = await fetch('/api/payments/methods/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ methodId: id }) });
      if (!res.ok) throw new Error('verify-failed');
      await load();
    } catch (err) {
      logger.debug('SavedPaymentMethods: verify failed', { methodId: id, error: String(err) })
      await load();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSetDefault(m: Method) {
    setActionLoading(m.id);
    try {
      await fetch('/api/payments/methods', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ providerPaymentMethodId: m.providerPaymentMethodId, isDefault: true }) });
      await load();
    } catch (err) {
      logger.debug('SavedPaymentMethods: set default failed', { methodId: m.id, error: String(err) })
      await load();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(id: string) {
    setActionLoading(id);
    try {
      await fetch(`/api/payments/methods?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      logger.debug('SavedPaymentMethods: delete failed', { methodId: id, error: String(err) })
      await load();
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) return <div className="text-sm text-gray-500">Loading saved payment methods...</div>;
  if (!methods || methods.length === 0) return <div className="text-sm text-gray-500">No saved payment methods.</div>;

  return (
    <div className="space-y-3">
      {methods.map((m) => (
        <div key={m.id} className="flex items-center justify-between p-3 border rounded-lg">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="text-sm font-medium">{m.cardBrand ?? m.type}</div>
              {m.last4 && <div className="text-xs text-gray-500">•••• {m.last4}</div>}
              {m.isDefault && <div className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded ml-2">Default</div>}
              {!m.verified && <div className="text-xs text-amber-800 bg-amber-50 px-2 py-0.5 rounded ml-2">Unverified</div>}
            </div>
            <div className="text-xs text-gray-500">{m.expiryMonth && m.expiryYear ? `Exp ${m.expiryMonth}/${String(m.expiryYear).slice(-2)}` : ''}</div>
          </div>
          <div className="flex items-center gap-2">
            {!m.verified && (
              <button disabled={!!actionLoading} onClick={() => handleVerify(m.id)} className="text-sm px-3 py-1 rounded bg-[#534AB7] text-white">{actionLoading === m.id ? 'Verifying...' : 'Verify'}</button>
            )}
            {!m.isDefault && (
              <button disabled={!!actionLoading} onClick={() => handleSetDefault(m)} className="text-sm px-3 py-1 rounded border">Set default</button>
            )}
            <button disabled={!!actionLoading} onClick={() => handleDelete(m.id)} className="text-sm px-3 py-1 rounded text-red-600 border">Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}
