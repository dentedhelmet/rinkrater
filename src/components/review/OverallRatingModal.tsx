'use client'

import { useState, useEffect, useRef } from 'react'

const RATING_ICONS = [
  { src: '/icons/rating-1.png', label: 'Poor' },
  { src: '/icons/rating-2.png', label: 'Fair' },
  { src: '/icons/rating-3.png', label: 'Average' },
  { src: '/icons/rating-4.png', label: 'Good' },
  { src: '/icons/rating-5.png', label: 'Excellent' },
]

interface OverallRatingModalProps {
  rinkId: string
  rinkName: string
  accessToken: string
  onDone: (result: { avgOverallRating: number | null; overallRatingCount: number }) => void
  onSkip: () => void
}

export function OverallRatingModal({ rinkId, rinkName, accessToken, onDone, onSkip }: OverallRatingModalProps) {
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const firstButtonRef = useRef<HTMLButtonElement>(null)

  // ADA: autofocus into the modal on open, Escape skips (same as a close action).
  useEffect(function () {
    firstButtonRef.current?.focus()
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onSkip()
    }
    window.addEventListener('keydown', handleKeyDown)
    return function () { window.removeEventListener('keydown', handleKeyDown) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit() {
    if (!rating || sending) return
    setSending(true)
    setSendError(null)
    try {
      const res = await fetch('/api/rink/' + rinkId + '/overall-rating', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ rating }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save rating')
      }
      onDone({ avgOverallRating: data.avgOverallRating, overallRatingCount: data.overallRatingCount })
    } catch (err) {
      console.error('Overall rating submit failed:', err)
      setSendError('Something went wrong saving your rating. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(13,42,74,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200, padding: 16,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="overall-rating-title"
    >
      <div
        className="clay-card overall-rating-modal-card"
        style={{
          maxWidth: 420, width: '100%', background: 'var(--rr-warm)',
          maxHeight: '90vh', overflowY: 'auto', position: 'relative',
        }}
      >
        <div className="overall-rating-modal-intro" style={{ textAlign: 'center', marginBottom: 20 }}>
          <div
            id="overall-rating-title"
            className="overall-rating-modal-title"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 20, color: 'var(--rr-navy)', marginBottom: 8 }}
          >
            {"What's your overall rating of " + rinkName + '?'}
          </div>
          <div className="overall-rating-modal-subtitle" style={{ fontSize: 13, color: 'rgba(13,42,74,0.6)', lineHeight: 1.5 }}>
            This helps other hockey families get a quick gut-check on this rink.
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4, marginBottom: 20 }}>
          {RATING_ICONS.map(function (opt, i) {
            const value = i + 1
            const isActive = value === (hoverRating || rating)
            return (
              <button
                key={value}
                ref={value === 1 ? firstButtonRef : undefined}
                type="button"
                onClick={function () { setRating(value) }}
                onMouseEnter={function () { setHoverRating(value) }}
                onMouseLeave={function () { setHoverRating(0) }}
                aria-label={opt.label + ', ' + value + ' out of 5'}
                aria-pressed={value === rating}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 3,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  borderRadius: 10,
                  outline: value === rating ? '2px solid var(--rr-red)' : 'none',
                  outlineOffset: 3,
                  transform: isActive ? 'scale(1.08)' : 'scale(1)',
                  transition: 'transform 0.12s ease',
                  opacity: (hoverRating || rating) === 0 ? 1 : (isActive ? 1 : 0.5),
                  minWidth: 44, minHeight: 44,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={opt.src} alt="" className="overall-rating-modal-face" style={{ width: 46, height: 46, display: 'block' }} />
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 12, color: 'var(--rr-navy)' }}>
                  {value}
                </div>
                <div className="overall-rating-modal-face-label" style={{ fontSize: 10, color: 'rgba(13,42,74,0.5)' }}>
                  {opt.label}
                </div>
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!rating || sending}
          className="clay-btn clay-btn-primary"
          style={{ width: '100%', fontSize: 14, padding: '12px 24px', opacity: (!rating || sending) ? 0.6 : 1 }}
        >
          {sending ? 'Saving...' : 'Submit Rating'}
        </button>

        {sendError && (
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--rr-red)', marginTop: 10, fontWeight: 700 }}>
            {sendError}
          </div>
        )}

        <button
          type="button"
          onClick={onSkip}
          className="overall-rating-modal-skip"
          style={{
            display: 'block', margin: '14px auto 0', background: 'none', border: 'none',
            fontSize: 12, color: 'rgba(13,42,74,0.45)', textDecoration: 'underline', cursor: 'pointer',
            minHeight: 44,
          }}
        >
          Skip for now
        </button>
      </div>

      <style jsx>{`
        .overall-rating-modal-card {
          padding: 24px;
        }
        @media (max-width: 480px) {
          .overall-rating-modal-card {
            padding: 14px;
            max-height: 85dvh;
          }
          .overall-rating-modal-intro {
            margin-bottom: 12px !important;
          }
          .overall-rating-modal-title {
            font-size: 17px !important;
          }
          .overall-rating-modal-subtitle {
            font-size: 12px !important;
          }
          .overall-rating-modal-face {
            width: 34px !important;
            height: 34px !important;
          }
          .overall-rating-modal-face-label {
            display: none;
          }
        }
      `}</style>
    </div>
  )
}
