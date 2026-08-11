'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface PartnerModalProps {
  name:    string
  logo:    string
  blurb:   string
  facts:   string[]
  href:    string
  onClose: () => void
}

export function PartnerModal({ name, logo, blurb, facts, href, onClose }: PartnerModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // ADA: autofocus into the modal on open, Escape closes.
  useEffect(() => {
    closeButtonRef.current?.focus()
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(13,42,74,0.7)',
        zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="partner-modal-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="clay-card"
        style={{
          maxWidth: 420, width: '100%', maxHeight: '90dvh', overflowY: 'auto',
          background: 'var(--rr-warm)', padding: '24px 20px', position: 'relative',
        }}
      >
        <button
          ref={closeButtonRef}
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

        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logo}
            alt={name}
            style={{ width: 72, height: 72, objectFit: 'contain', display: 'block', margin: '0 auto 12px' }}
          />
          <div
            id="partner-modal-title"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 20, color: 'var(--rr-navy)' }}
          >
            {name}
          </div>
        </div>

        {facts.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginBottom: 16 }}>
            {facts.map((fact) => (
              <span
                key={fact}
                style={{
                  background: 'var(--rr-ice)', border: 'var(--rr-outline-sm)', borderRadius: 999,
                  padding: '5px 12px', fontSize: 11, fontWeight: 800,
                  fontFamily: 'var(--font-display)', color: 'var(--rr-navy)',
                }}
              >
                {fact}
              </span>
            ))}
          </div>
        )}

        <p style={{ fontSize: 13, lineHeight: 1.6, color: 'rgba(13,42,74,0.75)', marginBottom: 20, textAlign: 'center' }}>
          {blurb}
        </p>

        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="clay-btn clay-btn-primary"
          style={{ display: 'block', textAlign: 'center', textDecoration: 'none', fontSize: 14, padding: '12px' }}
        >
          Visit Website
        </a>
      </div>
    </div>,
    document.body
  )
}
