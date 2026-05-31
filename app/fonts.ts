import localFont from 'next/font/local'
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google'

// Centralized font instances to avoid Next.js hydration mismatches
// Reuse these across all layouts to ensure stable class names between server and client.
export const inter = localFont({ src: '../public/fonts/inter-latin-variable.woff2', variable: '--font-inter', display: 'swap' })
export const nunito = localFont({ src: '../public/fonts/nunito-variable-latin.woff2', variable: '--font-nunito', display: 'swap' })

export const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-plus-jakarta',
  display: 'swap',
})

export const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jetbrains',
  display: 'swap',
})
