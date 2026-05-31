import { ThemeProvider } from '@/context/ThemeContext'

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>
}
