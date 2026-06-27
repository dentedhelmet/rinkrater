'use client'

import { useState, useRef, useEffect } from 'react'
import { getCategoryIcon } from '@/lib/categoryIcons'

interface ReviewItem {
  category: string
  comment: string
  source: string
}

interface LatestReviewsCarouselProps {
  reviews: ReviewItem[]
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max).trim() + '...'
}

export function LatestReviewsCarousel(props: LatestReviewsCarouselProps) {
  const reviews = props.reviews || []
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

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
            const attribution = review.source === 'ftloh' ? 'FTLOH' : 'Rink Rater reviewer'
            return (
              <div key={i} className="carousel-card clay-card">
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
