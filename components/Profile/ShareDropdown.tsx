'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/UI/design-system/Button';

type Props = {
  badgeId: string;
  title: string;
  description?: string;
};

const SHARE_LABEL = 'Share';

/**
 * Single share trigger per badge. Opens a popover with share options.
 * Wraps the share logic from ShareBadge without reimplementing it.
 */
export function ShareDropdown({ badgeId, title, description }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open]);

  const shareTextBase = `${title}${description ? ` -- ${description}` : ''}`;

  const trackShare = async (platform: string) => {
    try {
      const { default: analyticsClient } = await import('@/lib/analytics/client');
      const { ANALYTICS_EVENTS } = await import('@/lib/analytics/events');
      analyticsClient.trackEvent({
        eventType: ANALYTICS_EVENTS.STUDENT.BADGE_SHARE_BADGE,
        metadata: { badgeId, badgeTitle: title, platform },
      });
    } catch {
      // analytics failure is non-fatal
    }
  };

  const getShareUrl = async (): Promise<string> => {
    setLoading(true);
    try {
      const res = await fetch('/api/badges/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ badgeId }),
      });
      const data = await res.json().catch(() => ({}));
      return (data as { shareUrl?: string }).shareUrl ?? window.location.href;
    } catch {
      return window.location.href;
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsApp = async () => {
    setOpen(false);
    const shareUrl = await getShareUrl();
    trackShare('whatsapp');
    window.open(`https://wa.me/?text=${encodeURIComponent(`${shareTextBase} ${shareUrl}`)}`, '_blank', 'noopener,noreferrer');
  };

  const handleTwitter = async () => {
    setOpen(false);
    const shareUrl = await getShareUrl();
    trackShare('twitter');
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${shareTextBase} ${shareUrl}`)}`, '_blank', 'noopener,noreferrer');
  };

  const handleFacebook = async () => {
    setOpen(false);
    const shareUrl = await getShareUrl();
    trackShare('facebook');
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareTextBase)}`, '_blank', 'noopener,noreferrer');
  };

  const handleCopyLink = async () => {
    setOpen(false);
    const shareUrl = await getShareUrl();
    trackShare('copy_link');
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // clipboard unavailable -- silent
    }
  };

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        disabled={loading}
      >
        {loading ? 'Loading...' : `${SHARE_LABEL} ▾`}
      </Button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-20 min-w-[160px] rounded-xl border border-border bg-popover shadow-pop py-1"
        >
          <button
            role="menuitem"
            type="button"
            onClick={handleWhatsApp}
            className="w-full text-left px-3 py-2 text-sm text-success hover:bg-success-bg min-h-[44px] flex items-center"
          >
            WhatsApp
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={handleTwitter}
            className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-surface-sunk min-h-[44px] flex items-center"
          >
            X
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={handleFacebook}
            className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-primary-bg min-h-[44px] flex items-center"
          >
            Facebook
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={handleCopyLink}
            className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-surface-sunk min-h-[44px] flex items-center"
          >
            Copy link
          </button>
        </div>
      )}
    </div>
  );
}
