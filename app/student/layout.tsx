import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import Providers from '@/app/providers'
import '@/styles/index.css'

const inter = localFont({ src: '../../public/fonts/inter-latin-variable.woff2', variable: '--font-inter', display: 'swap' })
const nunito = localFont({ src: '../../public/fonts/nunito-variable-latin.woff2', variable: '--font-nunito', display: 'swap' })

export const viewport: Viewport = {
  themeColor: '#534AB7',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  title: 'Spinzy Academy',
  description: 'AI home tutor for Indian students',
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
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
