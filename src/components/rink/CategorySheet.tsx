'use client'

import { useState, useEffect } from 'react'
import { getCategoryIcon } from '@/lib/categoryIcons'

interface CategorySheetProps {
  rinkId: string
  category: string | null
  onClose: () => void
}

interface CategoryReview {
  comment: string
  source: string
  review_date: string
}

export function CategorySheet(props: CategorySheetProps) {
  const [reviews, setReviews] = useState<CategoryReview[]>([])
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(function() {
    if (props.category) {
      setVisible(true)
      setLoading(true)
      fetch('/api/rink/' + props.rinkId + '/category/' + encodeURIComponent(props.category))
        .then(function(res) { return res.json() })
        .then(function(data) {
          setReviews(data.reviews || [])
        })
        .catch(function() {
          setReviews([])
        })
        .finally(function() {
          setLoading(false)
        })
    } else {
      setVisible(false)
    }
  }, [props.category, props.rinkId])

  if (!props.category) {
    return null
  }

  return (
    <div className={'sheet-overlay' + (visible ? ' sheet-overlay--visible' : '')} onClick={props.onClose}>
      <div
        className={'sheet-panel' + (visible ? ' sheet-panel--visible' : '')}
        onClick={function(e) { e.stopPropagation() }}
      >
        <div className="sheet-handle" />

        <div className="sheet-header">
          <img
            src={getCategoryIcon(props.category)}
            alt=""
            style={{ width: 32, height: 32, objectFit: 'contain' }}
          />
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 16, color: 'var(--rr-navy)', flex: 1 }}>
            {props.category}
          </div>
          <button onClick={props.onClose} aria-label="Close" className="sheet-close-btn">
            {'\u2715'}
          </button>
        </div>

        <div className="sheet-scroll">
          {loading && (
            <div style={{ textAlign: 'center', padding: 30, color: 'rgba(13,42,74,0.4)', fontSize: 13 }}>
              Loading reviews...
            </div>
          )}

          {!loading && reviews.length === 0 && (
            <div style={{ textAlign: 'center', padding: 30, color: 'rgba(13,42,74,0.4)', fontSize: 13 }}>
              No reviews yet for this category.
            </div>
          )}

          {!loading && reviews.map(function(r, i) {
            const attribution = r.source === 'ftloh' ? 'FTLOH' : 'Rink Rater reviewer'
            return (
              <div key={i} className="clay-card-sm" style={{ padding: '12px 14px', marginBottom: 8 }}>
                <div style={{ fontSize: 14, color: 'rgba(13,42,74,0.8)', lineHeight: 1.5, marginBottom: 6 }}>
                  {r.comment}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(13,42,74,0.45)' }}>
                  {attribution}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <style jsx>{`
        .sheet-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(13,42,74,0);
          z-index: 200;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          transition: background 0.25s ease;
          pointer-events: none;
        }
        .sheet-overlay--visible {
          background: rgba(13,42,74,0.45);
          pointer-events: auto;
        }
        .sheet-panel {
          width: 100%;
          max-width: 1100px;
          max-height: 75vh;
          background: var(--rr-warm);
          border-radius: 20px 20px 0 0;
          border: var(--rr-outline);
          box-shadow: var(--rr-shadow);
          display: flex;
          flex-direction: column;
          transform: translateY(100%);
          transition: transform 0.3s ease;
        }
        .sheet-panel--visible {
          transform: translateY(0);
        }
        .sheet-handle {
          width: 40px;
          height: 4px;
          background: rgba(13,42,74,0.2);
          border-radius: 2px;
          margin: 10px auto 4px;
          flex-shrink: 0;
        }
        .sheet-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 16px 14px;
          border-bottom: var(--rr-outline-sm);
          flex-shrink: 0;
        }
        .sheet-close-btn {
          background: rgba(13,42,74,0.08);
          border: none;
          border-radius: 50%;
          width: 30px;
          height: 30px;
          font-size: 14px;
          color: var(--rr-navy);
          cursor: pointer;
          flex-shrink: 0;
        }
        .sheet-scroll {
          overflow-y: auto;
          padding: 14px 16px 24px;
        }
      `}</style>
    </div>
  )
}
