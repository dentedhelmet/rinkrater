'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { AuthModal } from '@/components/auth/AuthModal'

const NAV_LINKS = [
  { label: 'About',            href: '/about'          },
  { label: 'Partners',         href: '/partners'        },
  { label: 'Shop',             href: '/shop'            },
  { label: "What's the Call?", href: '/whats-the-call'  },
]

export function GlobalHeader() {
  const { user, profile, signOut } = useAuth()
  const [menuOpen,   setMenuOpen]   = useState(false)
  const [showAuth,   setShowAuth]   = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    setMenuOpen(false)
    await signOut()
    setSigningOut(false)
  }

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
            <span style={{
              width: 22, height: 22, borderRadius: '50%', overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--rr-navy)', color: '#fff', fontSize: 10, fontWeight: 900,
              flexShrink: 0,
            }}>
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                profile.initials
              )}
            </span>
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
    background: 'var(--rr-red)',
    padding: '10px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    borderBottom: 'var(--rr-outline)',
    zIndex: 150,
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    boxSizing: 'border-box',
  }}
>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <img src="/logo/rinkrater-logo.png" alt="Rink Rater logo" style={{ width: 280, height: 80, objectFit: 'contain' }} />
        </Link>

        {/* Desktop nav */}
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

        {/* Hamburger */}
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