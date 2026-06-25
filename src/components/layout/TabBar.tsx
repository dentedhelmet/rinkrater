'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { TJ } from '@/components/tj/TJ'

const TABS = [
  { href: '/',        icon: '⌂',  label: 'Home'   },
  { href: '/search',  icon: '⌕',  label: 'Search' },
  { href: '/review',  icon: '★',  label: 'Review' },
  { href: '/profile', icon: '⊕',  label: 'My XP'  },
]

export function TabBar() {
  const path = usePathname()

  return (
    <nav
      aria-label="Main navigation"
      style={{
        background: 'var(--rr-warm)',
        borderTop: 'var(--rr-outline)',
        display: 'flex',
        alignItems: 'center',
        zIndex: 'var(--z-tabbar)',
        flexShrink: 0,
      }}
    >
      {TABS.slice(0, 2).map(tab => (
        <TabItem key={tab.href} {...tab} active={path === tab.href} />
      ))}

      <Link
        href="/"
        aria-label="Home — TJ"
        style={{
          flex: '0 0 62px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          marginTop: -20,
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            width: 54,
            height: 54,
            borderRadius: '50%',
            background: 'var(--rr-red)',
            border: 'var(--rr-outline)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <TJ state="idle" size="sm" crop="face" />
        </div>
      </Link>

      {TABS.slice(2).map(tab => (
        <TabItem key={tab.href} {...tab} active={path === tab.href} />
      ))}
    </nav>
  )
}

function TabItem({
  href,
  icon,
  label,
  active,
}: {
  href: string
  icon: string
  label: string
  active: boolean
}) {
  return (
    <Link
      href={href}
      style={{
        flex: 1,
        padding: '8px 4px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        textDecoration: 'none',
      }}
    >
      <span
        style={{
          fontSize: 20,
          color: active ? 'var(--rr-red)' : 'rgba(13,42,74,0.3)',
        }}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 9,
          letterSpacing: '0.3px',
          color: active ? 'var(--rr-red)' : 'rgba(13,42,74,0.35)',
        }}
      >
        {label}
      </span>
    </Link>
  )
}
