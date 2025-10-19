'use client';
import { useState } from 'react';

type ShareResponse = {
  ok?: boolean;
  shareUrl?: string;
  error?: string;
};

type Props = {
  badgeId: string;
  title: string;
  description?: string;
  url?: string;
};

export default function ShareBadge({ badgeId, title, description, url }: Props) {
  const [loading, setLoading] = useState(false);

  const shareTextBase = `${title}${description ? ` — ${description}` : ''}`;

  const recordAndGetShareUrl = async (): Promise<string> => {
    setLoading(true);
    try {
      const res = await fetch('/api/badges/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ badgeId }),
      });
      const raw = await res.json().catch(() => ({}) as unknown);
      const data = raw as ShareResponse;
      return data.shareUrl ?? url ?? window.location.href;
    } catch {
      return url ?? window.location.href;
    } finally {
      setLoading(false);
    }
  };

  const handleWebShare = async () => {
    const shareUrl = await recordAndGetShareUrl();
    const text = `${shareTextBase} ${shareUrl}`;
    if (
      typeof navigator !== 'undefined' &&
      'share' in navigator &&
      typeof navigator.share === 'function'
    ) {
      try {
        await navigator.share({ title: 'Spinzy Achievement', text, url: shareUrl });
        return;
      } catch {
        // user cancelled or share failed — fallback below
      }
    }
    const twitter = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitter, '_blank', 'noopener,noreferrer');
  };

  const waLink = (shareUrl: string) =>
    `https://wa.me/?text=${encodeURIComponent(`${shareTextBase} ${shareUrl}`)}`;
  const fbLink = (shareUrl: string) =>
    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareTextBase)}`;
  const twitterLink = (shareUrl: string) =>
    `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${shareTextBase} ${shareUrl}`)}`;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleWebShare}
        className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-70"
        disabled={loading}
      >
        {loading ? 'Sharing...' : 'Share'}
      </button>

      <a
        href={waLink(url ?? window.location.href)}
        target="_blank"
        rel="noreferrer"
        className="px-3 py-1 rounded bg-green-500 text-white"
      >
        WhatsApp
      </a>

      <a
        href={twitterLink(url ?? window.location.href)}
        target="_blank"
        rel="noreferrer"
        className="px-3 py-1 rounded bg-sky-500 text-white"
      >
        Twitter
      </a>

      <a
        href={fbLink(url ?? window.location.href)}
        target="_blank"
        rel="noreferrer"
        className="px-3 py-1 rounded bg-blue-800 text-white"
      >
        Facebook
      </a>
    </div>
  );
}
