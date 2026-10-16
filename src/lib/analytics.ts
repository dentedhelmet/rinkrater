'use client'

import { sendGAEvent } from '@next/third-parties/google'

// Google Analytics helpers. Everything here is a no-op outside production
// builds, so local dev traffic never reaches GA.
//
// Privacy rule: never send what someone typed into Ask TJ, review text, names
// or emails. Event names and rink IDs only (plus rink search terms).

const enabled = () => process.env.NODE_ENV === 'production' && typeof window !== 'undefined'

export function trackEvent(name: string, params: Record<string, string | number | boolean | undefined> = {}) {
  if (!enabled()) return
  try {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined))
    sendGAEvent('event', name, clean)
  } catch {
    // Analytics must never break the site.
  }
}

/** Sends a page view with the page's real title (see GaRouteTracker). */
export function trackPageView() {
  trackEvent('page_view', {
    page_title:    document.title,
    page_location: window.location.href,
    page_path:     window.location.pathname,
  })
}
