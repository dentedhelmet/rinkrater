'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

// ─── Slide data ────────────────────────────────────────────────────────────────
const SLIDES = [
  { id: 1, image: '/onboarding/slide1.jpg', alt: 'Welcome to Rink Rater' },
  { id: 2, image: '/onboarding/slide2.jpg', alt: 'Find your next rink' },
  { id: 3, image: '/onboarding/slide3.jpg', alt: 'Become a Rink Rater' },
  { id: 4, image: '/onboarding/slide4.jpg', alt: 'Level up, earn badges' },
  { id: 5, image: '/onboarding/slide5.jpg', alt: 'Join the team' },
]

interface OnboardingModalProps {
  isOpen: boolean
  /** Skip / Close X — always routes to the main page */
  onDismiss: () => void
  /** Slide 5 "Create Account" — opens AuthModal with cameFromOnboarding=true */
  onCreateAccount: () => void
}

export function OnboardingModal({ isOpen, onDismiss, onCreateAccount }: OnboardingModalProps) {
  const [step, setStep] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Reset to slide 1 each time the modal is freshly opened
  useEffect(() => {
    if (isOpen) setStep(0)
  }, [isOpen])

  if (!mounted || !isOpen) return null

  const isLastSlide = step === SLIDES.length - 1

  function handleNext() {
    if (!isLastSlide) setStep((s) => s + 1)
  }

  function handleCreateAccount() {
    onDismiss()
    onCreateAccount()
  }

  return createPortal(
    /* Backdrop */
    <div
      style={{
        position:       'fixed',
        inset:          0,
        background:     'rgba(13,42,74,0.7)',
        zIndex:         300,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        '16px',
      }}
    >
      {/* Modal card */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position:     'relative',
          width:        '100%',
          maxWidth:     420,
          maxHeight:    '92dvh',
          overflowY:    'auto',
          background:   'var(--rr-warm)',
          border:       'var(--rr-outline)',
          borderRadius: 'var(--rr-radius)',
          boxShadow:    'var(--rr-shadow-lg)',
        }}
      >
        {/* Close X — always visible, always goes to main page */}
        <button
          onClick={onDismiss}
          aria-label="Close and go to main page"
          style={{
            position:       'absolute',
            top:            10,
            right:          10,
            zIndex:         10,
            width:          30,
            height:         30,
            borderRadius:   '50%',
            border:         'none',
            background:     'rgba(13,42,74,0.55)',
            color:          '#fff',
            fontSize:       18,
            lineHeight:     1,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            cursor:         'pointer',
          }}
        >
          &times;
        </button>

        {/* Responsive slide image — scales to modal width, no cropping */}
        <div style={{ width: '100%' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={SLIDES[step].image}
            alt={SLIDES[step].alt}
            style={{
              width:        '100%',
              height:       'auto',
              display:      'block',
              borderRadius: 'var(--rr-radius) var(--rr-radius) 0 0',
            }}
          />
        </div>

        {/* Controls */}
        <div style={{ padding: '18px 20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!isLastSlide ? (
            <>
              <button
                onClick={handleNext}
                className="clay-btn clay-btn-primary"
                style={{ width: '100%', fontSize: 16, padding: '13px' }}
              >
                Next →
              </button>
              <button
                onClick={onDismiss}
                className="body-sm"
                style={{
                  width:      '100%',
                  textAlign:  'center',
                  background: 'none',
                  border:     'none',
                  cursor:     'pointer',
                  color:      'rgba(13,42,74,0.5)',
                  fontWeight: 700,
                  padding:    '6px',
                }}
              >
                Skip
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleCreateAccount}
                className="clay-btn clay-btn-primary"
                style={{ width: '100%', fontSize: 16, padding: '13px' }}
              >
                Create Account
              </button>
              <button
                onClick={onDismiss}
                className="clay-btn"
                style={{
                  width:      '100%',
                  fontSize:   16,
                  padding:    '13px',
                  background: 'var(--rr-ice)',
                  color:      'var(--rr-navy)',
                }}
              >
                Continue as Guest
              </button>
            </>
          )}

          {/* Progress dots — click to jump to any slide, active slide shows as a dash */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, paddingTop: 4 }}>
            {SLIDES.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setStep(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === step}
                style={{
                  width:        i === step ? 20 : 7,
                  height:       7,
                  borderRadius: 999,
                  border:       'none',
                  padding:      0,
                  cursor:       'pointer',
                  background:   i === step ? 'var(--rr-red)' : 'rgba(13,42,74,0.2)',
                  transition:   'width 0.2s ease, background 0.2s ease',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
