'use client'

/**
 * TodaysMissions -- dashboard revamp
 *
 * Renders the primary MissionHero card and a grid of secondary MissionRow
 * cards. The hero CTA label/variant is driven by missionCta() so every
 * mission card uses the same state → button mapping.
 */

import React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { type DashboardMission, missionCta, getSubjectColors } from '@/lib/student/dashboardMissions'

// ── Arrow icon ────────────────────────────────────────────────────────────────

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className ?? 'w-4 h-4'}
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  )
}

// ── CTA button variant styles ─────────────────────────────────────────────────

function ctaButtonClass(variant: 'primary' | 'amber' | 'ghost' | 'disabled'): string {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold min-h-[44px] transition-all active:translate-y-[1px]'
  if (variant === 'primary') {
    return `${base} bg-[#534AB7] hover:bg-[#4239A0] text-white px-5 shadow-[0_2px_0_#3C3489] hover:shadow-[0_1px_0_#3C3489]`
  }
  if (variant === 'amber') {
    return `${base} bg-[#BA7517] hover:bg-[#9e6212] text-white px-5 shadow-[0_2px_0_#7a4a0a] hover:shadow-[0_1px_0_#7a4a0a]`
  }
  if (variant === 'ghost') {
    return `${base} border border-[#D3D1C7] dark:border-[#4A4840] text-[#2C2C2A] dark:text-[#E8E6DF] hover:bg-[#F1EFE8] dark:hover:bg-[#26241F] px-5`
  }
  return `${base} border border-[#D3D1C7] dark:border-[#4A4840] text-[#B4B2A9] dark:text-[#4A4844] cursor-not-allowed opacity-60 px-5`
}

// ── SubjectGlyph ──────────────────────────────────────────────────────────────

function SubjectGlyph({ subjectId, subjectName, size = 36 }: { subjectId: string; subjectName: string; size?: number }) {
  const colors = getSubjectColors(subjectId)
  const letter = (subjectName[0] ?? '?').toUpperCase()
  const radius = Math.round(size / 3.6)
  return (
    <span
      className="inline-flex items-center justify-center flex-shrink-0 font-bold"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: colors.softBg,
        color: colors.fill,
        fontSize: Math.round(size * 0.47),
        border: `1px solid ${colors.borderHex}`,
        lineHeight: 1,
      }}
      aria-hidden
    >
      {letter}
    </span>
  )
}

// ── SubjectChip ───────────────────────────────────────────────────────────────

function SubjectChip({ subjectId, subjectName }: { subjectId: string; subjectName: string }) {
  const colors = getSubjectColors(subjectId)
  const letter = (subjectName[0] ?? '?').toUpperCase()
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full text-[11px] font-medium leading-none"
      style={{
        backgroundColor: colors.softBg,
        color: colors.textHex,
        padding: '4px 10px 4px 6px',
      }}
    >
      <span
        className="inline-flex items-center justify-center rounded-[4px] text-white text-[9px] font-bold"
        style={{ width: 14, height: 14, backgroundColor: colors.fill }}
        aria-hidden
      >
        {letter}
      </span>
      {subjectName}
    </span>
  )
}

// ── MissionHero ───────────────────────────────────────────────────────────────

export function MissionHero({ mission }: { mission: DashboardMission }) {
  const router = useRouter()
  const cta = missionCta(mission)
  const [loading, setLoading] = React.useState(false)

  function handlePrimary() {
    if (cta.variant === 'disabled') return
    setLoading(true)
    router.push(mission.href)
  }

  const secondaryLabel =
    mission.kind === 'Homework' ? 'Preview questions'
    : mission.kind === 'Practice' ? 'Preview set'
    : 'Preview lesson'

  return (
    <article className="rounded-2xl border border-[#E3DDD0] dark:border-[#3A3830] bg-white dark:bg-[#26241F] overflow-hidden shadow-sm">
      <div className="p-6 sm:p-7">
        {/* Top pills row */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {mission.kind === 'Homework' && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FAEEDA] dark:bg-[#3A2005] text-[#633806] dark:text-[#EF9F27] text-[11.5px] font-medium px-3 py-1 leading-none">
              <span className="w-1.5 h-1.5 rounded-full bg-[#BA7517]" aria-hidden />
              Homework pending
            </span>
          )}
          {mission.due && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D3D1C7] dark:border-[#4A4840] text-[#5F5E5A] dark:text-[#A8A69F] text-[11.5px] font-medium px-3 py-1 leading-none">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
              </svg>
              {mission.due}
            </span>
          )}
          <SubjectChip subjectId={mission.subjectId} subjectName={mission.subjectName} />
          {mission.chapter && (
            <span className="ml-auto text-[11.5px] text-[#888780] dark:text-[#6E6C67]">
              {mission.subjectName} · {mission.chapter}
            </span>
          )}
        </div>

        {/* Content grid */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-5 items-end">
          <div>
            <p className="text-[11px] font-medium tracking-[0.08em] uppercase text-[#888780] dark:text-[#6E6C67] mb-1">
              Today&apos;s top mission
            </p>
            <h2 className="text-[28px] sm:text-[36px] font-bold leading-tight tracking-tight text-[#2C2C2A] dark:text-[#E8E6DF]">
              {mission.title}
            </h2>

            {/* Stats row */}
            <div className="flex items-center gap-5 mt-4">
              {mission.questionCount != null && (
                <>
                  <div>
                    <p className="text-[10.5px] tracking-[0.06em] uppercase text-[#888780] dark:text-[#6E6C67] mb-0.5">Questions</p>
                    <p className="text-xl font-bold text-[#2C2C2A] dark:text-[#E8E6DF]">{mission.questionCount}</p>
                  </div>
                  <div className="h-8 w-px bg-[#E3DDD0] dark:bg-[#3A3830]" aria-hidden />
                </>
              )}
              <div>
                <p className="text-[10.5px] tracking-[0.06em] uppercase text-[#888780] dark:text-[#6E6C67] mb-0.5">Time</p>
                <p className="text-xl font-bold text-[#2C2C2A] dark:text-[#E8E6DF]">~{mission.estimatedMins}m</p>
              </div>
              <div className="h-8 w-px bg-[#E3DDD0] dark:bg-[#3A3830]" aria-hidden />
              <div>
                <p className="text-[10.5px] tracking-[0.06em] uppercase text-[#888780] dark:text-[#6E6C67] mb-0.5">Reward</p>
                <p className="text-xl font-bold text-[#BA7517] dark:text-[#EF9F27]">+{mission.xp} XP</p>
              </div>
            </div>
          </div>

          {/* Lesson illustration placeholder */}
          <div
            className="hidden sm:flex h-[110px] w-[130px] rounded-xl flex-shrink-0 items-center justify-center text-[11px] text-[#888780] dark:text-[#6E6C67] font-medium"
            style={{
              background: 'repeating-linear-gradient(135deg, #F1EFE8 0 9px, #E3DDD0 9px 10px)',
              border: '1px solid #D3D1C7',
            }}
            aria-hidden
          >
            {mission.subjectName}
          </div>
        </div>

        {/* CTA row */}
        <div className="flex items-center gap-3 mt-6 flex-wrap">
          <button
            type="button"
            onClick={handlePrimary}
            disabled={loading || cta.variant === 'disabled'}
            className={ctaButtonClass(cta.variant)}
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                Starting...
              </>
            ) : (
              <>
                {cta.label}
                {cta.icon && <ArrowIcon />}
              </>
            )}
          </button>

          {cta.variant !== 'disabled' && cta.variant !== 'ghost' && (
            <button
              type="button"
              className={ctaButtonClass('ghost')}
              onClick={() => router.push(mission.href)}
              aria-label={secondaryLabel}
            >
              {secondaryLabel}
            </button>
          )}
        </div>
        <Link
          href="/student/learning-path"
          className="mt-2 block text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          View full plan &rarr;
        </Link>
      </div>
    </article>
  )
}

// ── MissionRow ────────────────────────────────────────────────────────────────

export function MissionRow({ mission }: { mission: DashboardMission }) {
  const router = useRouter()

  return (
    <article
      className="flex items-center gap-4 rounded-2xl border border-[#E3DDD0] dark:border-[#3A3830] bg-white dark:bg-[#26241F] p-4 cursor-pointer hover:bg-[#F8F6F1] dark:hover:bg-[#2E2C27] transition-colors"
      onClick={() => router.push(mission.href)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(mission.href) } }}
    >
      <SubjectGlyph subjectId={mission.subjectId} subjectName={mission.subjectName} size={36} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-[11px] text-[#888780] dark:text-[#6E6C67] tracking-[0.04em] mb-0.5">
          <span className="uppercase font-medium">{mission.kind}</span>
          <span className="w-[3px] h-[3px] rounded-full bg-[#D3D1C7] dark:bg-[#4A4840] flex-shrink-0" aria-hidden />
          <span className="truncate">{mission.subjectName}{mission.chapter ? ` · ${mission.chapter}` : ''}</span>
        </div>
        <p className="text-[17px] font-semibold text-[#2C2C2A] dark:text-[#E8E6DF] truncate leading-snug">
          {mission.title}
        </p>
        <div className="flex items-center gap-3 mt-0.5 text-[11.5px] text-[#888780] dark:text-[#6E6C67]">
          {mission.questionCount != null && <span>{mission.questionCount} q</span>}
          <span>~{mission.estimatedMins} min</span>
          <span className="text-[#BA7517] dark:text-[#EF9F27]">+{mission.xp} XP</span>
        </div>
      </div>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); router.push(mission.href) }}
        className="flex-shrink-0 flex items-center justify-center w-[38px] h-[38px] min-w-[38px] rounded-full border border-[#D3D1C7] dark:border-[#4A4840] text-[#5F5E5A] dark:text-[#A8A69F] hover:bg-[#F1EFE8] dark:hover:bg-[#2E2C27] transition-colors"
        aria-label={`Start ${mission.title}`}
      >
        <ArrowIcon />
      </button>
    </article>
  )
}

// ── TodaysMissions (section wrapper) ─────────────────────────────────────────

interface TodaysMissionsProps {
  hero: DashboardMission | null
  rest: DashboardMission[]
}

export default function TodaysMissions({ hero, rest }: TodaysMissionsProps) {
  const all = hero ? [hero, ...rest] : rest
  const subjectCount = new Set(all.map((m) => m.subjectId)).size
  const totalMins = all.reduce((s, m) => s + m.estimatedMins, 0)

  if (!hero && rest.length === 0) return null

  return (
    <section className="flex flex-col gap-4">
      {/* Section heading */}
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <h2 className="text-xl sm:text-[22px] font-bold text-[#2C2C2A] dark:text-[#E8E6DF]">
          Today&apos;s missions
        </h2>
        <span className="text-xs text-[#888780] dark:text-[#6E6C67]">
          {all.length} mission{all.length !== 1 ? 's' : ''} · {subjectCount} subject{subjectCount !== 1 ? 's' : ''} · total ~{totalMins} min
        </span>
      </div>

      {hero && <MissionHero mission={hero} />}

      {rest.length > 0 && (
        <div>
          {/* Divider */}
          <div className="flex items-center gap-3 my-3 mx-1">
            <span className="text-[11px] font-medium tracking-[0.08em] uppercase text-[#888780] dark:text-[#6E6C67]">
              Up next today
            </span>
            <div className="flex-1 h-px bg-[#E8E4DA] dark:bg-[#3A3830]" aria-hidden />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {rest.map((m) => (
              <MissionRow key={m.id} mission={m} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
