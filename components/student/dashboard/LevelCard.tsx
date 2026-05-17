/**
 * LevelCard -- dashboard revamp
 *
 * Shows the student's current XP level with a conic-gradient progress ring
 * and weekly XP earned. Server component.
 */

import { getProgressPercent, getXPToNextLevel, getLevelTierName, LEVEL_THRESHOLDS } from '@/lib/student/xpLevels'

interface LevelCardProps {
  totalXp: number
  level: number
  xpThisWeek: number
}

export default function LevelCard({ totalXp, level, xpThisWeek }: LevelCardProps) {
  const pct = getProgressPercent(totalXp)
  const remaining = getXPToNextLevel(totalXp) ?? 0
  const tierName = getLevelTierName(level)
  const currentThreshold = (LEVEL_THRESHOLDS[level - 1] ?? 0) as number
  const nextThreshold = (LEVEL_THRESHOLDS[level] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]) as number
  const xpInBand = totalXp - currentThreshold
  const bandSize = Math.max(1, nextThreshold - currentThreshold)

  return (
    <div className="rounded-2xl border border-[#E3DDD0] dark:border-[#3A3830] bg-[#F8F6F1] dark:bg-[#26241F] p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        {/* Conic-gradient ring */}
        <div
          className="relative flex-shrink-0 flex items-center justify-center rounded-full"
          style={{
            width: 60,
            height: 60,
            background: `conic-gradient(#534AB7 ${pct * 3.6}deg, #E3DDD0 0deg)`,
          }}
          role="progressbar"
          aria-valuenow={xpInBand}
          aria-valuemin={0}
          aria-valuemax={bandSize}
          aria-label={`Level ${level} progress: ${pct}%`}
        >
          {/* Inner circle */}
          <div className="absolute inset-[6px] rounded-full bg-[#F8F6F1] dark:bg-[#26241F] flex items-center justify-center">
            <span className="text-[11px] font-bold text-[#534AB7] dark:text-[#AFA9EC] font-mono">
              {pct}%
            </span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium tracking-[0.06em] uppercase text-[#888780] dark:text-[#6E6C67]">
            Level {level} · {tierName}
          </p>
          <p className="text-xl font-bold text-[#2C2C2A] dark:text-[#E8E6DF] mt-0.5">
            {xpInBand.toLocaleString()}{' '}
            <span className="text-sm font-normal text-[#888780] dark:text-[#6E6C67]">
              / {bandSize.toLocaleString()} XP
            </span>
          </p>
          <p className="text-[11.5px] text-[#888780] dark:text-[#6E6C67] mt-0.5">
            {remaining.toLocaleString()} XP to Level {level + 1}
          </p>
        </div>
      </div>

      {/* Weekly XP badge */}
      {xpThisWeek > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-white dark:bg-[#2E2C27] border border-[#E3DDD0] dark:border-[#3A3830] px-3 py-2.5">
          <span className="text-[#BA7517] text-base leading-none" aria-hidden>⚡</span>
          <span className="text-xs font-medium text-[#5F5E5A] dark:text-[#A8A69F]">
            +{xpThisWeek.toLocaleString()} XP this week
          </span>
        </div>
      )}
    </div>
  )
}
