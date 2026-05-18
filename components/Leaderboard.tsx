/**
 * FILE OBJECTIVE:
 * - Leaderboard component showing top students with rank chip + avatar.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/Leaderboard.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - CLAUDE.md
 *
 * EDIT LOG:
 * - 2026-05-18T00:00:00Z | copilot | refactor to rank-chip + avatar pattern
 */

'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Card } from '@/components/UI/design-system';

type Row = {
  rank: number;
  userId: string;
  name: string | null;
  xp: number;
  isYou: boolean;
  image?: string | null;
};

// Decorative accents: literal hex values per design task (token promotion not required).
const RANK_TINTS: Record<number, { bg: string; fg: string }> = {
  1: { bg: '#E8C76A', fg: '#3a2a10' },
  2: { bg: '#C8C8D6', fg: '#2a2a3a' },
  3: { bg: '#D49770', fg: '#3a2010' },
};

export default function Leaderboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setRows(d.top || []);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  return (
    <Card variant="warm" padding="normal" className="flex flex-col">
      <header className="flex items-baseline justify-between mb-3">
        <h3 className="text-lg font-headline text-foreground">Leaderboard</h3>
        <span className="text-xs text-muted-foreground">This week</span>
      </header>

      {loading && <LeaderboardSkeleton />}

      {!loading && error && (
        <button onClick={() => location.reload()} className="text-sm text-muted-foreground">
          Couldn't load -- tap to retry
        </button>
      )}

      {!loading && !error && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Your class leaderboard appears here once friends join.
        </p>
      )}

      {!loading && !error && rows.length > 0 && (
        <ol className="flex flex-col gap-1 list-none p-0 m-0">
          {rows.map((r) => (
            <LeaderboardRow key={r.userId} row={r} />
          ))}
        </ol>
      )}
    </Card>
  );
}

function LeaderboardRow({ row }: { row: Row }) {
  const tint = RANK_TINTS[row.rank];
  return (
    <li
      className={[
        'flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg',
        row.isYou ? 'bg-primary-bg border border-primary/20' : 'border border-transparent',
      ].join(' ')}
    >
      {/* Rank chip */}
      <span
        className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-md text-[11px] font-semibold tabular-nums shrink-0"
        style={tint ? { background: tint.bg, color: tint.fg } : undefined}
      >
        {row.rank}
      </span>

      {/* Avatar */}
      <span
        className={[
          'inline-flex items-center justify-center w-[22px] h-[22px] rounded-full text-[10px] font-semibold shrink-0 overflow-hidden'
        ].join(' ')}
        aria-hidden
      >
        {row.image ? (
          <Image src={row.image} alt={row.name ?? 'avatar'} width={22} height={22} />
        ) : (
          <span
            className={row.isYou ? 'bg-primary text-primary-foreground inline-flex w-full h-full items-center justify-center' : 'bg-muted text-ink-2 inline-flex w-full h-full items-center justify-center'}
          >
            {(row.isYou ? 'M' : (row.name?.[0] ?? '?')).toUpperCase()}
          </span>
        )}
      </span>

      {/* Name */}
      <span
        className={[
          'flex-1 min-w-0 truncate text-sm',
          row.isYou ? 'text-foreground font-medium' : 'text-ink-2',
        ].join(' ')}
      >
        {row.isYou ? 'You' : row.name ?? 'User'}
      </span>

      {/* XP */}
      <span className="text-sm text-foreground tabular-nums">{row.xp.toLocaleString()}</span>
    </li>
  );
}

function LeaderboardSkeleton() {
  const items = new Array(6).fill(null);
  return (
    <div className="space-y-1 w-full">
      {items.map((_, i) => (
        <div key={i} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg animate-pulse">
          <div className="w-[22px] h-[22px] rounded-md bg-gray-200" />
          <div className="w-[22px] h-[22px] rounded-full bg-gray-200" />
          <div className="flex-1 h-4 bg-gray-200 rounded" />
          <div className="w-12 h-4 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  );
}
