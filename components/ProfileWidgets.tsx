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
 */

import React, { useEffect, useMemo, useState } from 'react';
import InviteButton from '@/components/InviteButton';
import Leaderboard from '@/components/Leaderboard';
import WeeklyChallenge from '@/components/WeeklyChallenge';
import ShareBadge from '@/components/ShareBadge';
import AuthRedeemOnSignIn from '@/components/AuthRedeemOnSignIn';

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
        const res = await fetch('/api/user/profile');
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
          <h3 className="text-lg font-semibold">Badges</h3>
          <button
            type="button"
            onClick={() => setShowManage(true)}
            className="text-sm px-3 py-1 bg-primary text-white rounded-md hover:opacity-95"
          >
            Manage Showcase
          </button>
        </div>

        <div className="flex gap-3 flex-wrap">
          {orderedBadges && orderedBadges.length > 0 ? (
            orderedBadges.map((b) => {
              const highlighted = Array.isArray(prefs?.badgeShowcase) && prefs.badgeShowcase.includes(b.id);
              return (
                <div
                  key={b.id}
                  id={`badge-${b.id}`}
                  className={`flex items-center gap-3 bg-white dark:bg-gray-900 px-3 py-2 rounded shadow-sm ${
                    highlighted ? 'ring-2 ring-primary' : ''
                  }`}
                >
                  <span className="text-2xl">{b.icon ?? '🏅'}</span>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{b.name}</div>
                    {b.description && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{b.description}</div>
                    )}
                  </div>
                  <div className="ml-auto">
                    <ShareBadge badgeId={b.id} title={b.name} description={b.description ?? undefined} />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-sm text-gray-500">No badges yet</div>
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
                    <span className="text-2xl">{b.icon ?? '🏅'}</span>
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
