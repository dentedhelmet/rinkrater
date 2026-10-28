'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Tells /api/visit when a NEW visit starts, so the Live Visitors page can ding.
 *
 * A visit = activity with no gap longer than 30 minutes (same rule as GA).
 * Clicking around between rinks during a visit does not send anything more.
 *
 * Skipped for: local dev, /admin pages, automated browsers, and any browser
 * where an admin has opened the Live Visitors page (it sets IGNORE_KEY), so
 * your own browsing never dings.
 */

const VISIT_KEY = 'rr-visit'
export const IGNORE_KEY = 'rr-ignore-visits'
const SESSION_MS = 30 * 60 * 1000

export function VisitBeacon() {
  const pathname = usePathname()

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!pathname || pathname.startsWith('/admin')) return
    if (typeof navigator !== 'undefined' && navigator.webdriver) return

    let visitId: string
    try {
      if (localStorage.getItem(IGNORE_KEY) === '1') return

      const now = Date.now()
      const raw = localStorage.getItem(VISIT_KEY)
      const prev = raw ? (JSON.parse(raw) as { id?: string; last?: number }) : null

      if (prev?.id && typeof prev.last === 'number' && now - prev.last < SESSION_MS) {
        // Same visit — just keep it alive.
        localStorage.setItem(VISIT_KEY, JSON.stringify({ id: prev.id, last: now }))
        return
      }

      visitId = crypto.randomUUID()
      localStorage.setItem(VISIT_KEY, JSON.stringify({ id: visitId, last: now }))
    } catch {
      // No storage (private mode, blocked) — we can't tell visits apart, so skip.
      return
    }

    let referrer = ''
    try {
      referrer = document.referrer ? new URL(document.referrer).hostname : ''
    } catch {
      referrer = ''
    }

    fetch('/api/visit', {
      method:    'POST',
      headers:   { 'Content-Type': 'application/json' },
      body:      JSON.stringify({ visitId, path: pathname, referrer }),
      keepalive: true,
    }).catch(() => {
      // The ding must never break the site.
    })
  }, [pathname])

  return null
}
