'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { TipCard } from '@/components/tips/TipCard'
import ShareTipModal from '@/components/tips/ShareTipModal'
import { TIP_CATEGORIES, isTipCategory, type PublicTip, type TipCategory } from '@/lib/parentTips'

const PAGE_SIZE = 24

type Filter = TipCategory | 'all'

export default function TipsBoardClient() {
  const [filter, setFilter] = useState<Filter>('all')
  const [tips, setTips] = useState<PublicTip[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareCategory, setShareCategory] = useState<TipCategory | undefined>(undefined)
  const requestId = useRef(0)

  const fetchPage = useCallback(async (which: Filter, offset: number) => {
    const { data, error } = await supabase.rpc('list_parent_tips', {
      p_category: which === 'all' ? null : which,
      p_limit: PAGE_SIZE,
      p_offset: offset,
    })
    if (error) throw error
    return data as { total: number; rows: PublicTip[] }
  }, [])

  // Deep links: /tips?category=skills filters; /tips?share=gear opens the form.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const cat = params.get('category')
    if (isTipCategory(cat)) setFilter(cat)
    const share = params.get('share')
    if (share !== null) {
      setShareCategory(isTipCategory(share) ? share : undefined)
      setShareOpen(true)
    }
  }, [])

  useEffect(() => {
    const id = ++requestId.current
    setLoading(true)
    setLoadError(null)
    fetchPage(filter, 0)
      .then((page) => {
        if (id !== requestId.current) return
        setTips(page.rows)
        setTotal(page.total)
      })
      .catch((err) => {
        console.error('list_parent_tips failed:', err)
        if (id === requestId.current) setLoadError('Could not load tips. Please try again in a moment.')
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false)
      })
  }, [filter, fetchPage])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const page = await fetchPage(filter, tips.length)
      setTips((prev) => [...prev, ...page.rows.filter((r) => !prev.some((p) => p.id === r.id))])
      setTotal(page.total)
    } catch (err) {
      console.error('list_parent_tips (more) failed:', err)
    } finally {
      setLoadingMore(false)
    }
  }

  const openShare = () => {
    setShareCategory(filter === 'all' ? undefined : filter)
    setShareOpen(true)
  }

  const activeLabel = filter === 'all' ? 'tips' : `${TIP_CATEGORIES.find((c) => c.id === filter)?.label} tips`

  return (
    <main className="tips-page">
      <header className="tips-hero">
        <p className="eyebrow">From the Rink Family</p>
        <h1>Parent Tips</h1>
        <p className="lede">
          Real advice from hockey moms and dads who&apos;ve been there. Read what worked for other families,
          then pass along what worked for yours.
        </p>
        <div className="hero-actions">
          <button type="button" className="clay-btn clay-btn-primary share-btn" onClick={openShare}>
            <span aria-hidden="true">✍️</span> Share a tip
          </button>
          <Link href="/parent-resources" className="clay-btn clay-btn-secondary share-btn">
            New to hockey? Start here
          </Link>
        </div>
      </header>

      <div className="filters" role="group" aria-label="Filter tips by category">
        <button
          type="button"
          className={`filter-chip ${filter === 'all' ? 'chip-active' : ''}`}
          aria-pressed={filter === 'all'}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        {TIP_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`filter-chip ${filter === c.id ? 'chip-active' : ''}`}
            aria-pressed={filter === c.id}
            onClick={() => setFilter(c.id)}
          >
            <span aria-hidden="true">{c.icon}</span> {c.label}
          </button>
        ))}
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {loading ? 'Loading tips' : `${total} ${activeLabel}`}
      </p>

      {loadError && <p className="load-error" role="alert">{loadError}</p>}

      {loading ? (
        <div className="tip-grid" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="clay-card skeleton" />
          ))}
        </div>
      ) : tips.length === 0 && !loadError ? (
        <div className="clay-card empty">
          <p className="empty-title">No {activeLabel} yet.</p>
          <p>Be the first! Your tip could save another family a cold, confusing Saturday morning.</p>
          <button type="button" className="clay-btn clay-btn-primary" onClick={openShare}>
            Share the first tip
          </button>
        </div>
      ) : (
        <ul className="tip-grid">
          {tips.map((t) => (
            <li key={t.id}>
              <TipCard tip={t} />
            </li>
          ))}
        </ul>
      )}

      {!loading && tips.length < total && (
        <div className="more-row">
          <button type="button" className="clay-btn clay-btn-secondary" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : `Show more (${total - tips.length} left)`}
          </button>
        </div>
      )}

      <p className="disclaimer">
        Tips come from hockey parents, not doctors, trainers or nutritionists. Check with a professional before
        changing your player&apos;s diet or training. Rink Rater reviews every tip before it goes live but
        doesn&apos;t verify them.
      </p>

      <ShareTipModal isOpen={shareOpen} onClose={() => setShareOpen(false)} initialCategory={shareCategory} />

      <style jsx>{`
        .tips-page {
          max-width: 1080px;
          width: 100%;
          margin: 0 auto;
          padding: 16px 16px 56px;
          box-sizing: border-box;
          color: var(--rr-navy);
        }
        .tips-hero {
          padding: 12px 0 20px;
        }
        .eyebrow {
          margin: 0 0 4px;
          font-size: 0.8rem;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--rr-red);
        }
        h1 {
          margin: 0 0 8px;
          font-family: var(--font-display);
          font-size: clamp(1.9rem, 5vw, 2.8rem);
          font-weight: 900;
          line-height: 1.1;
        }
        .lede {
          margin: 0 0 18px;
          max-width: 640px;
          font-size: 1.05rem;
          line-height: 1.55;
          color: rgba(13, 42, 74, 0.85);
        }
        .hero-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }
        .hero-actions :global(.share-btn) {
          min-height: 48px;
          font-size: 15px;
          padding: 12px 22px;
        }
        .filters {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: 4px 2px 12px;
          margin-bottom: 8px;
          scrollbar-width: thin;
        }
        .filter-chip {
          flex: 0 0 auto;
          min-height: 44px;
          padding: 0 16px;
          border: var(--rr-outline-sm);
          border-radius: var(--rr-radius-pill);
          background: #fff;
          color: var(--rr-navy);
          font-family: inherit;
          font-weight: 800;
          font-size: 0.92rem;
          cursor: pointer;
          white-space: nowrap;
        }
        .chip-active {
          background: var(--rr-navy);
          color: #fff;
        }
        .filter-chip:focus-visible {
          outline: 3px solid var(--rr-yellow);
          outline-offset: 2px;
        }
        .tip-grid {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }
        .tip-grid :global(.skeleton) {
          height: 200px;
          opacity: 0.5;
        }
        .empty {
          padding: 28px 20px;
          text-align: center;
        }
        .empty-title {
          margin: 0 0 6px;
          font-family: var(--font-display);
          font-size: 1.2rem;
          font-weight: 900;
        }
        .empty p {
          margin: 0 0 16px;
        }
        .empty :global(.clay-btn) {
          min-height: 44px;
        }
        .more-row {
          display: flex;
          justify-content: center;
          margin-top: 24px;
        }
        .more-row :global(.clay-btn) {
          min-height: 44px;
        }
        .load-error {
          color: var(--rr-red);
          font-weight: 800;
        }
        .disclaimer {
          margin: 32px 0 0;
          padding-top: 16px;
          border-top: 2px solid var(--rr-ice);
          font-size: 0.85rem;
          line-height: 1.55;
          color: rgba(13, 42, 74, 0.8);
        }
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
      `}</style>
    </main>
  )
}
