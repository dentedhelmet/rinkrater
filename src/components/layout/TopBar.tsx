'use client'

import Link from 'next/link'
import { useState } from 'react'

interface TopBarProps {
  title?: string
  showBack?: boolean
  backHref?: string
  rightAction?: React.ReactNode
  variant?: 'red' | 'navy' | 'transparent'
}

const NAV_LINKS = [
  { label: 'About', href: '/about' },
  { label: 'Partners', href: '/partners' },
  { label: 'Shop', href: '/shop' },
]

export function TopBar(props: TopBarProps) {
  const title = props.title
  const showBack = props.showBack || false
  const backHref = props.backHref || '/'
  const rightAction = props.rightAction
  const variant = props.variant || 'red'
  const [menuOpen, setMenuOpen] = useState(false)

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
        zIndex: 100,
        position: 'relative',
      }}
    >
      {showBack && (
        <Link
          href={backHref}
          aria-label="Go back"
          style={{
            width: 36, height: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <img
            src="/icons/rr_clay_back_button_red.png"
            alt="Back"
            style={{ width: 36, height: 36, objectFit: 'contain' }}
          />
        </Link>
      )}
      {!showBack && (
        <Link href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <LogoMeter />
        </Link>
      )}

      {title && showBack && (
        <span style={{ color: color, fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 14, flex: 1 }}>
          {title}
        </span>
      )}

      {!showBack && (
        <nav className="topbar-desktop-nav" style={{ marginLeft: 'auto', display: 'none', alignItems: 'center', gap: 24 }}>
          {NAV_LINKS.map(function(link) {
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{ color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}
              >
                {link.label}
              </Link>
            )
          })}
          <Link
            href="/signin"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--rr-warm)',
              color: 'var(--rr-navy)',
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13,
              padding: '8px 16px',
              borderRadius: 999,
              textDecoration: 'none',
              border: '2px solid var(--rr-navy)',
            }}
          >
            <span aria-hidden="true">{'\u{1F464}'}</span> Sign In
          </Link>
        </nav>
      )}

      {!showBack && (
        <button
          className="topbar-hamburger"
          onClick={function() { setMenuOpen(!menuOpen) }}
          aria-label="Open menu"
          style={{
            marginLeft: 'auto',
            background: 'rgba(255,255,255,0.18)',
            border: 'none',
            borderRadius: 8,
            width: 36, height: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            color: '#fff',
            fontSize: 18,
          }}
        >
          {menuOpen ? '\u2715' : '\u2630'}
        </button>
      )}

      {rightAction && (
        <div style={{ marginLeft: showBack ? 'auto' : 0 }}>{rightAction}</div>
      )}

      {menuOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'var(--rr-navy)',
            borderBottom: 'var(--rr-outline)',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            zIndex: 99,
          }}
        >
          {NAV_LINKS.map(function(link) {
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={function() { setMenuOpen(false) }}
                style={{ color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}
              >
                {link.label}
              </Link>
            )
          })}
          <Link
            href="/signin"
            onClick={function() { setMenuOpen(false) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
              background: 'var(--rr-warm)',
              color: 'var(--rr-navy)',
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13,
              padding: '10px 16px',
              borderRadius: 999,
              textDecoration: 'none',
              border: '2px solid var(--rr-navy)',
              marginTop: 4,
            }}
          >
            <span aria-hidden="true">{'\u{1F464}'}</span> Sign In
          </Link>
        </div>
      )}

      <style jsx>{`
        @media (min-width: 768px) {
          .topbar-desktop-nav {
            display: flex !important;
          }
          .topbar-hamburger {
            display: none !important;
          }
        }
      `}</style>
    </header>
  )
}

function LogoMeter() {
  return (
    <img
      src="/logo/rinkrater-logo.png"
      alt="Rink Rater logo"
      style={{ width: 280, height: 80, objectFit: 'contain' }}
    />
  )
}
