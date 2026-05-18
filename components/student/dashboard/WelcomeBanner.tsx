/**
 * WelcomeBanner -- dashboard revamp
 *
 * Warm greeting card with date, personalised heading, daily-goal progress bar,
 * and an owl mascot slot. Server component -- no client-side state needed.
 */

import Image from 'next/image'

interface WelcomeBannerProps {
  name: string
  completedCount: number
  totalCount: number
  subjectCount: number
  totalMins: number
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function WelcomeBanner({
  name,
  completedCount,
  totalCount,
  subjectCount,
  totalMins,
}: WelcomeBannerProps) {
  const now = new Date()
  const dateLabel = `${DAYS[now.getDay()]} · ${now.getDate()} ${MONTHS[now.getMonth()]}`
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const remaining = totalCount - completedCount
  const firstName = name.split(' ')[0]

  return (
    <section
      className="relative overflow-hidden rounded-[22px] border border-[#E3DDD0] dark:border-[#3A3830]"
      style={{
        background: 'linear-gradient(135deg, #F5EFE0 0%, #EEE9F8 60%, #F1EFE8 100%)',
      }}
    >
      {/* dark mode overlay */}
      <div className="absolute inset-0 rounded-[22px] bg-[#1A1918] opacity-0 dark:opacity-100 pointer-events-none" aria-hidden />

      {/* decorative radial blob */}
      <div
        className="pointer-events-none absolute right-[-40px] top-[-40px] h-52 w-52 rounded-full opacity-40 dark:opacity-20"
        style={{
          background: 'radial-gradient(circle, #E8D9B0 0%, transparent 70%)',
        }}
        aria-hidden
      />

      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-6 items-center p-7 sm:p-8">
        {/* Left: text content */}
        <div>
          <p className="text-[11px] font-medium tracking-[0.1em] uppercase text-[#888780] dark:text-[#6E6C67] mb-2">
            {dateLabel}
          </p>
          <h1 className="text-[28px] sm:text-[38px] font-bold leading-tight tracking-tight text-[#2C2C2A] dark:text-[#E8E6DF]">
            Welcome back, {firstName}.
          </h1>
          <p className="mt-2.5 text-sm sm:text-[15px] leading-relaxed text-[#5F5E5A] dark:text-[#A8A69F] max-w-[460px]">
            {totalCount > 0
              ? `${totalCount} mission${totalCount !== 1 ? 's' : ''} across ${subjectCount} subject${subjectCount !== 1 ? 's' : ''} today · ~${totalMins} min total.`
              : "Your personalised plan is loading. Check back in a moment!"}
          </p>

          {totalCount > 0 && (
            <div className="mt-5 w-full max-w-[300px]">
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-[11px] font-medium tracking-[0.06em] uppercase text-[#888780] dark:text-[#6E6C67]">
                  Daily goal
                </span>
                <span className="text-[12px] font-mono text-[#5F5E5A] dark:text-[#A8A69F]">
                  {completedCount} / {totalCount} done
                </span>
              </div>
              <div
                className="h-[7px] w-full rounded-full bg-[#E3DDD0] dark:bg-[#3A3830] overflow-hidden"
                role="progressbar"
                aria-valuenow={completedCount}
                aria-valuemin={0}
                aria-valuemax={totalCount}
                aria-label="Daily goal progress"
              >
                <div
                  className="h-full rounded-full bg-[#BA7517] transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              {remaining > 0 && pct < 100 && (
                <p className="mt-1.5 text-[11.5px] text-[#888780] dark:text-[#6E6C67]">
                  {remaining} more to keep your streak going 🔥
                </p>
              )}
              {pct === 100 && (
                <p className="mt-1.5 text-[11.5px] text-[#1D9E75] dark:text-[#5DCAA5] font-medium">
                  All done for today -- great work! ✓
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right: mascot illustration slot */}
        <div className="hidden sm:flex justify-center flex-shrink-0">
          <div className="h-[160px] w-[160px] rounded-[28px] bg-[#EDE3D0] dark:bg-[#2E2C27] border border-[#DDD3BE] dark:border-[#3A3830] flex items-center justify-center overflow-hidden">
            <Image
              src="/logos/vidya/vidya-avatar-128.png"
              alt="Teacher Vidya"
              width={120}
              height={120}
              className="object-cover h-[120px] w-[120px]"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
