import { ThemeProvider } from '@/context/ThemeContext'

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>
}
