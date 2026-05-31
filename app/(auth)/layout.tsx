import type { Viewport } from 'next'
import Providers from '@/app/providers'
import { ThemeProvider } from '@/context/ThemeContext'
import { inter, nunito, plusJakartaSans, jetBrainsMono } from '@/app/fonts'
import '@/styles/index.css'

export const viewport: Viewport = {
  themeColor: '#0d9488',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${inter.variable} ${nunito.variable} ${plusJakartaSans.variable} ${jetBrainsMono.variable}`}>
      <body className="font-sans antialiased min-h-screen">
        <Providers>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  )
}
