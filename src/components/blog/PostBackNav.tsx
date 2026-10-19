'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { cameFromRink, type ReturnRink } from '@/lib/returnToRink'
import styles from './blog.module.css'

/** Reads (after mount) whether this post was opened from a rink page. */
function useReturnRink(slug: string): ReturnRink | null {
  const [from, setFrom] = useState<ReturnRink | null>(null)
  useEffect(() => { setFrom(cameFromRink(slug)) }, [slug])
  return from
}

/**
 * Going back to the rink: step back in history when we can (so the browser's
 * own Back stays tidy), otherwise open the rink page directly. Either way the
 * rink page puts you back where you were reading.
 */
function useGoBackToRink(from: ReturnRink | null) {
  const router = useRouter()
  return () => {
    if (!from) return
    if (window.history.length > 1) router.back()
    else router.push(`/rink/${encodeURIComponent(from.rinkId)}`)
  }
}

/** Top bar for a post. Back goes to the rink you came from, or to the blog. */
export function PostTopBar({ slug }: { slug: string }) {
  const from = useReturnRink(slug)
  const goBack = useGoBackToRink(from)
  return (
    <TopBar
      showBack
      backHref="/blog"
      onBack={from ? goBack : undefined}
      title="Blog"
    />
  )
}

/** The link above the post title: "← Back to <rink>" or "← All posts". */
export function PostBackLink({ slug }: { slug: string }) {
  const from = useReturnRink(slug)
  const goBack = useGoBackToRink(from)

  if (from) {
    return (
      <button type="button" className={`${styles.backLink} ${styles.backButton}`} onClick={goBack}>
        ← Back to {from.rinkName}
      </button>
    )
  }
  return <Link href="/blog" className={styles.backLink}>← All posts</Link>
}
