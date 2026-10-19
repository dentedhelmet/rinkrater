'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { POST_CARD_COLUMNS, formatPostDate, type PostCard } from '@/lib/blog'

/**
 * "In the news" — blog posts that mention this rink.
 *   • none   → renders nothing, so most rink pages look exactly as before
 *   • one    → a single wide card
 *   • two +  → a swipeable carousel with arrows and dots
 *
 * onOpenPost runs just before leaving for a post, so the rink page can
 * remember where you were and bring you back to the same spot.
 */
export function RinkNews({
  rinkId,
  onOpenPost,
}: {
  rinkId: string
  onOpenPost?: (postSlug: string) => void
}) {
  const reduceMotion = useReducedMotion()
  const [posts, setPosts] = useState<PostCard[]>([])
  const scrollRef = useRef<HTMLUListElement>(null)
  const [active, setActive] = useState(0)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('posts')
      .select(POST_CARD_COLUMNS)
      .contains('rink_ids', [rinkId])
      .order('published_at', { ascending: false })
      .limit(8)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          // Fine before the blog migration runs — just show nothing.
          if (!/relation|does not exist/i.test(error.message)) console.error('rink news failed:', error)
          return
        }
        setPosts((data as PostCard[]) ?? [])
      })
    return () => { cancelled = true }
  }, [rinkId])

  // Which card is showing, and whether the arrows have anywhere to go.
  const update = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 4)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
    const first = el.firstElementChild as HTMLElement | null
    if (first) {
      const step = first.offsetWidth + 12
      setActive(Math.min(posts.length - 1, Math.round(el.scrollLeft / step)))
    }
  }, [posts.length])

  useEffect(() => {
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [update])

  const goTo = (i: number) => {
    const el = scrollRef.current
    const card = el?.children[i] as HTMLElement | undefined
    if (!el || !card) return
    el.scrollTo({ left: card.offsetLeft - el.offsetLeft, behavior: reduceMotion ? 'auto' : 'smooth' })
  }

  if (posts.length === 0) return null

  const single = posts.length === 1

  const card = (p: PostCard, i: number) => (
    <motion.li
      key={p.id}
      className={single ? 'news-item news-item-single' : 'news-item'}
      variants={{
        hidden: { opacity: 0, x: 32 },
        show:   { opacity: 1, x: 0, transition: { duration: 0.4, delay: Math.min(i, 4) * 0.08, ease: 'easeOut' } },
      }}
    >
      <Link
        href={`/blog/${p.slug}`}
        className="news-card"
        onClick={() => onOpenPost?.(p.slug)}
      >
        {p.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.cover_image_url} alt="" loading="lazy" className="news-img" />
        ) : (
          <span className="news-img news-img-empty" aria-hidden="true">📰</span>
        )}
        <span className="news-text">
          <span className="news-title">{p.title}</span>
          <span className="news-date">{formatPostDate(p.published_at)}</span>
        </span>
      </Link>
    </motion.li>
  )

  return (
    <section className="rink-news" aria-labelledby="rink-news-heading">
      <div className="news-head">
        <h2 id="rink-news-heading">In the news</h2>
        {!single && (
          <span className="news-count" aria-hidden="true">{active + 1} / {posts.length}</span>
        )}
      </div>

      <div className="news-track-wrap">
        {!single && canLeft && (
          <button type="button" className="news-arrow news-arrow-left" aria-label="Previous post" onClick={() => goTo(Math.max(0, active - 1))}>
            {'‹'}
          </button>
        )}

        {/* The whole row slides in together once the section scrolls into view. */}
        <motion.ul
          ref={scrollRef}
          className={single ? 'news-track news-track-single' : 'news-track'}
          onScroll={update}
          aria-label={single ? undefined : `${posts.length} posts about this rink — swipe for more`}
          initial={reduceMotion ? false : 'hidden'}
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
        >
          {posts.map(card)}
        </motion.ul>

        {!single && canRight && (
          <button type="button" className="news-arrow news-arrow-right" aria-label="Next post" onClick={() => goTo(Math.min(posts.length - 1, active + 1))}>
            {'›'}
          </button>
        )}
      </div>

      {!single && posts.length <= 6 && (
        <div className="news-dots">
          {posts.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className={`news-dot ${i === active ? 'news-dot-on' : ''}`}
              aria-label={`Show post ${i + 1} of ${posts.length}`}
              aria-current={i === active ? 'true' : undefined}
              onClick={() => goTo(i)}
            >
              <span aria-hidden="true" />
            </button>
          ))}
        </div>
      )}

      <style jsx>{`
        .rink-news {
          margin: 0 14px 16px;
          padding: 14px 14px 10px;
          background: var(--rr-warm);
          border: var(--rr-outline);
          border-radius: var(--rr-radius);
          box-shadow: var(--rr-shadow);
        }
        .news-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 10px; }
        h2 {
          margin: 0;
          font-family: var(--font-display);
          font-weight: 900;
          font-size: 16px;
          color: var(--rr-navy);
        }
        .news-count { font-size: 12px; font-weight: 800; color: rgba(13, 42, 74, 0.75); }
        .news-track-wrap { position: relative; }
        .rink-news :global(.news-track) {
          list-style: none;
          margin: 0;
          padding: 2px 2px 6px;
          display: flex;
          gap: 12px;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          scroll-behavior: smooth;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .rink-news :global(.news-track::-webkit-scrollbar) { display: none; }
        @media (prefers-reduced-motion: reduce) { .rink-news :global(.news-track) { scroll-behavior: auto; } }
        .rink-news :global(.news-track-single) { overflow: visible; }
        .rink-news :global(.news-item) {
          flex: 0 0 80%;
          max-width: 320px;
          scroll-snap-align: start;
        }
        .rink-news :global(.news-item-single) { flex: 1 1 auto; max-width: none; }
        .rink-news :global(.news-card) {
          display: flex;
          flex-direction: column;
          height: 100%;
          border-radius: 12px;
          background: #fff;
          border: var(--rr-outline-sm);
          overflow: hidden;
          text-decoration: none;
          color: var(--rr-navy);
          transition: transform 0.15s ease;
        }
        .rink-news :global(.news-card:active) { transform: scale(0.98); }
        .rink-news :global(.news-card:focus-visible) { outline: 3px solid var(--rr-yellow); outline-offset: 2px; }
        .rink-news :global(.news-item-single .news-card) { flex-direction: row; align-items: center; }
        .rink-news :global(.news-img) {
          display: block;
          width: 100%;
          aspect-ratio: 16 / 9;
          object-fit: cover;
          background: var(--rr-ice);
          border-bottom: var(--rr-outline-sm);
        }
        .rink-news :global(.news-item-single .news-img) {
          width: 96px;
          height: 64px;
          aspect-ratio: auto;
          flex-shrink: 0;
          border-bottom: none;
          border-right: var(--rr-outline-sm);
        }
        .rink-news :global(.news-img-empty) { display: flex; align-items: center; justify-content: center; font-size: 28px; }
        .rink-news :global(.news-text) { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px 12px; min-width: 0; }
        .rink-news :global(.news-title) {
          font-weight: 800;
          font-size: 14px;
          line-height: 1.3;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .rink-news :global(.news-date) { font-size: 12px; font-weight: 700; color: rgba(13, 42, 74, 0.8); }
        .news-arrow {
          position: absolute;
          top: 38%;
          transform: translateY(-50%);
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: var(--rr-red);
          border: var(--rr-outline-sm);
          box-shadow: var(--rr-shadow-sm);
          color: #fff;
          font-size: 22px;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 2;
        }
        .news-arrow:focus-visible { outline: 3px solid var(--rr-yellow); outline-offset: 2px; }
        .news-arrow-left { left: -6px; }
        .news-arrow-right { right: -6px; }
        .news-dots { display: flex; justify-content: center; margin-top: 0; }
        .news-dot {
          width: 44px;
          height: 44px;
          padding: 0;
          border: none;
          background: transparent;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .news-dot span {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: rgba(13, 42, 74, 0.25);
          transition: width 0.2s ease, background 0.2s ease;
        }
        .news-dot-on span { width: 20px; background: var(--rr-red); }
        .news-dot:focus-visible { outline: 3px solid var(--rr-yellow); border-radius: 6px; }
        @media (prefers-reduced-motion: reduce) { .news-dot span { transition: none; } }
      `}</style>
    </section>
  )
}
