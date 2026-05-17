/**
 * WeekCard -- dashboard revamp
 *
 * 7-day weekly activity strip with Duolingo-style day-dots.
 * Done days: solid mint circle with check + 3px down-shadow.
 * Today: white circle with purple ring + 3px down-shadow.
 * Future: dashed border, no fill.
 *
 * Server component -- data passed from page.tsx.
 */

interface DayActivity {
  date: string
  dayLabel: string
  hasSession: boolean
}

export interface WeekCardData {
  days: DayActivity[]
  sessionCountThisWeek: number
  weeklyGoal: number
}

interface WeekCardProps {
  data: WeekCardData
}

function CheckIcon() {
  return (
    <svg className="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  )
}

export default function WeekCard({ data }: WeekCardProps) {
  const { days, sessionCountThisWeek, weeklyGoal } = data

  const todayDow = new Date().getUTCDay()
  const todayIdx = todayDow === 0 ? 6 : todayDow - 1

  const aheadBy = sessionCountThisWeek - Math.min(todayIdx + 1, weeklyGoal)
  const isAhead = aheadBy > 0

  return (
    <div className="rounded-2xl border border-[#E3DDD0] dark:border-[#3A3830] bg-[#F8F6F1] dark:bg-[#26241F] p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-bold text-[#2C2C2A] dark:text-[#E8E6DF]">This week</h3>
        <span className="text-xs text-[#888780] dark:text-[#6E6C67]">
          {sessionCountThisWeek} / {weeklyGoal} done
        </span>
      </div>

      {/* Day dots */}
      <div className="flex justify-between gap-1">
        {days.map((day, i) => {
          const isToday = i === todayIdx
          const isFuture = i > todayIdx

          return (
            <div key={day.date} className="flex flex-col items-center gap-1.5 flex-1">
              <div
                className="flex items-center justify-center mx-auto"
                style={{ width: 30, height: 30 }}
                aria-label={`${day.dayLabel}: ${day.hasSession ? 'studied' : isToday ? 'today' : 'no session'}`}
              >
                {day.hasSession ? (
                  <div
                    className="w-full h-full rounded-full flex items-center justify-center"
                    style={{
                      backgroundColor: '#1D9E75',
                      boxShadow: '0 3px 0 #0D6B4F',
                    }}
                  >
                    <CheckIcon />
                  </div>
                ) : isToday ? (
                  <div
                    className="w-full h-full rounded-full flex items-center justify-center bg-white dark:bg-[#26241F]"
                    style={{
                      border: '2px solid #534AB7',
                      boxShadow: '0 3px 0 #3C3489',
                    }}
                  >
                    <span className="text-[10px] font-bold text-[#534AB7] leading-none">•</span>
                  </div>
                ) : isFuture ? (
                  <div
                    className="w-full h-full rounded-full"
                    style={{ border: '1.5px dashed #D3D1C7' }}
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-[#E8E4DA] dark:bg-[#3A3830]" />
                )}
              </div>
              <span
                className="text-[10px] font-medium"
                style={{
                  color: isToday ? '#534AB7' : '#B4B2A9',
                }}
              >
                {day.dayLabel.slice(0, 1)}
              </span>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <p className="text-[11.5px] text-[#5F5E5A] dark:text-[#A8A69F] flex items-center gap-1.5">
        {isAhead ? (
          <>
            <span className="text-[#1D9E75]">✓</span>
            Ahead by {aheadBy} session{aheadBy !== 1 ? 's' : ''}
          </>
        ) : sessionCountThisWeek >= weeklyGoal ? (
          <>
            <span className="text-[#1D9E75]">✓</span>
            Weekly goal reached!
          </>
        ) : (
          `${weeklyGoal - sessionCountThisWeek} more session${weeklyGoal - sessionCountThisWeek !== 1 ? 's' : ''} to reach your goal`
        )}
      </p>
    </div>
  )
}
