'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { getCategoryIcon } from '@/lib/categoryIcons'

interface ReviewItem {
  category:     string
  comment:      string
  source:       string
  user_alias?:  string
  review_date?: string
}

interface LatestReviewsCarouselProps {
  reviews: ReviewItem[]
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max).trim() + '...'
}

// Relative date, not raw timestamps — some rows are old legacy imports and a
// bare date on those reads oddly out of context; "X years ago" is honest
// either way.
function formatRelativeDate(dateStr?: string): string {
  if (!dateStr) return ''
  const then = new Date(dateStr)
  if (isNaN(then.getTime())) return ''

  const days = Math.floor((Date.now() - then.getTime()) / (1000 * 60 * 60 * 24))

  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return days + ' days ago'

  const months = Math.floor(days / 30)
  if (months < 12) return months + (months === 1 ? ' month ago' : ' months ago')

  const years = Math.floor(months / 12)
  return years + (years === 1 ? ' year ago' : ' years ago')
}

export function LatestReviewsCarousel(props: LatestReviewsCarouselProps) {
  const reviews = props.reviews || []
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [selectedReview, setSelectedReview] = useState<ReviewItem | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(function() { setMounted(true) }, [])

  function updateArrows() {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  useEffect(function() {
    updateArrows()
  }, [reviews])

  function scrollByAmount(amount: number) {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: amount, behavior: 'smooth' })
  }

  if (reviews.length === 0) {
    return null
  }

  return (
    <div style={{ marginBottom: 16, position: 'relative' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 15, color: 'var(--rr-navy)' }}>
          Latest Reviews
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        {canScrollLeft && (
          <button
            aria-label="Scroll left"
            onClick={function() { scrollByAmount(-320) }}
            className="carousel-nav-btn carousel-nav-btn--left"
          >
            {'\u2039'}
          </button>
        )}

        <div className="carousel-scroll" ref={scrollRef} onScroll={updateArrows}>
          {reviews.map(function(review, i) {
            const attribution = review.source === 'ftloh' ? 'FTLOH' : (review.user_alias || 'Rink Rater reviewer')
            const dateLabel = formatRelativeDate(review.review_date)
            return (
              <div
                key={i}
                className="carousel-card clay-card"
                role="button"
                tabIndex={0}
                onClick={function() { setSelectedReview(review) }}
                onKeyDown={function(e) { if (e.key === 'Enter' || e.key === ' ') { setSelectedReview(review) } }}
                style={{ cursor: 'pointer' }}
              >
                <div className="carousel-icon">
                  <img
                    src={getCategoryIcon(review.category)}
                    alt=""
                    style={{ width: 56, height: 56, objectFit: 'contain' }}
                  />
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: 12,
                    color: 'var(--rr-navy)',
                    marginBottom: 6,
                    textAlign: 'center',
                  }}
                >
                  {review.category}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: 'rgba(13,42,74,0.8)',
                    lineHeight: 1.4,
                    textAlign: 'center',
                    marginBottom: 8,
                    flex: 1,
                  }}
                >
                  "{truncate(review.comment, 80)}"
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'rgba(13,42,74,0.45)',
                    textAlign: 'center',
                  }}
                >
                  {attribution}
                </div>
                {dateLabel && (
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: 'rgba(13,42,74,0.35)',
                      textAlign: 'center',
                      marginTop: 2,
                    }}
                  >
                    {dateLabel}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {canScrollRight && (
          <button
            aria-label="Scroll right"
            onClick={function() { scrollByAmount(320) }}
            className="carousel-nav-btn carousel-nav-btn--right"
          >
            {'\u203A'}
          </button>
        )}
      </div>

      {mounted && selectedReview && createPortal(
        <div
          onClick={function() { setSelectedReview(null) }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(13,42,74,0.6)',
            zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={function(e) { e.stopPropagation() }}
            className="clay-card"
            style={{
              width: '100%', maxWidth: 380, maxHeight: '80dvh', overflowY: 'auto',
              padding: '18px 18px 20px', position: 'relative',
            }}
          >
            <button
              onClick={function() { setSelectedReview(null) }}
              aria-label="Close"
              style={{
                position: 'absolute', top: 10, right: 10,
                background: 'rgba(13,42,74,0.08)', border: 'none', borderRadius: '50%',
                width: 30, height: 30, fontSize: 14, color: 'var(--rr-navy)', cursor: 'pointer',
              }}
            >
              {'\u2715'}
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 12 }}>
              <img
                src={getCategoryIcon(selectedReview.category)}
                alt=""
                style={{ width: 56, height: 56, objectFit: 'contain', marginBottom: 8 }}
              />
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 14, color: 'var(--rr-navy)' }}>
                {selectedReview.category}
              </div>
            </div>

            <div style={{ fontSize: 14, color: 'rgba(13,42,74,0.85)', lineHeight: 1.6, marginBottom: 14, textAlign: 'center' }}>
              "{selectedReview.comment}"
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(13,42,74,0.5)' }}>
                {selectedReview.source === 'ftloh' ? 'FTLOH' : (selectedReview.user_alias || 'Rink Rater reviewer')}
              </div>
              {formatRelativeDate(selectedReview.review_date) && (
                <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(13,42,74,0.35)', marginTop: 2 }}>
                  {formatRelativeDate(selectedReview.review_date)}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      <style jsx>{`
        .carousel-scroll {
          display: flex;
          gap: 10px;
          overflow-x: auto;
          padding-bottom: 6px;
          -webkit-overflow-scrolling: touch;
        }
        .carousel-scroll::-webkit-scrollbar {
          height: 6px;
        }
        .carousel-card {
          flex: 0 0 150px;
          padding: 14px 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .carousel-icon {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: var(--rr-ice);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 8px;
        }
        .carousel-nav-btn {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--rr-red);
          border: var(--rr-outline-sm);
          box-shadow: var(--rr-shadow-sm);
          color: #fff;
          font-size: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 5;
        }
        .carousel-nav-btn--left {
          left: 4px;
        }
        .carousel-nav-btn--right {
          right: 4px;
        }
      `}</style>
    </div>
  )
}
