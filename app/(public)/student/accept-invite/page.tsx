/**
 * FILE OBJECTIVE:
 * - /student/accept-invite?token=xxx
 * - No auth required. Validates the invite token, then renders the pre-populated
 *   InviteOnboardingForm for the child to set their password and activate the account.
 *
 * EDIT LOG:
 * - 2026-05-29 | claude | created for parent-invite child activation flow
 */

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import InviteOnboardingForm from '@/components/student/InviteOnboardingForm'
import type { InviteOnboardingInitialValues } from '@/components/student/InviteOnboardingForm'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ token?: string }>
}

export default async function AcceptInvitePage({ searchParams }: PageProps) {
  const params = await searchParams
  const token = params.token ?? ''

  if (!token) {
    redirect('/auth/role')
  }

  // Resolve invite token server-side to pre-populate the form
  const user = await prisma.user.findUnique({
    where: { inviteToken: token },
    select: {
      id: true,
      name: true,
      email: true,
      grade: true,
      board: true,
      language: true,
      dateOfBirth: true,
      inviteTokenExpiry: true,
      inviteAcceptedAt: true,
    },
  })

  if (!user) {
    return <InviteErrorPage message="This invite link is invalid or has already been used." />
  }

  if (user.inviteAcceptedAt) {
    return (
      <InviteErrorPage
        message="This account has already been activated."
        ctaLabel="Sign in"
        ctaHref="/auth/login"
      />
    )
  }

  if (user.inviteTokenExpiry && user.inviteTokenExpiry < new Date()) {
    return (
      <InviteErrorPage message="This invite link has expired. Ask your parent to send a new invite from their dashboard." />
    )
  }

  const initialValues: InviteOnboardingInitialValues = {
    name: user.name ?? '',
    email: user.email ?? null,
    grade: user.grade ?? null,
    board: user.board ?? null,
    medium: user.language ?? null,
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString().split('T')[0] : null,
  }

  return (
    <InviteOnboardingForm
      studentId={user.id}
      token={token}
      initialValues={initialValues}
      parentLinked={true}
    />
  )
}

function InviteErrorPage({
  message,
  ctaLabel = 'Go to sign up',
  ctaHref = '/auth/role',
}: {
  message: string
  ctaLabel?: string
  ctaHref?: string
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-bg">
          <svg className="h-7 w-7 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <div className="space-y-2">
          <h1 className="font-brand text-xl font-bold text-foreground">Invite link problem</h1>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <a
          href={ctaHref}
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-primary px-6 font-semibold text-white shadow-press transition-opacity hover:opacity-90"
        >
          {ctaLabel}
        </a>
      </div>
    </div>
  )
}
