'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { AuthModal } from '@/components/auth/AuthModal'

interface TopBarProps {
  title?:       string
  showBack?:    boolean
  backHref?:    string
  rightAction?: React.ReactNode
  variant?:     'red' | 'navy' | 'transparent'
}

const NAV_LINKS = [
  { label: 'About',            href: '/about'          },
  { label: 'Partners',         href: '/partners'        },
  { label: 'Shop',             href: '/shop'            },
  { label: "What's the Call?", href: '/whats-the-call'  },
]

export function TopBar(props: TopBarProps) {
  const { title, showBack = false, backHref = '/', rightAction, variant = 'red' } = props
  const { user, profile, signOut } = useAuth()
  const [menuOpen,  setMenuOpen]  = useState(false)
  const [showAuth,  setShowAuth]  = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const bg    = variant === 'red' ? 'var(--rr-red)' : variant === 'navy' ? 'var(--rr-navy)' : 'transparent'
  const color = variant === 'transparent' ? 'var(--rr-navy)' : '#fff'

  async function handleSignOut() {
    setSigningOut(true)
    setMenuOpen(false)
    await signOut()
    setSigningOut(false)
  }

  // Shared auth button — shows avatar+alias if signed in, Sign In if not
  function AuthButton({ onClick }: { onClick?: () => void }) {
    if (user && profile) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link
            href="/profile"
            onClick={onClick}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--rr-yellow)',
              color: 'var(--rr-navy)',
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13,
              padding: '6px 12px',
              borderRadius: 999,
              textDecoration: 'none',
              border: '2px solid var(--rr-navy)',
            }}
          >
            <span style={{ fontWeight: 900 }}>{profile.initials}</span>
            {profile.alias}
          </Link>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: '1.5px solid rgba(255,255,255,0.3)',
              borderRadius: 999,
              padding: '6px 10px',
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11,
              color: 'rgba(255,255,255,0.8)',
              cursor: 'pointer',
            }}
          >
            {signingOut ? '...' : 'Sign out'}
          </button>
        </div>
      )
    }

    return (
      <button
        onClick={() => { setShowAuth(true); onClick?.() }}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--rr-warm)',
          color: 'var(--rr-navy)',
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13,
          padding: '8px 16px',
          borderRadius: 999,
          border: '2px solid var(--rr-navy)',
          cursor: 'pointer',
        }}
      >
        <span aria-hidden="true">👤</span> Sign In
      </button>
    )
  }

  return (
    <>
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
        {showBack ? (
          <Link
            href={backHref}
            aria-label="Go back"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, textDecoration: 'none', flexShrink: 0 }}
          >
            <img src="/icons/rr_clay_back_button_red.png" alt="" style={{ width: 45, height: 45, objectFit: 'contain' }} />
          </Link>
        ) : (
          <Link href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <img src="/logo/rinkrater-logo.png" alt="Rink Rater logo" style={{ width: 280, height: 80, objectFit: 'contain' }} />
          </Link>
        )}

        {title && showBack && (
          <span style={{ color, fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 14, flex: 1 }}>
            {title}
          </span>
        )}

        {/* Desktop nav */}
        {!showBack && (
          <nav className="topbar-desktop-nav" style={{ marginLeft: 'auto', display: 'none', alignItems: 'center', gap: 24 }}>
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{ color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}
              >
                {link.label}
              </Link>
            ))}
            <AuthButton />
          </nav>
        )}

        {/* Hamburger */}
        {!showBack && (
          <button
            className="topbar-hamburger"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Open menu"
            style={{
              marginLeft: 'auto',
              background: 'rgba(255,255,255,0.18)',
              border: 'none',
              borderRadius: 8,
              width: 45, height: 45,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              color: '#fff',
              fontSize: 18,
            }}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        )}

        {rightAction && (
          <div style={{ marginLeft: showBack ? 'auto' : 0 }}>{rightAction}</div>
        )}

        {/* Mobile menu */}
        {menuOpen && (
          <div
            style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              background: 'var(--rr-navy)',
              borderBottom: 'var(--rr-outline)',
              padding: '12px 14px',
              display: 'flex', flexDirection: 'column', gap: 12,
              zIndex: 99,
            }}
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                style={{ color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}
              >
                {link.label}
              </Link>
            ))}
            <div style={{ marginTop: 4 }}>
              <AuthButton onClick={() => setMenuOpen(false)} />
            </div>
          </div>
        )}

        <style jsx>{`
          @media (min-width: 768px) {
            .topbar-desktop-nav  { display: flex !important; }
            .topbar-hamburger    { display: none !important; }
          }
        `}</style>
      </header>

      {showAuth && (
        <AuthModal onClose={() => setShowAuth(false)} />
      )}
    </>
  )
}
