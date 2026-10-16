'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { trackPageView } from '@/lib/analytics'

const TITLE_WAIT_MS = 1500

/**
 * Sends a GA page view after each in-app navigation, once the new page's
 * title is in place. (Next.js changes the URL a moment before the title, so
 * GA's own automatic tracking records the previous page's title.)
 *
 * The very first page load is already counted by the GA tag itself, so it's
 * skipped here. Requires GA's "Page changes based on browser history events"
 * setting to be OFF, otherwise navigations would be counted twice.
 */
export function GaRouteTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isFirst = useRef(true)
  const lastTitle = useRef<string>('')

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false
      lastTitle.current = document.title
      return
    }

    const previousTitle = lastTitle.current
    let sent = false
    const send = () => {
      if (sent) return
      sent = true
      observer.disconnect()
      window.clearTimeout(timer)
      lastTitle.current = document.title
      trackPageView()
    }

    // Send as soon as the title changes, or after a short wait if this page
    // happens to share the previous page's title.
    const observer = new MutationObserver(() => {
      if (document.title && document.title !== previousTitle) send()
    })
    observer.observe(document.head, { subtree: true, childList: true, characterData: true })
    const timer = window.setTimeout(send, TITLE_WAIT_MS)

    if (document.title !== previousTitle) send()

    return () => {
      // Navigated again before this one settled — count it with what we have.
      if (!sent) send()
    }
  }, [pathname, searchParams])

  return null
}
