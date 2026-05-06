'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'

export default function ParentOnboardingPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/parent/dashboard')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center space-y-4">
        <div className="flex justify-center mb-4">
          <Logo variant="auth" />
        </div>
        <div className="w-8 h-8 border-2 border-[#534AB7] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Setting up your account...</p>
      </div>
    </div>
  )
}
