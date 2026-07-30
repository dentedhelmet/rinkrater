'use client'

import { useState } from 'react'

const RATING_ICONS = [
  { src: '/icons/rating-1.png', label: 'Poor' },
  { src: '/icons/rating-2.png', label: 'Fair' },
  { src: '/icons/rating-3.png', label: 'Average' },
  { src: '/icons/rating-4.png', label: 'Good' },
  { src: '/icons/rating-5.png', label: 'Excellent' },
]

const MAX_LENGTH = 500

function RequiredMark() {
  return <span style={{ color: 'var(--rr-red)', marginRight: 4 }}>★</span>
}

export function FeedbackModal({ onClose }: { onClose: () => void }) {
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [experience, setExperience] = useState('')
  const [wishlist, setWishlist] = useState('')

  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit() {
    setSending(true)
    setSendError(null)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, experience, wishlist }),
      })
      if (!res.ok) throw new Error('Send failed')
      setSent(true)
    } catch (err) {
      console.error('Feedback send failed:', err)
      setSendError("Something went wrong sending your feedback. Please try again.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(13,42,74,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100, padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="clay-card feedback-modal-card"
        style={{
          maxWidth: 480, width: '100%', background: 'var(--rr-warm)',
          maxHeight: '90vh', overflowY: 'auto', position: 'relative',
        }}
        onClick={function(e) { e.stopPropagation() }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: 14, right: 14,
            width: 30, height: 30, borderRadius: '50%',
            background: 'var(--rr-red)', color: '#fff', border: 'var(--rr-outline-sm)',
            cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ✕
        </button>

        {sent ? (
  <div style={{ textAlign: 'center', padding: '40px 10px 20px' }}>
    <img
      src="/icons/feedback-success.png"
      alt=""
      className="feedback-success-icon"
      style={{ width: 150, height: 150, display: 'block', margin: '0 auto 10px', objectFit: 'contain' }}
    />
    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 20, color: 'var(--rr-navy)', marginBottom: 8 }}>
      Thanks for your feedback!
    </div>
    <div style={{ fontSize: 13, color: 'rgba(13,42,74,0.6)', lineHeight: 1.5, marginBottom: 20 }}>
      We really appreciate you taking the time to help us build a better Rink Rater.
    </div>
    <button
      type="button"
      onClick={onClose}
      className="clay-btn clay-btn-primary"
      style={{ fontSize: 14, padding: '11px 28px' }}
    >
      Close
    </button>
  </div>
) : (
          <>
            <div className="feedback-modal-intro" style={{ textAlign: 'center', marginBottom: 20 }}>
              <div className="feedback-modal-title" style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 22, color: 'var(--rr-navy)', marginBottom: 8 }}>
                We Want Your Feedback!
              </div>
              <div className="feedback-modal-subtitle" style={{ fontSize: 13, color: 'rgba(13,42,74,0.6)', lineHeight: 1.5 }}>
                Help us make Rink Rater better for you and hockey parents everywhere.
              </div>
            </div>

            {/* Question 1 — rating */}
            <div className="feedback-modal-section" style={{ marginBottom: 20 }}>
              <div className="feedback-modal-question" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, color: 'var(--rr-navy)', marginBottom: 12 }}>
                <RequiredMark />1. How would you rate your overall experience with Rink Rater?
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
                {RATING_ICONS.map(function(opt, i) {
                  const value = i + 1
                  const isActive = value === (hoverRating || rating)
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={function() { setRating(value) }}
                      onMouseEnter={function() { setHoverRating(value) }}
                      onMouseLeave={function() { setHoverRating(0) }}
                      aria-label={opt.label}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: 3,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                        borderRadius: 10,
                        outline: value === rating ? '2px solid var(--rr-red)' : 'none',
                        outlineOffset: 3,
                        transform: isActive ? 'scale(1.08)' : 'scale(1)',
                        transition: 'transform 0.12s ease',
                        opacity: (hoverRating || rating) === 0 ? 1 : (isActive ? 1 : 0.5),
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={opt.src} alt="" className="feedback-modal-face" style={{ width: 46, height: 46, display: 'block' }} />
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 12, color: 'var(--rr-navy)' }}>
                        {value}
                      </div>
                      <div className="feedback-modal-face-label" style={{ fontSize: 10, color: 'rgba(13,42,74,0.5)' }}>
                        {opt.label}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Question 2 */}
            <div className="feedback-modal-section" style={{ marginBottom: 20 }}>
              <div className="feedback-modal-question" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, color: 'var(--rr-navy)', marginBottom: 8 }}>
                <RequiredMark />2. What can we do to improve your experience?
              </div>
              <textarea
                value={experience}
                onChange={function(e) { setExperience(e.target.value.slice(0, MAX_LENGTH)) }}
                rows={2}
                placeholder="Share your thoughts..."
                style={{
                  width: '100%', padding: '10px 12px', border: 'var(--rr-outline-sm)', borderRadius: 10,
                  fontSize: 13, fontFamily: 'var(--font-body)', color: 'var(--rr-navy)', resize: 'vertical',
                  background: '#fff', boxSizing: 'border-box',
                }}
              />
              <div style={{ textAlign: 'right', fontSize: 10, color: 'rgba(13,42,74,0.4)', marginTop: 3 }}>
                {experience.length}/{MAX_LENGTH}
              </div>
            </div>

            {/* Question 3 */}
            <div className="feedback-modal-section" style={{ marginBottom: 20 }}>
              <div className="feedback-modal-question" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, color: 'var(--rr-navy)', marginBottom: 8 }}>
                <RequiredMark />3. What features would you most like to see added to Rink Rater?
              </div>
              <textarea
                value={wishlist}
                onChange={function(e) { setWishlist(e.target.value.slice(0, MAX_LENGTH)) }}
                rows={2}
                placeholder="Your wish list of features..."
                style={{
                  width: '100%', padding: '10px 12px', border: 'var(--rr-outline-sm)', borderRadius: 10,
                  fontSize: 13, fontFamily: 'var(--font-body)', color: 'var(--rr-navy)', resize: 'vertical',
                  background: '#fff', boxSizing: 'border-box',
                }}
              />
              <div style={{ textAlign: 'right', fontSize: 10, color: 'rgba(13,42,74,0.4)', marginTop: 3 }}>
                {wishlist.length}/{MAX_LENGTH}
              </div>
            </div>

            {/* Footer */}
            <div className="feedback-modal-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>✉️</span>
                <div style={{ fontSize: 11, color: 'rgba(13,42,74,0.6)', lineHeight: 1.35 }}>
                  Your feedback goes directly to<br />
                  <strong style={{ color: 'var(--rr-navy)' }}>feedback@rinkrater.com</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={sending}
                className="clay-btn clay-btn-primary feedback-modal-send"
                style={{ fontSize: 14, padding: '11px 24px', flexShrink: 0, opacity: sending ? 0.6 : 1 }}
              >
                {sending ? 'Sending...' : 'Send Feedback'}
              </button>
            </div>

            {sendError && (
              <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--rr-red)', marginTop: 10, fontWeight: 700 }}>
                {sendError}
              </div>
            )}

            <div className="feedback-modal-thanks" style={{ textAlign: 'center', fontSize: 11, color: 'rgba(13,42,74,0.45)', marginTop: 16 }}>
              Thank you for helping us build the best hockey community!
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        .feedback-modal-card {
          padding: 24px;
        }
        @media (max-width: 480px) {
          .feedback-modal-card {
            padding: 16px;
          }
            
          .feedback-modal-intro {
            margin-bottom: 12px !important;
          }
          .feedback-modal-title {
            font-size: 18px !important;
            margin-bottom: 4px !important;
          }
          .feedback-modal-subtitle {
            font-size: 12px !important;
          }
          .feedback-modal-section {
            margin-bottom: 14px !important;
          }
          .feedback-modal-question {
            font-size: 13px !important;
            margin-bottom: 8px !important;
          }
          .feedback-modal-face {
            width: 34px !important;
            height: 34px !important;
          }
          .feedback-modal-face-label {
            display: none;
          }
          .feedback-modal-footer {
            flex-direction: column;
            align-items: stretch !important;
          }
          .feedback-modal-send {
            width: 100%;
          }
          .feedback-modal-thanks {
            margin-top: 10px !important;
          }
            .feedback-success-icon {
              width: 70px !important;
              height: 70px !important;
          }
        }
      `}</style>
    </div>
  )
}