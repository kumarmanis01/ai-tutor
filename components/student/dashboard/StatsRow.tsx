/**
 * StatsRow -- dashboard revamp
 *
 * Three-column layout for WeekCard, LevelCard, and LeaderboardCard.
 * Collapses to 2-col below 900px and 1-col on mobile.
 */

import WeekCard, { type WeekCardData } from './WeekCard'
import LevelCard from './LevelCard'
import LeaderboardCard, { type LeaderboardRow } from './LeaderboardCard'

interface StatsRowProps {
  weekData: WeekCardData
  totalXp: number
  level: number
  xpThisWeek: number
  leaderboardRows: LeaderboardRow[]
  gradeLabel?: string
}

export default function StatsRow({
  weekData,
  totalXp,
  level,
  xpThisWeek,
  leaderboardRows,
  gradeLabel,
}: StatsRowProps) {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <WeekCard data={weekData} />
      <LevelCard totalXp={totalXp} level={level} xpThisWeek={xpThisWeek} />
      <div className="sm:col-span-2 lg:col-span-1">
        <LeaderboardCard rows={leaderboardRows} gradeLabel={gradeLabel} />
      </div>
    </section>
  )
}
