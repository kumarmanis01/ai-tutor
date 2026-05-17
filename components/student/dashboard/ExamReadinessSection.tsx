'use client'

/**
 * ExamReadinessSection -- dashboard revamp
 *
 * Multi-subject exam readiness grid with a per-subject chapter mastery
 * breakdown for the selected (clicked) subject. Subjects are sorted
 * weakest-first by default; clicking a subject card updates selectedSubjectId.
 */

import React, { useState } from 'react'
import Link from 'next/link'
import { getSubjectColors } from '@/lib/student/dashboardMissions'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ReadinessTag = 'critical' | 'needs_work' | 'on_track' | 'ready'

export interface ReadinessChapterDisplay {
  chapterId: string
  chapterName: string
  masteryPct: number
  tag: ReadinessTag
}

export interface PredictedRange {
  low: number
  high: number
  confidenceLevel: number
}

export interface SubjectReadiness {
  subjectId: string
  subjectName: string
  score: number         // 0-100 (already normalised by page.tsx)
  tag: ReadinessTag
  diagnosticDone: boolean
  retakeEligibleAt?: string | null
  predictedRange?: PredictedRange | null
  chapters: ReadinessChapterDisplay[]
}

interface ExamReadinessSectionProps {
  subjects: SubjectReadiness[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TAG_STYLES: Record<ReadinessTag, { bg: string; text: string; label: string }> = {
  critical:  { bg: '#FCEBEB', text: '#A32D2D', label: 'Critical' },
  needs_work:{ bg: '#FAEEDA', text: '#633806', label: 'Needs work' },
  on_track:  { bg: '#EEEDFE', text: '#3C3489', label: 'On track' },
  ready:     { bg: '#EAF3DE', text: '#27500A', label: 'Exam ready' },
}

const TAG_RING_COLOR: Record<ReadinessTag, string> = {
  critical:  '#E24B4A',
  needs_work:'#BA7517',
  on_track:  '#534AB7',
  ready:     '#1D9E75',
}

function tagFromLabel(label: string): ReadinessTag {
  if (label === 'critical') return 'critical'
  if (label === 'needs_work') return 'needs_work'
  if (label === 'on_track') return 'on_track'
  return 'ready'
}

function normalise(label: string): ReadinessTag {
  // handles both 'needs_work' and 'needs work' patterns
  const key = label.toLowerCase().replace(' ', '_')
  return tagFromLabel(key)
}

function formatRetakeDate(retakeEligibleAt: string): string {
  const date = new Date(retakeEligibleAt)
  if (Number.isNaN(date.getTime())) return 'Retake available soon'
  return `Retake opens ${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
}

function ReadinessPill({ tag }: { tag: ReadinessTag }) {
  const s = TAG_STYLES[tag]
  return (
    <span
      className="inline-flex items-center rounded-full text-[11px] font-medium leading-none"
      style={{ backgroundColor: s.bg, color: s.text, padding: '4px 10px' }}
    >
      {s.label}
    </span>
  )
}

// ── ConicRing ─────────────────────────────────────────────────────────────────

function ConicRing({ pct, color, size }: { pct: number; color: string; size: number }) {
  const thickness = size <= 52 ? 5 : 6
  const innerSize = size - thickness * 2
  return (
    <div
      className="relative flex-shrink-0 flex items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(${color} ${pct * 3.6}deg, #E3DDD0 0deg)`,
      }}
      role="img"
      aria-label={`${pct}%`}
    >
      <div
        className="absolute rounded-full bg-white dark:bg-[#26241F] flex items-center justify-center"
        style={{
          width: innerSize,
          height: innerSize,
          top: thickness,
          left: thickness,
        }}
      >
        <span className="text-[10px] font-bold font-mono" style={{ color }}>{pct}%</span>
      </div>
    </div>
  )
}

// ── SubjectReadinessCard ──────────────────────────────────────────────────────

function SubjectCard({
  subject,
  selected,
  onClick,
}: {
  subject: SubjectReadiness
  selected: boolean
  onClick: () => void
}) {
  const colors = getSubjectColors(subject.subjectId)
  const tag = normalise(subject.tag)
  const ringColor = TAG_RING_COLOR[tag]
  const letter = (subject.subjectName[0] ?? '?').toUpperCase()

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-2.5 rounded-2xl p-4 text-left w-full transition-all"
      style={{
        backgroundColor: selected ? colors.softBg : '#FFFFFF',
        border: selected
          ? `1px solid ${colors.borderHex}`
          : '1px solid #E3DDD0',
        boxShadow: selected ? `0 2px 0 ${colors.borderHex}` : 'none',
        color: 'inherit',
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          {/* Subject glyph */}
          <span
            className="inline-flex items-center justify-center flex-shrink-0 font-bold rounded-lg"
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              backgroundColor: colors.softBg,
              color: colors.fill,
              fontSize: 16,
              border: `1px solid ${colors.borderHex}`,
            }}
            aria-hidden
          >
            {letter}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-semibold text-[#2C2C2A] dark:text-[#E8E6DF] truncate leading-tight">
              {subject.subjectName}
            </p>
            <div className="mt-1">
              <ReadinessPill tag={tag} />
            </div>
          </div>
        </div>
        <ConicRing pct={subject.score} color={ringColor} size={52} />
      </div>

      {/* Progress bar */}
      <div className="h-[5px] w-full rounded-full bg-[#E8E4DA] dark:bg-[#3A3830] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.max(2, subject.score)}%`, backgroundColor: ringColor }}
        />
      </div>

      {/* Diagnostic status row */}
      <div className="flex flex-wrap items-center gap-1.5 mt-1">
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={
            subject.diagnosticDone
              ? { backgroundColor: '#EAF3DE', color: '#27500A' }
              : { backgroundColor: '#FAEEDA', color: '#633806' }
          }
        >
          {subject.diagnosticDone ? 'Diagnostic complete' : 'Diagnostic pending'}
        </span>

        {!subject.diagnosticDone && (
          <Link
            href={`/diagnostic/${subject.subjectId}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center rounded-md bg-[#534AB7] px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-[#4239A0] min-h-[28px]"
            aria-label={`Start diagnostic for ${subject.subjectName}`}
          >
            Start diagnostic
          </Link>
        )}

        {subject.retakeEligibleAt && (
          <span className="inline-flex items-center rounded-full bg-[#EEEDFE] px-2 py-0.5 text-[10px] font-medium text-[#3C3489]">
            {formatRetakeDate(subject.retakeEligibleAt)}
          </span>
        )}
      </div>

      {/* Predicted board score range */}
      {subject.predictedRange && (
        <p className="mt-1 text-[11px] text-[#5F5E5A] dark:text-[#A8A69F]">
          Predicted score:{' '}
          <span className="font-semibold text-[#2C2C2A] dark:text-[#E8E6DF]">
            {subject.predictedRange.low}&ndash;{subject.predictedRange.high}
          </span>{' '}
          <span className="text-[#888780] dark:text-[#6E6C67]">
            ({subject.predictedRange.confidenceLevel}% CI)
          </span>
        </p>
      )}
    </button>
  )
}

// ── ChapterCard ───────────────────────────────────────────────────────────────

function ChapterCard({ chapter }: { chapter: ReadinessChapterDisplay }) {
  const tag = normalise(chapter.tag)
  const barColor = TAG_RING_COLOR[tag]
  return (
    <div className="rounded-xl border border-[#E3DDD0] dark:border-[#3A3830] bg-white dark:bg-[#2E2C27] p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-[13px] text-[#2C2C2A] dark:text-[#E8E6DF] leading-snug font-medium">
          {chapter.chapterName}
        </span>
        <ReadinessPill tag={tag} />
      </div>
      <div className="flex items-baseline gap-1.5 mb-2">
        <span className="text-xl font-bold text-[#2C2C2A] dark:text-[#E8E6DF]">{chapter.masteryPct}%</span>
        <span className="text-[11px] text-[#888780] dark:text-[#6E6C67]">mastery</span>
      </div>
      <div className="h-[6px] w-full rounded-full bg-[#E8E4DA] dark:bg-[#3A3830] overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(2, chapter.masteryPct)}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ExamReadinessSection({ subjects }: ExamReadinessSectionProps) {
  // Sort weakest first
  const sorted = [...subjects].sort((a, b) => a.score - b.score)
  const [selectedId, setSelectedId] = useState(sorted[0]?.subjectId ?? '')

  if (sorted.length === 0) return null

  const selected = sorted.find((s) => s.subjectId === selectedId) ?? sorted[0]
  const overall = Math.round(subjects.reduce((sum, s) => sum + s.score, 0) / subjects.length)
  const overallTag: ReadinessTag =
    overall < 40 ? 'critical' : overall < 70 ? 'needs_work' : overall < 90 ? 'on_track' : 'ready'

  return (
    <section className="rounded-2xl border border-[#E3DDD0] dark:border-[#3A3830] bg-white dark:bg-[#26241F] overflow-hidden">
      <div className="p-6 sm:p-7 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <ConicRing pct={overall} color={TAG_RING_COLOR[overallTag]} size={64} />
            <div>
              <h2 className="text-xl sm:text-[22px] font-bold text-[#2C2C2A] dark:text-[#E8E6DF]">
                Exam readiness
              </h2>
              <p className="text-[12.5px] text-[#888780] dark:text-[#6E6C67] mt-1">
                Across {subjects.length} subject{subjects.length !== 1 ? 's' : ''} ·{' '}
                {subjects.every((s) => s.diagnosticDone)
                  ? 'diagnostic complete'
                  : `${subjects.filter((s) => !s.diagnosticDone).length} diagnostic${subjects.filter((s) => !s.diagnosticDone).length !== 1 ? 's' : ''} pending`}
              </p>
            </div>
          </div>
          <Link
            href="/student/progress"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#D3D1C7] dark:border-[#4A4840] px-3.5 py-2 text-[12.5px] font-medium text-[#5F5E5A] dark:text-[#A8A69F] hover:bg-[#F1EFE8] dark:hover:bg-[#2E2C27] transition-colors min-h-[36px]"
          >
            Full report
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </Link>
        </div>

        {/* Subject grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sorted.map((s) => (
            <SubjectCard
              key={s.subjectId}
              subject={s}
              selected={s.subjectId === selectedId}
              onClick={() => setSelectedId(s.subjectId)}
            />
          ))}
        </div>

        {/* Chapter mastery for selected subject */}
        {selected && (
          <>
            <div className="h-px bg-[#E8E4DA] dark:bg-[#3A3830]" aria-hidden />

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-medium tracking-[0.08em] uppercase text-[#888780] dark:text-[#6E6C67]">
                  Chapter mastery
                </span>
                {/* Subject chip */}
                {(() => {
                  const colors = getSubjectColors(selected.subjectId)
                  const letter = (selected.subjectName[0] ?? '?').toUpperCase()
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
                      {selected.subjectName}
                    </span>
                  )
                })()}
              </div>

              <Link
                href={`/student/progress/${selected.subjectId}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#534AB7] hover:bg-[#4239A0] text-white px-4 py-2 text-[12.5px] font-semibold transition-colors min-h-[36px] shadow-[0_2px_0_#3C3489] active:translate-y-[1px]"
              >
                Study {selected.subjectName}
                <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </Link>
            </div>

            {selected.chapters.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#D3D1C7] dark:border-[#4A4840] bg-[#F8F6F1] dark:bg-[#2E2C27] p-4 text-center">
                {selected.diagnosticDone ? (
                  <p className="text-sm text-[#888780] dark:text-[#6E6C67]">No chapter data available yet.</p>
                ) : (
                  <>
                    <p className="text-sm text-[#888780] dark:text-[#6E6C67] mb-2">
                      Complete the diagnostic to see chapter-level mastery.
                    </p>
                    <Link
                      href={`/diagnostic/${selected.subjectId}`}
                      className="inline-flex items-center rounded-lg bg-[#534AB7] text-white text-xs font-semibold px-3.5 py-2 hover:bg-[#4239A0] min-h-[36px]"
                    >
                      Start diagnostic
                    </Link>
                  </>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {selected.chapters.map((ch) => (
                  <ChapterCard key={ch.chapterId} chapter={ch} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
