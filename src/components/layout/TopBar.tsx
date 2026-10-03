'use client'

import Link from 'next/link'

interface TopBarProps {
  title?:       string
  showBack?:    boolean
  backHref?:    string
  rightAction?: React.ReactNode
  variant?:     'red' | 'navy' | 'transparent'
}

export function TopBar(props: TopBarProps) {
  const { title, showBack = true, backHref = '/', rightAction, variant = 'navy' } = props

  if (!showBack && !title && !rightAction) {
    return null
  }

  const bg    = variant === 'red' ? 'var(--rr-red)' : variant === 'navy' ? 'var(--rr-navy)' : 'transparent'
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
        position: 'relative',
      }}
    >
      {showBack && (
        <Link
          href={backHref}
          aria-label="Go back"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, textDecoration: 'none', flexShrink: 0 }}
        >
          <img src="/icons/rr_clay_back_button_red.png" alt="" style={{ width: 45, height: 45, objectFit: 'contain' }} />
        </Link>
      )}

      {title && (
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