'use client'

/**
 * RevisionFlow -- Task 31 (v2 Screen 13)
 *
 * Full-screen revision card flow (SM-18 spaced repetition).
 *
 * States per card:
 *   answering → correct feedback → next | wrong feedback + explanation → next
 *
 * After all cards:
 *   Summary: N/N correct
 *   > 80%: green card "Great work! Your memory of this topic is strengthening."
 *   ≤ 80%: amber card "We'll add a re-teach session to your plan."
 *         → fires POST /api/student/revision/complete (non-blocking)
 *
 * Copy rules: never "broke / missed / failed / lost". Forward-looking tone.
 */

import React, { useCallback, useRef, useState } from 'react'
import Link from 'next/link'

// ── Types ────────────────────────────────────────────────────────────────────

export type RevisionCard = {
  conceptId: string
  conceptName: string
  subjectName: string
  questionId: string
  prompt: string
  choices: string[]
  correctAnswer: string
}

type CardResult = {
  card: RevisionCard
  isCorrect: boolean
  selectedOption: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DAILY_CAP_MINUTES = 20
const DAILY_CAP_MS = DAILY_CAP_MINUTES * 60 * 1000

// Map subject name to a plausible error type label for wrong answers.
function errorTypeLabel(subjectName: string): string {
  const s = subjectName.toLowerCase()
  if (s.includes('math') || s.includes('maths')) return 'Sign error or formula confusion'
  if (s.includes('physics')) return 'Unit error or formula confusion'
  if (s.includes('chemistry')) return 'Unit error'
  if (s.includes('biology') || s.includes('bio')) return 'Reasoning gap'
  return 'Procedural error'
}

/** Returns the correct option text from a card, handling both full-text and index answers. */
function resolveCorrectText(card: RevisionCard): string {
  const idx = parseInt(card.correctAnswer, 10)
  if (!isNaN(idx) && idx >= 0 && idx < card.choices.length) {
    return card.choices[idx]
  }
  return card.correctAnswer
}

function isAnswerCorrect(card: RevisionCard, selected: string): boolean {
  if (card.correctAnswer === selected) return true
  const idx = parseInt(card.correctAnswer, 10)
  if (!isNaN(idx) && idx >= 0 && idx < card.choices.length) {
    return card.choices[idx] === selected
  }
  return false
}

// ── Score summary helpers ─────────────────────────────────────────────────────

async function postRevisionComplete(conceptId: string, score: number): Promise<void> {
  try {
    await fetch('/api/student/revision/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conceptId, score }),
    })
  } catch {
    // Fire-and-forget; ignore errors
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface RevisionFlowProps {
  cards: RevisionCard[]
  totalDue: number
}

export default function RevisionFlow({ cards, totalDue }: RevisionFlowProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [results, setResults] = useState<CardResult[]>([])
  const [done, setDone] = useState(false)
  const startTimeRef = useRef(Date.now())
  const [capReached, setCapReached] = useState(false)

  const card = cards[currentIndex]
  const totalCards = cards.length
  const completedCount = currentIndex + (submitted ? 1 : 0)

  // Check daily cap
  const elapsedMs = Date.now() - startTimeRef.current
  const isOverCap = elapsedMs >= DAILY_CAP_MS

  const handleSelectOption = useCallback((option: string) => {
    if (submitted) return
    setSelectedOption(option)
  }, [submitted])

  const handleSubmit = useCallback(() => {
    if (!selectedOption || submitted || !card) return

    // Check daily cap before advancing
    const now = Date.now()
    const elapsed = now - startTimeRef.current
    if (elapsed >= DAILY_CAP_MS) {
      setCapReached(true)
      return
    }

    const isCorrect = isAnswerCorrect(card, selectedOption)
    setResults((prev) => [...prev, { card, isCorrect, selectedOption }])
    setSubmitted(true)
  }, [selectedOption, submitted, card])

  const handleNext = useCallback(() => {
    // Post completion for this concept (fire-and-forget)
    const _conceptResults = results.filter((r) => r.card.conceptId === card.conceptId)
    const lastResult = results[results.length - 1]
    if (lastResult) {
      const conceptCards = cards.filter((c) => c.conceptId === lastResult.card.conceptId)
      const conceptCorrect = results.filter((r) => r.card.conceptId === lastResult.card.conceptId && r.isCorrect).length
      const conceptScore = conceptCards.length > 0 ? conceptCorrect / conceptCards.length : 0
      void postRevisionComplete(lastResult.card.conceptId, conceptScore)
    }

    if (currentIndex + 1 >= totalCards) {
      setDone(true)
    } else {
      setCurrentIndex((i) => i + 1)
      setSelectedOption(null)
      setSubmitted(false)
    }
  }, [currentIndex, totalCards, results, card, cards])

  // ── Daily cap screen ──────────────────────────────────────────────────────
  if (capReached || (isOverCap && !submitted && !done)) {
    return (
      <div className="fixed inset-0 z-[100] bg-white dark:bg-gray-950 flex flex-col items-center justify-center px-4 py-12 text-center">
        <div className="text-4xl mb-4">⏰</div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Daily cap reached.
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Come back tomorrow -- you can do more then!
        </p>
        <Link
          href="/student/dashboard"
          className="inline-flex items-center justify-center rounded-xl bg-[#534AB7] text-white text-sm font-semibold px-6 min-h-[44px]"
        >
          Back to dashboard
        </Link>
      </div>
    )
  }

  // ── Done / summary screen ─────────────────────────────────────────────────
  if (done) {
    // Post completion for remaining concepts
    const allCorrect = results.filter((r) => r.isCorrect).length
    const total = results.length
    const scoreRatio = total > 0 ? allCorrect / total : 0
    const isGood = scoreRatio > 0.8

    // Group by concept and fire completion for each
    const conceptMap = new Map<string, { correct: number; total: number }>()
    for (const r of results) {
      const entry = conceptMap.get(r.card.conceptId) ?? { correct: 0, total: 0 }
      entry.total += 1
      if (r.isCorrect) entry.correct += 1
      conceptMap.set(r.card.conceptId, entry)
    }
    // Note: postRevisionComplete for last card was already called in handleNext -- skip duplicate

    return (
      <div className="fixed inset-0 z-[100] bg-white dark:bg-gray-950 flex flex-col px-4 py-safe-top">
        {/* Header */}
        <div className="py-4 border-b border-gray-100 dark:border-slate-800 mb-6">
          <h1 className="text-base font-semibold text-gray-900 dark:text-white text-center">
            Revision complete
          </h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-6 max-w-sm mx-auto w-full">
          {/* Score */}
          <div className="text-center">
            <p className="text-5xl font-bold text-gray-900 dark:text-white mb-1">
              {allCorrect}/{total}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">correct</p>
          </div>

          {/* Feedback card */}
          {isGood ? (
            <div className="w-full rounded-2xl bg-[#EAF3DE] dark:bg-[#1D9E75]/10 p-5 text-center">
              <p className="text-base font-semibold text-[#1D9E75] mb-1">
                Great work!
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Your memory of this topic is strengthening.
              </p>
            </div>
          ) : (
            <div className="w-full rounded-2xl bg-[#FAEEDA] dark:bg-[#BA7517]/10 p-5 text-center">
              <p className="text-base font-semibold text-[#BA7517] mb-1">
                Keep going -- you&apos;re making progress.
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                We&apos;ll add a re-teach session to your plan to help strengthen these topics.
              </p>
            </div>
          )}

          {/* CTA */}
          <Link
            href="/student/dashboard"
            className="w-full inline-flex items-center justify-center rounded-xl bg-[#534AB7] text-white text-sm font-semibold min-h-[44px] hover:bg-[#4840a3] transition-colors"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    )
  }

  // ── Active card ───────────────────────────────────────────────────────────
  if (!card) return null

  const isCorrect = submitted && selectedOption !== null && isAnswerCorrect(card, selectedOption)
  const _isWrong = submitted && !isCorrect
  const correctText = resolveCorrectText(card)
  const errType = errorTypeLabel(card.subjectName)

  // Cap indicator: show warning when > 15 min elapsed
  const elapsedMinutes = Math.floor((Date.now() - startTimeRef.current) / 60000)
  const nearCap = elapsedMinutes >= 15

  return (
    <div className="fixed inset-0 z-[100] bg-white dark:bg-gray-950 flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 bg-white dark:bg-gray-950 border-b border-gray-100 dark:border-slate-800 px-4 py-3 flex items-center justify-between min-h-[44px] z-10">
        <h1 className="text-sm font-semibold text-gray-900 dark:text-white">
          Revision cards
        </h1>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {totalDue} due · {DAILY_CAP_MINUTES} min cap
          </span>
          {nearCap && (
            <span className="text-[10px] text-[#BA7517] font-medium">
              ⏰ Approaching daily cap
            </span>
          )}
        </div>
      </div>

      {/* ── Progress bar ───────────────────────────────────────────────── */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {completedCount} of {totalCards} complete today
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Card {currentIndex + 1} of {totalCards}
          </span>
        </div>
        <div className="h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#534AB7] rounded-full transition-all duration-300"
            style={{ width: `${Math.max(4, (completedCount / totalCards) * 100)}%` }}
          />
        </div>
      </div>

      {/* ── Scrollable card area ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        {/* Subject badge + meta */}
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EAF3DE] text-[#1D9E75] text-xs font-semibold">
            {card.subjectName}
          </span>
          <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
            <span>Spaced repetition</span>
            <span>·</span>
            <span>Card {currentIndex + 1} of {totalCards}</span>
          </div>
        </div>

        {/* Concept name */}
        <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-snug">
          {card.conceptName}
        </h2>

        {/* Question text */}
        <p className="text-[15px] leading-7 text-gray-800 dark:text-gray-100">
          {card.prompt}
        </p>

        {/* MCQ options */}
        <div className="flex flex-col gap-3" role="radiogroup" aria-label="Answer options">
          {card.choices.map((choice, idx) => {
            const isSelected = selectedOption === choice
            const correctOption = resolveCorrectText(card)
            const isCorrectChoice = choice === correctOption

            let optionClass =
              'w-full min-h-[52px] px-4 py-3 rounded-xl border-2 text-left text-sm leading-snug transition-all'

            if (!submitted) {
              optionClass += isSelected
                ? ' border-[#534AB7] bg-[#EEEDFE] dark:bg-[#534AB7]/20 text-[#534AB7] dark:text-indigo-300 font-medium'
                : ' border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-200 hover:border-[#534AB7]/40 hover:bg-[#EEEDFE]/30 dark:hover:bg-[#534AB7]/5'
            } else if (isCorrectChoice) {
              optionClass += ' border-[#1D9E75] bg-[#EAF3DE] dark:bg-[#1D9E75]/10 text-[#1D9E75] font-medium'
            } else if (isSelected && !isCorrectChoice) {
              optionClass += ' border-[#E24B4A] bg-[#FCEBEB] dark:bg-[#E24B4A]/10 text-[#E24B4A] font-medium'
            } else {
              optionClass += ' border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-400 dark:text-gray-500'
            }

            return (
              <button
                key={idx}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={submitted}
                onClick={() => handleSelectOption(choice)}
                className={optionClass}
              >
                {choice}
                {submitted && isCorrectChoice && (
                  <span className="ml-2 text-[#1D9E75]" aria-hidden="true">✓</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Feedback after answer */}
        {submitted && (
          <div
            className={[
              'rounded-2xl p-4',
              isCorrect
                ? 'bg-[#EAF3DE] dark:bg-[#1D9E75]/10'
                : 'bg-[#FCEBEB] dark:bg-[#E24B4A]/10',
            ].join(' ')}
            role="alert"
          >
            {isCorrect ? (
              <p className="text-sm font-semibold text-[#1D9E75]">Correct! ✓</p>
            ) : (
              <>
                <p className="text-sm font-semibold text-[#E24B4A] mb-1">Not quite.</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                  <span className="font-medium">Correct answer:</span> {correctText}
                </p>
                <span className="inline-block text-xs font-medium text-[#E24B4A] bg-[#FCEBEB] dark:bg-[#E24B4A]/20 px-2 py-0.5 rounded">
                  {errType}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom actions ──────────────────────────────────────────────── */}
      <div className="sticky bottom-0 bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-slate-800 px-4 py-4 pb-safe-bottom">
        {!submitted ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedOption}
            className="w-full min-h-[44px] rounded-xl bg-[#534AB7] text-white text-sm font-semibold disabled:opacity-50 hover:bg-[#4840a3] active:scale-[0.98] transition-all shadow-md shadow-[#534AB7]/25"
          >
            Check answer
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            className="w-full min-h-[44px] rounded-xl bg-[#534AB7] text-white text-sm font-semibold hover:bg-[#4840a3] active:scale-[0.98] transition-all shadow-md shadow-[#534AB7]/25"
          >
            {currentIndex + 1 >= totalCards ? 'See results' : 'Next card'}
          </button>
        )}
      </div>
    </div>
  )
}
