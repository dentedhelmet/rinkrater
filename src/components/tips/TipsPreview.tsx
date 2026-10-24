'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { TipCard } from '@/components/tips/TipCard'
import type { PublicTip } from '@/lib/parentTips'

/**
 * The latest few approved parent tips, for teasing the full board on other
 * pages. Renders nothing extra while loading; shows a friendly nudge if the
 * board is still empty.
 */
export function TipsPreview({ count = 3, onShare }: { count?: number; onShare: () => void }) {
  const [tips, setTips] = useState<PublicTip[] | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .rpc('list_parent_tips', { p_category: null, p_limit: count, p_offset: 0 })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('list_parent_tips (preview) failed:', error)
          setTips([])
          return
        }
        setTips(((data as { rows?: PublicTip[] } | null)?.rows) ?? [])
      })
    return () => {
      cancelled = true
    }
  }, [count])

  return (
    <div className="preview">
      {tips === null ? (
        <div className="grid" aria-hidden="true">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="clay-card skeleton" />
          ))}
        </div>
      ) : tips.length === 0 ? (
        <div className="clay-card empty">
          <p>
            <strong>The board is brand new.</strong> Got a tip that saved your season? Be one of the first to
            share it.
          </p>
        </div>
      ) : (
        <ul className="grid">
          {tips.map((t) => (
            <li key={t.id}>
              <TipCard tip={t} compact />
            </li>
          ))}
        </ul>
      )}

      <div className="actions">
        <button type="button" className="clay-btn clay-btn-primary" onClick={onShare}>
          <span aria-hidden="true">✍️</span> Share a tip
        </button>
        <Link href="/tips" className="clay-btn clay-btn-secondary">
          See all parent tips
        </Link>
      </div>

      <style jsx>{`
        .grid {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 16px;
        }
        .grid :global(.skeleton) {
          height: 180px;
          opacity: 0.5;
        }
        .empty {
          padding: 18px 20px;
          color: var(--rr-navy);
        }
        .empty p {
          margin: 0;
          line-height: 1.55;
        }
        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 20px;
        }
        .actions :global(.clay-btn) {
          min-height: 48px;
          font-size: 15px;
          padding: 12px 22px;
        }
      `}</style>
    </div>
  )
}
