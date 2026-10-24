'use client'

import { TIP_CATEGORY_MAP, type PublicTip } from '@/lib/parentTips'

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function TipCard({ tip, compact = false }: { tip: PublicTip; compact?: boolean }) {
  const cat = TIP_CATEGORY_MAP[tip.category]
  const date = formatDate(tip.published_at)

  return (
    <article className={`clay-card tip-card ${compact ? 'tip-compact' : ''}`} aria-labelledby={`tip-${tip.id}`}>
      <span className="tip-chip">
        <span aria-hidden="true">{cat?.icon}</span> {cat?.label ?? tip.category}
      </span>
      <h3 id={`tip-${tip.id}`} className="tip-title">{tip.title}</h3>
      <p className="tip-body">{tip.body}</p>
      <p className="tip-by">
        <span className="tip-author">{tip.author}</span>
        {date && <> · <time dateTime={tip.published_at ?? undefined}>{date}</time></>}
      </p>

      <style jsx>{`
        .tip-card {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 18px;
          height: 100%;
          box-sizing: border-box;
        }
        .tip-chip {
          align-self: flex-start;
          padding: 4px 10px;
          border-radius: var(--rr-radius-pill);
          background: var(--rr-ice);
          border: var(--rr-outline-sm);
          color: var(--rr-navy);
          font-size: 0.78rem;
          font-weight: 800;
        }
        .tip-title {
          margin: 4px 0 0;
          font-family: var(--font-display);
          font-size: 1.12rem;
          font-weight: 900;
          line-height: 1.25;
          color: var(--rr-navy);
          overflow-wrap: anywhere;
        }
        .tip-body {
          margin: 0;
          font-size: 0.97rem;
          line-height: 1.55;
          color: var(--rr-navy);
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }
        .tip-compact .tip-body {
          display: -webkit-box;
          -webkit-line-clamp: 5;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .tip-by {
          margin: auto 0 0;
          padding-top: 6px;
          font-size: 0.85rem;
          color: rgba(13, 42, 74, 0.8);
        }
        .tip-author {
          font-weight: 800;
          color: var(--rr-navy);
        }
      `}</style>
    </article>
  )
}
