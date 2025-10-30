'use client';
import React from 'react';
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
  return (
    <div className="space-y-6">
      <AuthRedeemOnSignIn />

      <div>
        <InviteButton />
      </div>

      <section>
        <h3 className="text-lg font-semibold mb-3">Badges</h3>
        <div className="flex gap-3 flex-wrap">
          {badges && badges.length > 0 ? (
            badges.map((b) => (
              <div
                key={b.id}
                id={`badge-${b.id}`}
                className="flex items-center gap-3 bg-white dark:bg-gray-900 px-3 py-2 rounded shadow-sm"
              >
                <span className="text-2xl">{b.icon ?? '🏅'}</span>
                <div className="min-w-0">
                  <div className="font-medium truncate">{b.name}</div>
                  {b.description && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {b.description}
                    </div>
                  )}
                </div>
                <div className="ml-auto">
                  <ShareBadge
                    badgeId={b.id}
                    title={b.name}
                    description={b.description ?? undefined}
                  />
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-gray-500">No badges yet</div>
          )}
        </div>
      </section>

      <div className="space-y-4">
        {showLeaderboard && <Leaderboard />}
        {showChallenge && <WeeklyChallenge />}
      </div>
    </div>
  );
}
