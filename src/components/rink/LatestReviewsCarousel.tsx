'use client'

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

  if (reviews.length === 0) {
    return null
  }

  return (
    <div style={{ marginBottom: 16 }}>
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

      <div className="carousel-scroll">
        {reviews.map(function(review, i) {
          const attribution = review.source === 'ftloh' ? 'FTLOH' : 'Rink Rater reviewer'
          return (
            <div key={i} className="carousel-card clay-card">
              <div className="carousel-icon">
                <img
                  src={getCategoryIcon(review.category)}
                  alt=""
                  style={{ width: 36, height: 36, objectFit: 'contain' }}
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
      `}</style>
    </div>
  )
}
