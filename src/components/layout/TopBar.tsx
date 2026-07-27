'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { AuthModal } from '@/components/auth/AuthModal'

interface TopBarProps {
  title?:          string
  showBack?:       boolean
  backHref?:       string
  rightAction?:    React.ReactNode // legacy escape hatch — prefer shareIcon/onShare below
  variant?:        'red' | 'navy' | 'transparent' // only affects the Home-page nav bar now
  shareIcon?:      'dots' | 'chat'
  onShare?:        () => void
  shareAriaLabel?: string
}

const NAV_LINKS = [
  { label: 'About',            href: '/about'          },
  { label: 'Partners',         href: '/partners'        },
  { label: 'Shop',             href: '/shop'            },
  { label: "What's the Call?", href: '/whats-the-call'  },
]

function BackIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  )
}

function DotsShareIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="M8.2 10.8l7.5-4.2M8.2 13.2l7.5 4.2" />
    </svg>
  )
}

function ChatShareIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16v12H9l-5 4V4z" />
    </svg>
  )
}

export function TopBar(props: TopBarProps) {
  const {
    title, showBack = false, backHref = '/', rightAction,
    variant = 'red', shareIcon, onShare, shareAriaLabel,
  } = props
  const { user, profile, signOut } = useAuth()
  const [menuOpen,   setMenuOpen]   = useState(false)
  const [showAuth,   setShowAuth]   = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const bg    = variant === 'red' ? 'var(--rr-red)' : variant === 'navy' ? 'var(--rr-navy)' : 'transparent'
  const color = variant === 'transparent' ? 'var(--rr-navy)' : '#fff'

  async function handleSignOut() {
    setSigningOut(true)
    setMenuOpen(false)
    await signOut()
    setSigningOut(false)
  }

  // Shared auth button — Home-page nav only, unchanged from before
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

  // ── Plaque circular button (back / share) — used only in showBack mode ──────
  function PlaqueButton({ label, onClick, href, children }: {
    label: string
    onClick?: () => void
    href?: string
    children: React.ReactNode
  }) {
    const style: React.CSSProperties = {
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(180deg, #fdfaf3 0%, #ece5d3 100%)',
      border: '1.5px solid var(--rr-navy)',
      borderRadius: '50%',
      width: 44, height: 44,
      boxShadow:
        'inset 0 1.5px 0 rgba(255,255,255,0.7), inset 0 -1.5px 2px rgba(0,0,0,0.15), 0 2px 0 rgba(0,0,0,0.25)',
      color: 'var(--rr-navy)',
      flexShrink: 0,
      padding: 0,
      cursor: 'pointer',
    }

    if (href) {
      return (
        <Link href={href} aria-label={label} style={style}>
          {children}
        </Link>
      )
    }

    return (
      <button type="button" onClick={onClick} aria-label={label} style={style}>
        {children}
      </button>
    )
  }

  // ── showBack mode: plaque board bar (Rink Info, Ask TJ, Review, Profile, etc) ──
  if (showBack) {
    const shareDefaultLabel = shareIcon === 'chat' ? 'Share this chat' : 'Share'

    return (
      <header
        style={{
          position: 'relative',
          height: 64,
          backgroundImage: "url('/topbar/rink-boards-bg.jpg')",
          backgroundRepeat: 'repeat-x',
          backgroundSize: 'auto 100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 8px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
          zIndex: 100,
          flexShrink: 0,
        }}
      >
        <PlaqueButton label="Back" href={backHref}>
          <BackIcon />
        </PlaqueButton>

        {title && (
  <h1 style={{
    margin: 0,
    flex: 1,
    textAlign: 'center',
    fontFamily: 'var(--font-display)',
    fontWeight: 900,
    fontSize: 'clamp(16px, 4.5vw, 20px)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: 'var(--rr-navy)',
    textShadow: '0 1px 1px rgba(255,255,255,0.6)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    padding: '0 8px',
  }}>
    {title}
  </h1>
)}

        {(shareIcon || onShare) ? (
          <PlaqueButton label={shareAriaLabel || shareDefaultLabel} onClick={onShare}>
            {shareIcon === 'chat' ? <ChatShareIcon /> : <DotsShareIcon />}
          </PlaqueButton>
        ) : rightAction ? (
          <div>{rightAction}</div>
        ) : (
          <div style={{ width: 44, flexShrink: 0 }} />
        )}
      </header>
    )
  }

  // ── Home-page mode: logo + desktop nav + hamburger, unchanged ────────────────
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
        <Link href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <img src="/logo/rinkrater-logo.png" alt="Rink Rater logo" style={{ width: 280, height: 80, objectFit: 'contain' }} />
        </Link>

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

        <button
          className="topbar-hamburger"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
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
