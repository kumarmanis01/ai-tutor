'use client';
/**
 * FILE OBJECTIVE:
 * - Sidebar widgets shown on student profile and rooms pages. Includes badges, leaderboard and weekly challenge widgets.
 * - Adds a "Manage Showcase" modal to let students curate up to 5 badges to show in their profile.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/ProfileWidgets.showcase.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-18T00:00:00Z | copilot | add Manage Showcase modal and save to preferences.badgeShowcase
 * - 2026-05-10T00:00:00Z | copilot | prevent badge action overflow by using responsive row layout and container overflow guards
 */

import React, { useEffect, useMemo, useState } from 'react';
import InviteButton from '@/components/InviteButton';
import Leaderboard from '@/components/Leaderboard';
import WeeklyChallenge from '@/components/WeeklyChallenge';
import { ShareDropdown } from '@/components/Profile/ShareDropdown';
import AuthRedeemOnSignIn from '@/components/AuthRedeemOnSignIn';
import BadgeIcon, { BADGE_ACCENT } from '@/components/UI/design-system/BadgeIcon';

export type BadgeView = {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
};

type Props = {
  badges?: BadgeView[];
  showLeaderboard?: boolean;
  showChallenge?: boolean;
};

export default function ProfileWidgets({
  badges,
  showLeaderboard = true,
  showChallenge = true,
}: Props) {
  const [prefs, setPrefs] = useState<any>(null);
  const [showManage, setShowManage] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/user/profile', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;
        const existingPrefs = (data && data.preferences) || {};
        setPrefs(existingPrefs);
        const initial = Array.isArray(existingPrefs.badgeShowcase)
          ? (existingPrefs.badgeShowcase as string[]).filter((id) => (badges ?? []).some((b) => b.id === id))
          : [];
        setSelected(initial);
      } catch {
        // silent
      }
    })();
    return () => {
      mounted = false;
    };
  }, [badges]);

  const orderedBadges = useMemo(() => {
    if (!badges) return [] as BadgeView[];
    const showcase = prefs?.badgeShowcase;
    if (Array.isArray(showcase) && showcase.length > 0) {
      const map = new Map(badges.map((b) => [b.id, b]));
      const selectedList = (showcase as string[]).map((id) => map.get(id)).filter(Boolean) as BadgeView[];
      const rest = badges.filter((b) => !((showcase as string[]).includes(b.id)));
      return [...selectedList, ...rest];
    }
    return badges;
  }, [badges, prefs]);

  function toggleSelection(id: string) {
    setError(null);
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= 5) {
        setError('You can select up to 5 badges');
        return prev;
      }
      return [...prev, id];
    });
  }

  async function saveSelection() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ preferences: { badgeShowcase: selected } }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error || 'Failed to save showcase');
        return;
      }
      const body = await res.json();
      setPrefs(body.preferences ?? {});
      setShowManage(false);
    } catch {
      setError('Failed to save showcase');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <AuthRedeemOnSignIn />

      <div>
        <InviteButton />
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-headline font-semibold">Badges</h3>
          <button
            type="button"
            onClick={() => setShowManage(true)}
            className="text-sm px-3 min-h-[44px] py-2 rounded-lg border border-border text-foreground hover:bg-surface-sunk"
          >
            Manage showcase
          </button>
        </div>

        <div className="flex flex-col gap-2" data-testid="badges-grid">
          {orderedBadges && orderedBadges.length > 0 ? (
            orderedBadges.map((b) => {
              const showcased = Array.isArray(prefs?.badgeShowcase) && prefs.badgeShowcase.includes(b.id);
              return (
                <div
                  key={b.id}
                  id={`badge-${b.id}`}
                  data-testid="badge-card"
                  className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card"
                >
                  <BadgeIcon
                    badgeId={b.id}
                    accent={BADGE_ACCENT[b.id] ?? undefined}
                    showcased={showcased}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{b.name}</div>
                    {b.description && (
                      <div className="text-xs text-muted-foreground truncate">{b.description}</div>
                    )}
                  </div>
                  <div data-testid="badge-card-actions">
                    <ShareDropdown badgeId={b.id} title={b.name} description={b.description ?? undefined} />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-sm text-muted-foreground">No badges yet</div>
          )}
        </div>
      </section>

      <div className="space-y-4">
        {showLeaderboard && <Leaderboard />}
        {showChallenge && <WeeklyChallenge />}
      </div>

      {showManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-2xl w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold">Manage Badge Showcase</h4>
              <button type="button" onClick={() => setShowManage(false)} className="text-sm px-2 py-1">Close</button>
            </div>
            <p className="text-sm text-gray-600 mb-4">Select up to 5 badges to showcase on your profile.</p>

            <div className="grid grid-cols-2 gap-3 max-h-80 overflow-auto mb-4">
              {(badges ?? []).map((b) => {
                const isSelected = selected.includes(b.id);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => toggleSelection(b.id)}
                    className={`flex items-center gap-3 p-3 rounded border text-left ${
                      isSelected ? 'bg-primary/10 border-primary' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <BadgeIcon badgeId={b.id} accent={BADGE_ACCENT[b.id] ?? undefined} />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{b.name}</div>
                      {b.description && <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{b.description}</div>}
                    </div>
                    <div className="ml-auto text-sm">{isSelected ? 'Selected' : ''}</div>
                  </button>
                );
              })}
            </div>

            {error && <div className="text-sm text-red-600 mb-3">{error}</div>}

            <div className="flex items-center justify-end gap-3">
              <button type="button" onClick={() => setShowManage(false)} className="px-4 py-2 border rounded">Cancel</button>
              <button
                type="button"
                onClick={saveSelection}
                disabled={saving}
                className="px-4 py-2 bg-primary text-white rounded disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save Showcase'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
