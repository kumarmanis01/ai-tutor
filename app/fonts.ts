import localFont from 'next/font/local'

// Centralized font instances to avoid Next.js hydration mismatches
// Reuse these across all layouts to ensure stable class names between server and client.
export const inter = localFont({ src: '../public/fonts/inter-latin-variable.woff2', variable: '--font-inter', display: 'swap' })
export const nunito = localFont({ src: '../public/fonts/nunito-variable-latin.woff2', variable: '--font-nunito', display: 'swap' })
