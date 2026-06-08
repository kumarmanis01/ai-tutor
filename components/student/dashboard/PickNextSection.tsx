'use client'

/**
 * FILE OBJECTIVE:
 * - Render the "Want something extra?" section with Warm-ups / Browse syllabus / Surprise me tabs.
 *
 * EDIT LOG:
 * - 2026-06-08T00:00:00Z | claude | route Surprise me to /session/[topicId] directly (skip pre-session)
 */

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/toast'
import { getSubjectColors } from '@/lib/student/dashboardMissions'

type Tab = 'warmups' | 'browse' | 'surprise'

interface WarmUpCard {
  subjectId: string
  subjectName: string
  title: string
  meta: string
  href: string
}

interface PickNextSectionProps {
  warmUps: WarmUpCard[]
}

const BROWSE_HREF = '/learn/learning-path'

export default function PickNextSection({ warmUps }: PickNextSectionProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('warmups')
  const [surpriseLoading, setSurpriseLoading] = useState(false)

  async function handleSurprise() {
    if (surpriseLoading) return
    setSurpriseLoading(true)
    try {
      const res = await fetch('/api/student/surprise-me')
      if (res.status === 401) {
        toast('Please sign in to use Surprise me')
        return
      }
      if (res.status === 204) {
        toast("No weak topic found -- showing your syllabus instead.")
        router.push(BROWSE_HREF)
        return
      }
      const json = await res.json()
      if (!res.ok) throw new Error((json?.error as string) || 'Failed to get suggestion')
      const action = json?.action
      if (!action?.topicId) {
        toast("Couldn't find a weak topic -- showing your syllabus instead.")
        router.push(BROWSE_HREF)
        return
      }
      router.push(`/session/${encodeURIComponent(action.topicId as string)}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not pick a surprise topic'
      toast(msg)
      router.push(BROWSE_HREF)
    } finally {
      setSurpriseLoading(false)
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'warmups', label: 'Warm-ups' },
    { id: 'browse', label: 'Browse syllabus' },
    { id: 'surprise', label: '🎲 Surprise me' },
  ]

  return (
    <section className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg sm:text-[18px] font-semibold text-[#5F5E5A] dark:text-[#A8A69F]">
          Want something extra?
        </h2>

        {/* Segmented control */}
        <div className="flex items-center rounded-full bg-[#EAE6DC] dark:bg-[#26241F] p-[3px] gap-[2px]" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                if (tab.id === 'surprise') handleSurprise()
                if (tab.id === 'browse') router.push(BROWSE_HREF)
              }}
              disabled={tab.id === 'surprise' && surpriseLoading}
              className={[
                'rounded-full px-3.5 py-1.5 text-xs font-medium leading-none transition-all min-h-[32px] whitespace-nowrap',
                activeTab === tab.id
                  ? 'bg-white dark:bg-[#3A3830] text-[#2C2C2A] dark:text-[#E8E6DF] shadow-sm'
                  : 'text-[#5F5E5A] dark:text-[#A8A69F] hover:text-[#2C2C2A] dark:hover:text-[#E8E6DF]',
                tab.id === 'surprise' && surpriseLoading ? 'opacity-60' : '',
              ].join(' ')}
            >
              {tab.id === 'surprise' && surpriseLoading ? 'Picking...' : tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Warm-up cards */}
      {activeTab === 'warmups' && warmUps.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {warmUps.map((card, i) => (
            <WarmUpCard key={`${card.subjectId}-${i}`} card={card} />
          ))}
        </div>
      )}

      {activeTab === 'warmups' && warmUps.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#D3D1C7] dark:border-[#4A4840] bg-[#F8F6F1] dark:bg-[#26241F] p-5 text-center">
          <p className="text-sm text-[#888780] dark:text-[#6E6C67]">No extra warm-ups available right now.</p>
          <Link
            href={BROWSE_HREF}
            className="mt-2 inline-flex items-center text-xs font-medium text-[#534AB7] dark:text-[#AFA9EC] hover:underline"
          >
            Browse your full syllabus &rarr;
          </Link>
        </div>
      )}
    </section>
  )
}

function WarmUpCard({ card }: { card: WarmUpCard }) {
  const colors = getSubjectColors(card.subjectId)
  const letter = (card.subjectName[0] ?? '?').toUpperCase()

  return (
    <Link
      href={card.href}
      className="flex flex-col gap-2.5 rounded-2xl border border-[#E3DDD0] dark:border-[#3A3830] bg-[#F8F6F1] dark:bg-[#26241F] p-[14px] hover:bg-[#F2EEE4] dark:hover:bg-[#2E2C27] transition-colors group"
    >
      {/* Subject chip */}
      <span
        className="inline-flex items-center gap-1.5 self-start rounded-full text-[11px] font-medium leading-none"
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
        {card.subjectName}
      </span>

      <p className="text-[17px] font-semibold text-[#2C2C2A] dark:text-[#E8E6DF] leading-snug group-hover:text-[#534AB7] dark:group-hover:text-[#AFA9EC] transition-colors">
        {card.title}
      </p>
      <p className="text-[11.5px] text-[#888780] dark:text-[#6E6C67]">{card.meta}</p>
    </Link>
  )
}
