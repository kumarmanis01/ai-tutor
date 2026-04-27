/**
 * FILE OBJECTIVE:
 * - Provide Explore Mode settings actions for reminder resend, contact change, and request cancellation.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/explore/ExploreSettings.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T00:00:00Z | copilot | created Explore Mode settings panel with resend/change/cancel actions
 */

'use client';

import { useMemo, useState } from 'react';

interface Props {
  studentId: string | null;
  consentToken: string;
  sentTo: string | null;
  expiresAt: string | null;
  channel: string | null;
  onTokenRotate: (nextToken: string) => void;
  onRequestCancelled: () => void;
}

export default function ExploreSettings({
  studentId,
  consentToken,
  sentTo,
  expiresAt,
  channel,
  onTokenRotate,
  onRequestCancelled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [newChannel, setNewChannel] = useState<'whatsapp' | 'email'>(
    channel === 'EMAIL' ? 'email' : 'whatsapp'
  );
  const [newContact, setNewContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const expiryLabel = useMemo(() => {
    if (!expiresAt) return 'N/A';
    return new Date(expiresAt).toLocaleString('en-IN', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }, [expiresAt]);

  async function sendReminder() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/consent/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-fingerprint': navigator.userAgent,
        },
        body: JSON.stringify({ consent_token: consentToken }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(payload.error ?? 'Unable to send reminder.');
        return;
      }
      setMessage('Reminder sent.');
    } catch {
      setMessage('Network error while sending reminder.');
    } finally {
      setBusy(false);
    }
  }

  async function changeContact() {
    if (!newContact.trim()) {
      setMessage('Please enter a new contact.');
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/consent/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-fingerprint': navigator.userAgent,
        },
        body: JSON.stringify({
          consent_token: consentToken,
          new_channel: newChannel,
          new_contact: newContact.trim(),
        }),
      });
      const payload = (await response.json()) as { consent_token?: string; error?: string };
      if (!response.ok || !payload.consent_token) {
        setMessage(payload.error ?? 'Unable to update contact.');
        return;
      }

      onTokenRotate(payload.consent_token);
      setEditing(false);
      setNewContact('');
      setMessage('Contact updated and new request sent.');
    } catch {
      setMessage('Network error while changing contact.');
    } finally {
      setBusy(false);
    }
  }

  async function cancelRequest() {
    if (!studentId) {
      setMessage('Missing student ID for cancellation.');
      return;
    }

    const confirmed = window.confirm(
      'Are you sure? Your profile and local diagnostic result will be deleted.'
    );
    if (!confirmed) {
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/v1/students/${encodeURIComponent(studentId)}?consent_token=${encodeURIComponent(consentToken)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setMessage(payload.error ?? 'Unable to cancel request.');
        return;
      }

      onRequestCancelled();
    } catch {
      setMessage('Network error while cancelling request.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-4 mt-4">
      <button
        type="button"
        className="min-h-[44px] rounded-xl px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm font-semibold"
        onClick={() => setOpen((prev) => !prev)}
      >
        Settings
      </button>

      {open && (
        <div className="mt-3 rounded-2xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
          <p className="text-xs text-gray-600 dark:text-gray-300">Current contact: {sentTo ?? 'N/A'}</p>
          <p className="text-xs text-gray-600 dark:text-gray-300">Request expires: {expiryLabel}</p>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void sendReminder();
              }}
              className="min-h-[40px] px-3 rounded-lg bg-[#EEEDFE] text-[#534AB7] text-xs font-semibold disabled:opacity-50"
            >
              Send Reminder
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing((prev) => !prev)}
              className="min-h-[40px] px-3 rounded-lg bg-[#FAEEDA] text-[#BA7517] text-xs font-semibold disabled:opacity-50"
            >
              Change Contact
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void cancelRequest();
              }}
              className="min-h-[40px] px-3 rounded-lg bg-[#FCEBEB] text-[#E24B4A] text-xs font-semibold disabled:opacity-50"
            >
              Cancel Request
            </button>
          </div>

          {editing && (
            <div className="rounded-xl border border-gray-200 dark:border-slate-700 p-3 space-y-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`min-h-[36px] px-2 rounded-md text-xs ${newChannel === 'whatsapp' ? 'bg-[#534AB7] text-white' : 'bg-gray-100 dark:bg-slate-700'}`}
                  onClick={() => setNewChannel('whatsapp')}
                >
                  WhatsApp
                </button>
                <button
                  type="button"
                  className={`min-h-[36px] px-2 rounded-md text-xs ${newChannel === 'email' ? 'bg-[#534AB7] text-white' : 'bg-gray-100 dark:bg-slate-700'}`}
                  onClick={() => setNewChannel('email')}
                >
                  Email
                </button>
              </div>

              <input
                type={newChannel === 'email' ? 'email' : 'text'}
                value={newContact}
                onChange={(event) => setNewContact(event.target.value)}
                placeholder={newChannel === 'email' ? 'parent@example.com' : '+919876543210'}
                className="w-full min-h-[40px] rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-sm"
              />

              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  void changeContact();
                }}
                className="min-h-[40px] px-3 rounded-md bg-[#534AB7] text-white text-xs font-semibold disabled:opacity-50"
              >
                Save & Send New Request
              </button>
            </div>
          )}

          {message && <p className="text-xs text-gray-600 dark:text-gray-300">{message}</p>}
        </div>
      )}
    </div>
  );
}
