'use client'

/**
 * NavigationProgress
 *
 * Thin 3px progress bar at the very top of the page. Appears whenever the user
 * clicks an internal link and disappears when the new route renders.
 *
 * - Works with Next.js App Router (no router events needed)
 * - Uses usePathname() to detect when navigation completes
 * - Listens for clicks on <a> tags to detect when navigation starts
 * - Non-blocking: does not obscure content (unlike the full-screen spinner)
 * - Used in admin, student, and parent layouts
 */

import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

export function NavigationProgress() {
  const pathname = usePathname()
  const prevPath = useRef(pathname)
  const [active, setActive] = useState(false)
  const [pct, setPct] = useState(0)
  const fillTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // When pathname changes, navigation is complete -- fill to 100 then hide
  useEffect(() => {
    if (pathname === prevPath.current) return
    prevPath.current = pathname

    if (fillTimer.current) clearTimeout(fillTimer.current)
    if (hideTimer.current) clearTimeout(hideTimer.current)

    setPct(100)
    hideTimer.current = setTimeout(() => {
      setActive(false)
      setPct(0)
    }, 350)
  }, [pathname])

  // Listen for same-origin link clicks to start the bar
  useEffect(() => {
    function onLinkClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href) return
      // Skip external, hash-only, mailto, tel links
      if (
        href.startsWith('http') ||
        href.startsWith('//') ||
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:')
      ) return
      // Skip same-page (just hash change)
      if (href === window.location.pathname) return

      if (fillTimer.current) clearTimeout(fillTimer.current)
      if (hideTimer.current) clearTimeout(hideTimer.current)

      setActive(true)
      setPct(28)
      fillTimer.current = setTimeout(() => setPct(62), 350)
    }

    document.addEventListener('click', onLinkClick)
    return () => {
      document.removeEventListener('click', onLinkClick)
      if (fillTimer.current) clearTimeout(fillTimer.current)
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [])

  if (!active && pct === 0) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none"
      aria-hidden="true"
    >
      <div
        className="h-[3px] bg-[#534AB7]"
        style={{
          width: `${pct}%`,
          opacity: active || pct > 0 ? 1 : 0,
          transition: pct === 100
            ? 'width 200ms ease-out, opacity 300ms ease 50ms'
            : 'width 400ms ease-out',
        }}
      />
    </div>
  )
}
