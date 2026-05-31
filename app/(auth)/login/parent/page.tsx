'use client'
import { Suspense } from 'react'
import { AuthScreen } from '@/components/ui/AuthScreen'

export default function ParentLoginPage() {
  return (
    <Suspense>
      <AuthScreen role="parent" />
    </Suspense>
  )
}
