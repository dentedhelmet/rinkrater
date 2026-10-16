'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { POST_CARD_COLUMNS, formatPostDate, type PostCard } from '@/lib/blog'

/**
 * "In the news" — blog posts that mention this rink. Renders nothing when
 * there are none, so most rink pages look exactly as they did before.
 */
export function RinkNews({ rinkId }: { rinkId: string }) {
  const [posts, setPosts] = useState<PostCard[]>([])

  useEffect(() => {
    let cancelled = false
    supabase
      .from('posts')
      .select(POST_CARD_COLUMNS)
      .contains('rink_ids', [rinkId])
      .order('published_at', { ascending: false })
      .limit(3)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          // Fine before the v6 migration runs — just show nothing.
          if (!/relation|does not exist/i.test(error.message)) console.error('rink news failed:', error)
          return
        }
        setPosts((data as PostCard[]) ?? [])
      })
    return () => { cancelled = true }
  }, [rinkId])

  if (posts.length === 0) return null

  return (
    <section className="rink-news" aria-labelledby="rink-news-heading">
      <h2 id="rink-news-heading">In the news</h2>
      <ul>
        {posts.map((p) => (
          <li key={p.id}>
            <Link href={`/blog/${p.slug}`} className="rink-news-link">
              {p.cover_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.cover_image_url} alt="" loading="lazy" />
              ) : (
                <span className="rink-news-icon" aria-hidden="true">📰</span>
              )}
              <span className="rink-news-text">
                <span className="rink-news-title">{p.title}</span>
                <span className="rink-news-date">{formatPostDate(p.published_at)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <style jsx>{`
        .rink-news {
          margin: 0 14px 14px;
          padding: 14px;
          background: var(--rr-warm);
          border: var(--rr-outline);
          border-radius: var(--rr-radius);
          box-shadow: var(--rr-shadow);
        }
        h2 {
          margin: 0 0 10px;
          font-family: var(--font-display);
          font-weight: 900;
          font-size: 16px;
          color: var(--rr-navy);
        }
        ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
        .rink-news :global(.rink-news-link) {
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 44px;
          padding: 8px;
          border-radius: 10px;
          background: var(--rr-ice);
          border: var(--rr-outline-sm);
          text-decoration: none;
          color: var(--rr-navy);
        }
        .rink-news :global(.rink-news-link:focus-visible) { outline: 3px solid var(--rr-yellow); outline-offset: 2px; }
        img, .rink-news-icon {
          width: 72px;
          height: 44px;
          flex-shrink: 0;
          border-radius: 6px;
          object-fit: cover;
          background: #fff;
        }
        .rink-news-icon { display: flex; align-items: center; justify-content: center; font-size: 22px; }
        .rink-news-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .rink-news-title { font-weight: 800; font-size: 14px; line-height: 1.3; }
        .rink-news-date { font-size: 12px; color: rgba(13, 42, 74, 0.8); font-weight: 700; }
      `}</style>
    </section>
  )
}
