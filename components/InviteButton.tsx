'use client';
import { logger } from '@/lib/logger';
import { useState } from 'react';

type CreateResponse = {
  url?: string;
  code?: string;
  error?: string;
};

export default function InviteButton() {
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const create = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/referral/create', { method: 'POST' });
      const raw = await res.json().catch(() => ({}) as unknown);
      const data = raw as CreateResponse;

      if (data?.url) {
        setLink(data.url);
        try {
          await navigator.clipboard.writeText(data.url);
        } catch {
          // ignore clipboard errors
        }
      } else {
        logger.warn('Unexpected response from /api/referral/create', { className: 'InviteButton', methodName: 'createReferral', data });
      }
    } finally {
      setLoading(false);
    }
  };

  const share = async () => {
    if (!link) return;
    const text = `Join me on Spinzy Academy — get AI tutoring help. Sign up: ${link}`;

    if (
      typeof navigator !== 'undefined' &&
      'share' in navigator &&
      typeof navigator.share === 'function'
    ) {
      try {
        await navigator.share({ title: 'Join Spinzy Academy', text, url: link });
        return;
      } catch {
        // user cancelled or share failed — fall back to web share links
      }
    }

    const twitter = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitter, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex gap-2 items-center">
      <button
        onClick={create}
        className="px-3 py-1 rounded bg-indigo-600 text-white disabled:opacity-70"
        disabled={loading}
      >
        {loading ? 'Creating...' : link ? 'Regenerate' : 'Create Invite'}
      </button>

      <button
        onClick={share}
        className="px-3 py-1 rounded bg-green-600 text-white disabled:opacity-70"
        disabled={!link}
      >
        Share
      </button>

      {link && (
        <input
          readOnly
          value={link}
          className="ml-2 px-2 py-1 rounded border w-80 bg-gray-50 dark:bg-gray-800 text-sm"
        />
      )}
    </div>
  );
}
