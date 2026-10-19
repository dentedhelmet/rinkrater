'use client'

/**
 * Remembers which rink page someone was reading (and how far down) when they
 * tap a blog post under "In the news", so they can get straight back to it.
 *
 * Kept in sessionStorage: it belongs to this browser tab only, survives the
 * page change, and disappears when the tab closes. Expires after 30 minutes
 * so an old visit never hijacks a later one.
 */

const KEY = 'rr-return-rink'
const MAX_AGE_MS = 30 * 60_000

export interface ReturnRink {
  rinkId:    string
  rinkName:  string
  postSlug:  string   // the post they opened from the rink page
  scrollTop: number   // how far down the rink page they were
  at:        number
}

function read(): ReturnRink | null {
  try {
    const raw = window.sessionStorage.getItem(KEY)
    if (!raw) return null
    const r = JSON.parse(raw) as ReturnRink
    if (Date.now() - r.at > MAX_AGE_MS) {
      window.sessionStorage.removeItem(KEY)
      return null
    }
    return r
  } catch {
    return null
  }
}

/** Called when a post is tapped on a rink page. */
export function rememberRink(r: Omit<ReturnRink, 'at'>) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify({ ...r, at: Date.now() }))
  } catch { /* private mode etc. — Back still works, just without the scroll position */ }
}

/** On a blog post: the rink this post was opened from, if any. */
export function cameFromRink(postSlug: string): ReturnRink | null {
  const r = read()
  return r && r.postSlug === postSlug ? r : null
}

/**
 * On a rink page: the saved scroll position for this rink, used once.
 * Returns null if there's nothing to restore.
 */
export function takeRinkScroll(rinkId: string): number | null {
  const r = read()
  if (!r || r.rinkId !== rinkId) return null
  try { window.sessionStorage.removeItem(KEY) } catch { /* ignore */ }
  return r.scrollTop > 0 ? r.scrollTop : null
}
