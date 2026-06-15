'use client'

import Link from 'next/link'

interface TopBarProps {
  title?: string
  showBack?: boolean
  backHref?: string
  rightAction?: React.ReactNode
  variant?: 'red' | 'navy' | 'transparent'
}

export function TopBar({
  title,
  showBack = false,
  backHref = '/',
  rightAction,
  variant = 'red',
}: TopBarProps) {
  const bg = variant === 'red' ? 'var(--rr-red)' : variant === 'navy' ? 'var(--rr-navy)' : 'transparent'
  const color = variant === 'transparent' ? 'var(--rr-navy)' : '#fff'

  return (
    <header
      style={{
        background: bg,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        borderBottom: variant !== 'transparent' ? 'var(--rr-outline)' : 'none',
        zIndex: 'var(--z-header)',
        flexShrink: 0,
      }}
    >
      {showBack && (
        <Link
          href={backHref}
          aria-label="Go back"
          style={{
            width: 30, height: 30,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color, fontSize: 18, textDecoration: 'none',
            flexShrink: 0,
          }}
        >
          ‹
        </Link>
      )}

      {!showBack && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LogoMeter />
          <div>
            <div style={{ color, fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 16 }}>
              Rink Rater
            </div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase' }}>
              Rate where you skate
            </div>
          </div>
        </div>
      )}

      {title && showBack && (
        <span style={{ color, fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 14, flex: 1 }}>
          {title}
        </span>
      )}

      {rightAction && (
        <div style={{ marginLeft: 'auto' }}>{rightAction}</div>
      )}
    </header>
  )
}

function LogoMeter() {
  return (
    <svg width="30" height="20" viewBox="0 0 30 20" aria-hidden="true">
      <path d="M2 15A11 11 0 0 1 28 15" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3.5" strokeLinecap="round"/>
      <path d="M2 15A11 11 0 0 1 9 5"   fill="none" stroke="#E24B4A" strokeWidth="3.5" strokeLinecap="round"/>
      <path d="M9 5A11 11 0 0 1 21 5"   fill="none" stroke="#FFD23F" strokeWidth="3.5" strokeLinecap="round"/>
      <path d="M21 5A11 11 0 0 1 28 15" fill="none" stroke="#3BB273" strokeWidth="3.5" strokeLinecap="round"/>
      <line x1="15" y1="15" x2="9" y2="7" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="15" cy="15" r="2" fill="#fff"/>
    </svg>
  )
}
