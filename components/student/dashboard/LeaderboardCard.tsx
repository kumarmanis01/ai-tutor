'use client'

/**
 * LeaderboardCard -- dashboard revamp
 *
 * Friends leaderboard showing top 3 + current user + immediate neighbours.
 * Accepts rows from the page (or empty for a coming-soon state).
 * "See all" navigates to /leaderboard (route TBD).
 */

import Link from 'next/link'

export interface LeaderboardRow {
  rank: number
  name: string
  xp: number
  isYou: boolean
}

interface LeaderboardCardProps {
  rows: LeaderboardRow[]
  gradeLabel?: string
}

const RANK_ACCENT: Record<number, string> = {
  1: '#C8921A',   // gold
  2: '#8A8FA8',   // silver
  3: '#8B5E3C',   // bronze
}

export default function LeaderboardCard({ rows, gradeLabel }: LeaderboardCardProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-[#E3DDD0] dark:border-[#3A3830] bg-[#F8F6F1] dark:bg-[#26241F] p-5 flex flex-col gap-3">
        <h3 className="text-lg font-bold text-[#2C2C2A] dark:text-[#E8E6DF]">Friends leaderboard</h3>
        <p className="text-sm text-[#888780] dark:text-[#6E6C67]">
          Leaderboard coming soon. Keep studying to claim your spot!
        </p>
      </div>
    )
  }

  const youRow = rows.find((r) => r.isYou)
  const nextAbove = youRow ? rows.find((r) => r.rank === youRow.rank - 1) : null
  const xpGap = youRow && nextAbove ? nextAbove.xp - youRow.xp : null

  return (
    <div className="rounded-2xl border border-[#E3DDD0] dark:border-[#3A3830] bg-[#F8F6F1] dark:bg-[#26241F] p-5 flex flex-col">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-lg font-bold text-[#2C2C2A] dark:text-[#E8E6DF]">Friends leaderboard</h3>
        {gradeLabel && (
          <span className="text-xs text-[#888780] dark:text-[#6E6C67]">{gradeLabel}</span>
        )}
      </div>

      {/* Rows */}
      <div className="flex flex-col gap-1.5 flex-1">
        {rows.map((row) => {
          const accentColor = RANK_ACCENT[row.rank]
          const initial = row.name === 'You' ? 'M' : (row.name[0] ?? '?').toUpperCase()

          return (
            <div
              key={row.rank}
              className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-1.5"
              style={
                row.isYou
                  ? { backgroundColor: '#EEEDFE', border: '1px solid rgba(83,74,183,0.22)' }
                  : { border: '1px solid transparent' }
              }
            >
              {/* Rank chip */}
              <span
                className="inline-flex items-center justify-center rounded-[6px] text-[11px] font-bold font-mono flex-shrink-0"
                style={{
                  width: 22,
                  height: 22,
                  backgroundColor: accentColor ?? 'transparent',
                  color: accentColor ? '#fff' : '#888780',
                }}
              >
                {row.rank}
              </span>

              {/* Avatar */}
              <span
                className="inline-flex items-center justify-center rounded-full text-[10px] font-bold flex-shrink-0"
                style={{
                  width: 22,
                  height: 22,
                  backgroundColor: row.isYou ? '#534AB7' : '#D3D1C7',
                  color: row.isYou ? '#fff' : '#5F5E5A',
                }}
                aria-hidden
              >
                {initial}
              </span>

              {/* Name */}
              <span
                className="flex-1 text-[12.5px] truncate"
                style={{
                  color: row.isYou ? '#2C2C2A' : '#5F5E5A',
                  fontWeight: row.isYou ? 500 : 400,
                }}
              >
                {row.isYou ? 'You' : row.name}
              </span>

              {/* XP */}
              <span className="text-xs font-mono font-semibold text-[#2C2C2A] dark:text-[#E8E6DF] tabular-nums">
                {row.xp.toLocaleString()}
              </span>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-[#E3DDD0] dark:border-[#3A3830] flex items-center justify-between">
        <span className="text-[11.5px] text-[#888780] dark:text-[#6E6C67]">
          {xpGap != null && xpGap > 0
            ? `${xpGap.toLocaleString()} XP to overtake ${nextAbove?.name}`
            : youRow?.rank === 1 ? 'You are in the lead!' : 'Keep studying to move up!'}
        </span>
        <Link
          href="/leaderboard"
          className="inline-flex items-center gap-1 text-xs font-medium text-[#534AB7] dark:text-[#AFA9EC] hover:underline min-h-[32px]"
        >
          See all &rarr;
        </Link>
      </div>
    </div>
  )
}
