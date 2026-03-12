'use client'

import useSWR from 'swr'

export interface RevisionDueItem {
  conceptId: string
  conceptName: string
  subjectName: string
  masteryScore: number
  retention: number
  nextReviewAt: string
  overdueByDays: number
}

export interface RevisionsDueTodayData {
  revisions: RevisionDueItem[]
  totalDue: number
}

const fetcher = async (url: string) => {
  const r = await fetch(url)
  const data = await r.json()
  if (!r.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Request failed')
  return data
}

export function useRevisionsDueToday() {
  const { data, error, isLoading, mutate } = useSWR<RevisionsDueTodayData>(
    '/api/student/revisions/due-today',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  )

  return {
    revisions: data?.revisions ?? [],
    totalDue: data?.totalDue ?? 0,
    loading: isLoading,
    error: error ? (error as Error).message : null,
    retry: mutate,
  }
}
