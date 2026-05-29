/**
 * Minimal layout for parent entry routes (onboarding).
 * Provides HTML shell + SessionProvider but NO role gate.
 * The (parent) layout gates on role === 'parent', which would block
 * users who are in the process of being assigned the parent role.
 * Pages in this group handle their own auth redirects client-side.
 */
import type { Viewport } from 'next'
import Providers from '@/app/providers'
import '@/styles/index.css'
import { inter, nunito } from '@/app/fonts'

export const viewport: Viewport = {
  themeColor: '#534AB7',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function ParentEntryLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${inter.variable} ${nunito.variable}`}>
      <body className="font-sans antialiased min-h-screen bg-gray-50 dark:bg-gray-950">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
