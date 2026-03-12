'use client'

import useSWR from 'swr'

export interface NextReviewItem {
  conceptName: string
  nextReviewAt: string
  daysUntil: number
}

export interface RevisionsUpcomingData {
  nextReview: NextReviewItem | null
}

const fetcher = async (url: string) => {
  const r = await fetch(url)
  const data = await r.json()
  if (!r.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Request failed')
  return data
}

export function useRevisionsUpcoming() {
  const { data, error, isLoading } = useSWR<RevisionsUpcomingData>(
    '/api/student/revisions/upcoming',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  )

  return {
    nextReview: data?.nextReview ?? null,
    loading: isLoading,
    error: error ? (error as Error).message : null,
  }
}
