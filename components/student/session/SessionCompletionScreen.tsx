'use client'

import React, { useEffect, useRef, useState } from 'react'
import SessionRatingModal from '@/components/student/session/SessionRatingModal'

interface SessionCompletionScreenProps {
  sessionId: string
  sessionSummary: {
    tag: string
    stage: string
    turnNumber: number
  }
  onNext: () => void
}

interface CompletionData {
  xpEarned: number
  totalXp: number
  leveledUp: boolean
  newLevel: number | null
  masteryDelta: number
  masteryAfter: number
  badgesEarned: { name: string; description: string }[]
  aiInsight: string | null
  sessionDurationMinutes: number
  correctAnswers: number
  totalQuestions: number
}

export const SessionCompletionScreen: React.FC<SessionCompletionScreenProps> = ({
  sessionId,
  sessionSummary: _sessionSummary,
  onNext,
}) => {
  const [data, setData] = useState<CompletionData | null>(null)
  const [xpDisplay, setXpDisplay] = useState(0)
  const [showLevelOverlay, setShowLevelOverlay] = useState(false)
  const [overlayDone, setOverlayDone] = useState(false)
  const [aiInsightVisible, setAiInsightVisible] = useState(false)
  const [showRating, setShowRating] = useState(false)
  const [ratingModalDone, setRatingModalDone] = useState(false)

  const xpAnimationRef = useRef<number | null>(null)
  const xpStartTimeRef = useRef<number | null>(null)

  // Fetch completion data once
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`/api/student/session/${encodeURIComponent(sessionId)}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        })
        const json = (await res.json().catch(() => null)) as CompletionData | null
        if (!cancelled && json) {
          setData(json)
        }
      } catch {
        // fall back to a safe default if needed
        if (!cancelled) {
          setData({
            xpEarned: 100,
            totalXp: 1000,
            leveledUp: false,
            newLevel: null,
            masteryDelta: 0.1,
            masteryAfter: 0.75,
            badgesEarned: [],
            aiInsight: null,
            sessionDurationMinutes: 30,
            correctAnswers: 10,
            totalQuestions: 12,
          })
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [sessionId])

  // XP animation (requestAnimationFrame over 1.2s)
  useEffect(() => {
    if (!data) return
    const duration = 1200
    const target = data.xpEarned
    cancelAnimationFrame(xpAnimationRef.current ?? 0)
    xpStartTimeRef.current = null

    const step = (ts: number) => {
      if (xpStartTimeRef.current == null) xpStartTimeRef.current = ts
      const elapsed = ts - xpStartTimeRef.current
      const progress = Math.min(elapsed / duration, 1)
      const value = Math.round(target * progress)
      setXpDisplay(value)
      if (progress < 1) {
        xpAnimationRef.current = requestAnimationFrame(step)
      }
    }

    xpAnimationRef.current = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(xpAnimationRef.current ?? 0)
    }
  }, [data])

  // Level-up overlay for minimum 1.5s
  useEffect(() => {
    if (!data) return
    if (!data.leveledUp) {
      setShowLevelOverlay(false)
      setOverlayDone(true)
      return
    }
    setShowLevelOverlay(true)
    setOverlayDone(false)
    const timer = setTimeout(() => {
      setShowLevelOverlay(false)
      setOverlayDone(true)
    }, 1500)
    return () => clearTimeout(timer)
  }, [data])

  // AI insight skeleton delay (3s)
  useEffect(() => {
    if (!data) return
    const timer = setTimeout(() => setAiInsightVisible(true), 3000)
    return () => clearTimeout(timer)
  }, [data])

  // Show rating modal 1.5s after XP animation completes (or data loads)
  useEffect(() => {
    if (!data) return
    const t = setTimeout(() => setShowRating(true), 1500)
    return () => clearTimeout(t)
  }, [data])

  const handleNext = () => {
    if (!ratingModalDone) return
    onNext()
  }

  if (!data) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
        <div className="h-6 w-24 animate-pulse rounded bg-gray-200" />
        <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
      </div>
    )
  }

  const masteryDeltaPercent = Math.round(data.masteryDelta * 100)
  const masteryAfterPercent = Math.round(data.masteryAfter * 100)
  const masteryPositive = masteryDeltaPercent >= 0

  const aiInsightText =
    data.aiInsight && data.aiInsight.trim()
      ? data.aiInsight
      : 'Great session! Keep it up.'

  return (
    <div className="relative flex h-full flex-col rounded-lg border border-gray-200 bg-white p-4">
      {showRating && (
        <SessionRatingModal
          sessionId={sessionId}
          onClose={() => {
            setShowRating(false)
            setRatingModalDone(true)
          }}
        />
      )}

      {/* Level-up overlay */}
      {showLevelOverlay && data.leveledUp && data.newLevel != null && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70">
          <div className="text-center text-white">
            <div className="text-xs uppercase tracking-wide text-amber-300">Level Up!</div>
            <div className="mt-2 text-5xl font-extrabold text-amber-200">Level {data.newLevel}</div>
            <div className="mt-3 text-sm text-amber-100">
              Fantastic work this session. Your consistent effort is paying off.
            </div>
          </div>
        </div>
      )}

      {/* XP counter */}
      <div className="mb-4 flex flex-col items-center">
        <div className="text-xs uppercase tracking-wide text-gray-500">XP Earned</div>
        <div className="mt-1 text-4xl font-extrabold text-emerald-500">{xpDisplay}</div>
        <div className="mt-1 text-xs text-gray-500">
          Total XP: <span className="font-semibold">{data.totalXp}</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="mb-4 grid grid-cols-3 gap-2 text-center text-xs sm:text-sm">
        <div>
          <div className="text-gray-500">Mastery</div>
          <div
            className={masteryPositive ? 'font-semibold text-emerald-600' : 'font-semibold text-red-600'}
          >
            {masteryPositive ? '+' : ''}
            {masteryDeltaPercent}% ({masteryAfterPercent}% total)
          </div>
        </div>
        <div>
          <div className="text-gray-500">Accuracy</div>
          <div className="font-semibold text-gray-800">
            {data.correctAnswers}/{data.totalQuestions}
          </div>
        </div>
        <div>
          <div className="text-gray-500">Duration</div>
          <div className="font-semibold text-gray-800">
            {data.sessionDurationMinutes} min
          </div>
        </div>
      </div>

      {/* Badges row */}
      {data.badgesEarned.length > 0 && (
        <div className="mb-4">
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
            Badges Earned
          </div>
          <div className="flex flex-wrap gap-2">
            {data.badgesEarned.map((b) => (
              <div
                key={b.name}
                className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-medium text-indigo-700"
                title={b.description}
              >
                {b.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI insight */}
      <div className="mb-4">
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
          AI Insight
        </div>
        {!aiInsightVisible ? (
          <div className="space-y-2">
            <div className="h-3 w-9/12 animate-pulse rounded bg-gray-200" />
            <div className="h-3 w-10/12 animate-pulse rounded bg-gray-200" />
            <div className="h-3 w-7/12 animate-pulse rounded bg-gray-200" />
          </div>
        ) : (
          <div className="text-sm text-gray-800 transition-opacity duration-300">
            {aiInsightText}
          </div>
        )}
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={handleNext}
        disabled={!ratingModalDone || !overlayDone}
        className="mt-auto w-full rounded-lg bg-indigo-600 px-4 py-2 text-center text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        Continue Learning
      </button>
    </div>
  )
}

