'use client'

import { Suspense } from 'react'
import { signIn } from 'next-auth/react'
import Logo from '@/components/Logo'

function AuthContent() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Branding */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <Logo variant="auth" className="mb-6" />
          </div>
          <div>
            <h1 className="text-xl font-brand font-bold text-gray-900 dark:text-white">Welcome to Spinzy Academy</h1>
            <p className="text-sm text-muted-foreground mt-1">AI home tutor · CBSE / ICSE · Grades 6-12</p>
          </div>
        </div>

        {/* Google Sign In -- only auth option */}
        <button
          onClick={() => signIn('google', { callbackUrl: '/auth/role' })}
          className="w-full flex items-center justify-center gap-3 px-4 py-4 min-h-[44px]
                     border border-gray-300 dark:border-gray-600 rounded-xl
                     bg-white dark:bg-gray-900 hover:bg-gray-50
                     dark:hover:bg-gray-800 transition-colors
                     text-gray-700 dark:text-gray-200 font-medium text-sm shadow-sm"
        >
          <svg width="20" height="20" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"/>
            <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.72.48-1.63.76-2.7.76-2.08 0-3.84-1.4-4.47-3.29H1.83v2.07A8 8 0 008.98 17z"/>
            <path fill="#FBBC05" d="M4.51 10.52A4.8 4.8 0 014.26 9c0-.53.09-1.04.25-1.52V5.41H1.83A8 8 0 001 9c0 1.29.31 2.51.83 3.59l2.68-2.07z"/>
            <path fill="#EA4335" d="M8.98 3.58c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.51 7.48C5.14 5.6 6.9 3.58 8.98 3.58z"/>
          </svg>
          Continue with Google
        </button>

        {/* Trust line */}
        <p className="text-center text-xs text-gray-400">3 free sessions every month · No credit card required</p>
      </div>
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#534AB7] border-t-transparent rounded-full animate-spin"/>
      </div>
    }>
      <AuthContent />
    </Suspense>
  )
}
