'use client'
import { Suspense } from 'react'
import { AuthScreen } from '@/components/ui/AuthScreen'

export default function StudentLoginPage() {
  return (
    <Suspense>
      <AuthScreen role="student" />
    </Suspense>
  )
}
