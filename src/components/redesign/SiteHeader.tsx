'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import styles from './SiteHeader.module.css'

const NAV_LINKS = [
  { href: '/about',          label: 'About' },
  { href: '/partners',       label: 'Partners' },
  { href: '/shop',           label: 'Shop' },
  { href: '/whats-the-call', label: "What's the Call?" },
]

interface SiteHeaderProps {
  onSignIn: () => void
}

export function SiteHeader({ onSignIn }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const menuRef       = useRef<HTMLDivElement>(null)
  const { user, profile, signOut } = useAuth()
  const router = useRouter()

  // Close on Escape, return focus to the trigger button
  useEffect(() => {
    if (!menuOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        menuButtonRef.current?.focus()
      }
    }

    function handleClickOutside(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        !menuButtonRef.current?.contains(e.target as Node)
      ) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [menuOpen])

  async function handleSignOut() {
    setMenuOpen(false)
    await signOut()
    router.push('/')
  }

  return (
    <>
      {/* Skip link — invisible until keyboard-focused, lets keyboard/screen-reader
          users jump straight past the nav to the page's main content */}
      <a href="#main-content" className={styles.skipLink}>
        Skip to main content
      </a>

      <header className={styles.header}>
        <div className={styles.inner}>
          {/* Logo (tagline is baked into the image itself) */}
          <Link href="/" className={styles.logoLink} aria-label="Rink Rater home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo/rinkrater-logo.png"
              alt="Rink Rater — Rate where you skate"
              className={styles.logoImg}
            />
          </Link>

          {/* Desktop nav */}
          <nav aria-label="Primary" className={styles.desktopNav}>
            <ul className={styles.navList}>
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={styles.navLink}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Desktop: signed-in avatar pill + Sign Out, or Sign In button */}
          <div className={`${styles.desktopAuthArea} ${styles.desktopOnly}`}>
            {user ? (
              <>
                <Link href="/profile" className={styles.avatarPill}>
                  {profile?.avatar_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={profile.avatar_url}
                      alt=""
                      className={styles.avatarImg}
                    />
                  ) : (
                    <span className={styles.avatarInitials}>
                      {profile?.initials ?? '?'}
                    </span>
                  )}
                  <span className={styles.avatarAlias}>
                    {profile?.alias ?? 'My Profile'}
                  </span>
                </Link>
                <button onClick={handleSignOut} className={styles.signOutBtn}>
                  Sign Out
                </button>
              </>
            ) : (
              <button onClick={onSignIn} className={styles.signInBtn}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12Zm0 2.5c-3.3 0-9.8 1.6-9.8 4.9v2.4h19.6v-2.4c0-3.3-6.5-4.9-9.8-4.9Z"
                    fill="currentColor"
                  />
                </svg>
                Sign In
              </button>
            )}
          </div>

          {/* Mobile controls: avatar (if signed in) or Sign In, + hamburger */}
          <div className={styles.mobileControls}>
            {user ? (
              <Link href="/profile" aria-label="My profile" className={styles.iconBtn}>
                {profile?.avatar_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={profile.avatar_url}
                    alt=""
                    className={styles.mobileAvatarImg}
                  />
                ) : (
                  <span className={styles.mobileAvatarInitials}>
                    {profile?.initials ?? '?'}
                  </span>
                )}
              </Link>
            ) : (
              <button
                onClick={onSignIn}
                aria-label="Sign in"
                className={styles.iconBtn}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12Zm0 2.5c-3.3 0-9.8 1.6-9.8 4.9v2.4h19.6v-2.4c0-3.3-6.5-4.9-9.8-4.9Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            )}

            <button
              ref={menuButtonRef}
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav-menu"
              className={styles.iconBtn}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                {menuOpen ? (
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  />
                ) : (
                  <path
                    d="M4 7h16M4 12h16M4 17h16"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu panel */}
        {menuOpen && (
          <div
            id="mobile-nav-menu"
            ref={menuRef}
            role="menu"
            className={styles.mobilePanel}
          >
            <ul className={styles.mobileNavList}>
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    role="menuitem"
                    className={styles.mobileNavLink}
                    onClick={() => setMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              {user && (
                <li>
                  <button
                    role="menuitem"
                    onClick={handleSignOut}
                    className={styles.mobileNavLink}
                    style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Sign Out
                  </button>
                </li>
              )}
            </ul>
          </div>
        )}
      </header>
    </>
  )
}
