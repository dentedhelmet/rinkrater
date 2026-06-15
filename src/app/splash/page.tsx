'use client'

import Link from 'next/link'
import { TJ } from '@/components/tj/TJ'

export default function SplashScreen() {
  return (
    <div
      style={{
        flex: 1,
        background: 'var(--rr-navy)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        minHeight: '100dvh',
      }}
    >
      <svg width="72" height="46" viewBox="0 0 72 46" style={{ marginBottom: 8 }} aria-label="Rink Rater logo">
        <path d="M4 38 A32 32 0 0 1 68 38" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="8" strokeLinecap="round"/>
        <path d="M4 38 A32 32 0 0 1 22 10"  fill="none" stroke="#E24B4A" strokeWidth="8" strokeLinecap="round"/>
        <path d="M22 10 A32 32 0 0 1 50 10" fill="none" stroke="#FFD23F" strokeWidth="8" strokeLinecap="round"/>
        <path d="M50 10 A32 32 0 0 1 68 38" fill="none" stroke="#3BB273" strokeWidth="8" strokeLinecap="round"/>
        <line x1="36" y1="38" x2="20" y2="14" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="36" cy="38" r="3.5" fill="#fff"/>
      </svg>

      <div style={{ marginBottom: 8 }}>
        <TJ state="idle" size="xl" />
      </div>

      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 900,
          fontSize: 26,
          color: '#fff',
          textAlign: 'center',
          lineHeight: 1.15,
          marginBottom: 8,
        }}
      >
        Rate where<br />you skate
      </h1>

      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginBottom: 32 }}>
        Real reviews from real hockey families
      </p>

      <Link href="/" style={{ width: '100%', maxWidth: 300, textDecoration: 'none' }}>
        <div
          style={{
            background: 'var(--rr-yellow)',
            border: 'var(--rr-outline)',
            borderRadius: 999,
            boxShadow: 'var(--rr-shadow)',
            padding: '14px 28px',
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 15,
            color: 'var(--rr-navy)',
            textAlign: 'center',
            cursor: 'pointer',
            width: '100%',
          }}
        >
          Find your rink →
        </div>
      </Link>

      <button
        style={{
          background: 'transparent',
          border: 'none',
          color: 'rgba(255,255,255,0.45)',
          fontSize: 12,
          marginTop: 16,
          cursor: 'pointer',
          fontFamily: 'var(--font-body)',
        }}
      >
        Already have an account? Sign in
      </button>
    </div>
  )
}
