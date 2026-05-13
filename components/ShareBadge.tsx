'use client';
/**
 * FILE OBJECTIVE:
 * - Render badge share actions and track share intent before opening external share channels.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/ShareBadge.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-10T00:00:00Z | copilot | add responsive wrap-safe layout and accessibility sizing to prevent profile badge share UI bleed
 * - 2026-05-13T00:00:00Z | copilot | emit badge share and share-platform analytics for share actions
 */

import { useState } from 'react';
import { logger } from '@/lib/logger';
import analyticsClient from '@/lib/analytics/client';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';

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

  const shareTextBase = `${title}${description ? ` -- ${description}` : ''}`;

  const trackShare = (platform: string) => {
    try {
      analyticsClient.trackEvent({
        eventType: ANALYTICS_EVENTS.STUDENT.BADGE_SHARE_BADGE,
        metadata: { badgeId, badgeTitle: title, platform },
      });
      analyticsClient.trackEvent({
        eventType: ANALYTICS_EVENTS.STUDENT.BADGE_SHARE_PLATFORM,
        metadata: { badgeId, platform },
      });
    } catch (err) {
      logger.warn('share analytics emit failed', { component: 'ShareBadge', badgeId, platform, error: String(err) });
    }
  };

  const recordAndGetShareUrl = async (): Promise<string> => {
    setLoading(true);
    try {
      const res = await fetch('/api/badges/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ badgeId }),
      });
      const raw = await res.json().catch((e) => { logger.warn('badges/share response.json failed', { component: 'ShareBadge', error: e }); return {} as unknown });
      const data = raw as ShareResponse;
      return data.shareUrl ?? url ?? window.location.href;
    } catch (err) {
      logger.warn('recordAndGetShareUrl failed', { component: 'ShareBadge', methodName: 'recordAndGetShareUrl', error: String(err) });
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
        trackShare('web_share');
        return;
      } catch (e) {
        logger.warn('navigator.share failed', { component: 'ShareBadge', error: e });
        // user cancelled or share failed -- fallback below
      }
    }
    const twitter = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    trackShare('twitter');
    window.open(twitter, '_blank', 'noopener,noreferrer');
  };

  const waLink = (shareUrl: string) =>
    `https://wa.me/?text=${encodeURIComponent(`${shareTextBase} ${shareUrl}`)}`;
  const fbLink = (shareUrl: string) =>
    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareTextBase)}`;
  const twitterLink = (shareUrl: string) =>
    `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${shareTextBase} ${shareUrl}`)}`;

  return (
    <div className="flex w-full max-w-full flex-wrap items-center gap-2 sm:w-auto" data-testid="share-badge-actions">
      <button
        onClick={handleWebShare}
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-70"
        disabled={loading}
      >
        {loading ? 'Sharing...' : 'Share'}
      </button>

      <a
        href={waLink(url ?? window.location.href)}
        target="_blank"
        rel="noreferrer"
        onClick={() => trackShare('whatsapp')}
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-3 py-2 rounded bg-green-500 text-white"
      >
        WhatsApp
      </a>

      <a
        href={twitterLink(url ?? window.location.href)}
        target="_blank"
        rel="noreferrer"
        onClick={() => trackShare('twitter')}
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-3 py-2 rounded bg-sky-500 text-white"
      >
        Twitter
      </a>

      <a
        href={fbLink(url ?? window.location.href)}
        target="_blank"
        rel="noreferrer"
        onClick={() => trackShare('facebook')}
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-3 py-2 rounded bg-blue-800 text-white"
      >
        Facebook
      </a>
    </div>
  );
}
