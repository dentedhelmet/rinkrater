'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BottomBanner } from '@/components/layout/BottomBanner'
import { TopBar } from '@/components/layout/TopBar'
import { AuthModal } from '@/components/auth/AuthModal'
import { useAuth } from '@/context/AuthContext'
import { getLevelForXP, getNextLevelXP, LEVELS } from '@/lib/levels'
import Link from 'next/link'

// Rough, no-tracking-required estimate of impact: each published review is
// assumed to help roughly this many families make a decision. Arbitrary but
// reasonable-sounding constant — adjust freely, it's not derived from real data.
const FAMILIES_HELPED_MULTIPLIER = 3

// ─── Static badge definitions ──────────────────────────────────────────────────
// earned status is derived from the user's real stats.
// `criteria` is shown to the user directly (not just a hover tooltip) so
// they always know why a badge is locked or how they earned it — hover-only
// tooltips don't work on touch devices anyway.
// `comingSoon` badges have no real earning logic wired up yet — flagged
// honestly rather than showing a criteria string that doesn't actually work.
const BADGE_DEFS = [
  { id: 'rink_regular',   icon: '/badges/badges-rink-regular.png',    label: 'Rink Regular',   criteria: 'Leave 1 review',      earnedIf: (r: number) => r >= 1  },
  { id: 'road_warrior',   icon: '/badges/badges-road-warrior.png',    label: 'Road Warrior',   criteria: 'Reach 1,000 XP',      earnedIf: (_: number, xp: number) => xp >= 1000 },
  { id: 'scout',          icon: '/badges/badges-scout.png',           label: 'Scout',          criteria: 'Leave 5 reviews',     earnedIf: (r: number) => r >= 5  },
  { id: 'pioneer',        icon: '/badges/badges-pioneer.png',         label: 'Pioneer',        criteria: 'Leave 10 reviews',    earnedIf: (r: number) => r >= 10 },
  // NOTE: this checks total review count, same as Scout — not specifically
  // temperature-category reviews, despite the name. Flagging so the label
  // doesn't quietly mislead; worth deciding if this should actually check
  // RINK TEMPERATURE category entries specifically at some point.
  { id: 'temp_reporter',  icon: '/badges/badges-temp-reporter.png',   label: 'Temp Reporter',  criteria: 'Leave 3 reviews',     earnedIf: (r: number) => r >= 3  },
  { id: 'review_50',      icon: '/badges/badges-fifty-reviews.png',   label: '50 Reviews',     criteria: 'Leave 50 reviews',    earnedIf: (r: number) => r >= 50 },
  { id: 'coast_to_coast', icon: '/badges/badges-five-states.png',     label: '5 States',       criteria: 'Coming soon',         earnedIf: () => false, comingSoon: true },
  { id: 'rink_rat_mom',   icon: '/badges/badges-rink-rat-mom.png',    label: 'Rink Rat Mom',   criteria: 'Coming soon',         earnedIf: () => false, comingSoon: true },
]

export default function ProfilePage() {
  const router                    = useRouter()
  const { user, profile, loading, signOut } = useAuth()
  const [showAuth,   setShowAuth] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <div style={{ fontSize: 32 }}>⛸️</div>
        <p className="body-sm" style={{ color: 'rgba(13,42,74,0.4)' }}>Loading...</p>
      </div>
    )
  }

  // ── Not logged in ────────────────────────────────────────────────────────────
  if (!user || !profile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>⛸️</div>
          <h1 className="display-lg" style={{ marginBottom: 8 }}>Your Profile</h1>
          <p className="body-md" style={{ color: 'rgba(13,42,74,0.55)', maxWidth: 260, marginBottom: 28, lineHeight: 1.6 }}>
            Sign in to track your XP, badges, and quiz scores across every rink.
          </p>
          <button
            className="clay-btn clay-btn-primary"
            style={{ fontSize: 16, padding: '13px 36px', marginBottom: 12 }}
            onClick={() => setShowAuth(true)}
          >
            Sign In
          </button>
          <button
            className="clay-btn clay-btn-secondary"
            style={{ fontSize: 14, padding: '11px 28px' }}
            onClick={() => { setShowAuth(true) }}
          >
            Create Account
          </button>
        </main>
        <BottomBanner />
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      </div>
    )
  }

  // ── Logged in ────────────────────────────────────────────────────────────────
  const xp          = profile.xp
  const currentLevel = getLevelForXP(xp)
  const nextXP      = getNextLevelXP(xp)
  const pct         = Math.round(((xp - currentLevel.xpStart) / (nextXP - currentLevel.xpStart)) * 100)
  const nextLevel   = LEVELS.find((l) => l.level === currentLevel.level + 1)

  // Computed, not stored — see FAMILIES_HELPED_MULTIPLIER above.
  const familiesHelped = profile.total_reviews * FAMILIES_HELPED_MULTIPLIER

  const badges = BADGE_DEFS.map((b) => ({
    ...b,
    earned: b.earnedIf(profile.total_reviews, xp),
  }))

  const nextBadge = badges.find((b) => !b.earned && !b.comingSoon)

  async function handleSignOut() {
    setSigningOut(true)
    await signOut()
    setSigningOut(false)
    router.push('/')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

      <TopBar
        showBack={true}
        backHref="/"
        title="My Profile"
        shareIcon="dots"
        onShare={function() {
          const shareUrl = window.location.origin
          if (navigator.share) {
            navigator.share({ title: 'Rink Rater', url: shareUrl })
          } else {
            navigator.clipboard.writeText(shareUrl)
            alert('Link copied to clipboard!')
          }
        }}
        shareAriaLabel="Share Rink Rater"
      />

      {/* ── Header ── */}
      <div style={{ background: 'var(--rr-red)', flexShrink: 0 }}>
        <div style={{ padding: '12px 14px 10px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '2px solid rgba(0,0,0,0.1)' }}>
          {/* Avatar — photo or initials fallback */}
          <div style={{
            width: 50, height: 50, borderRadius: '50%',
            border: 'var(--rr-outline)',
            overflow: 'hidden',
            flexShrink: 0,
            background: 'var(--rr-yellow)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={profile.alias}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 18, color: 'var(--rr-navy)' }}>
                {profile.initials}
              </span>
            )}
          </div>

          {/* Name + level */}
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 17, color: '#fff' }}>
              {profile.alias}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
              {currentLevel.title} · Level {currentLevel.level}
            </div>
          </div>

          {/* Streak + sign out */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              background: 'var(--rr-yellow)', border: 'var(--rr-outline-sm)',
              borderRadius: 999, padding: '4px 10px',
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 11,
              color: 'var(--rr-navy)', boxShadow: 'var(--rr-shadow-sm)',
              display: 'flex', alignItems: 'center', gap: 3,
            }}>
              🔥 {profile.streak}
            </div>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              style={{
                background: 'rgba(0,0,0,0.2)',
                border:     '1.5px solid rgba(255,255,255,0.3)',
                borderRadius: 999,
                padding:    '4px 10px',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize:   10,
                color:      'rgba(255,255,255,0.8)',
                cursor:     'pointer',
              }}
            >
              {signingOut ? '...' : 'Sign out'}
            </button>
          </div>
        </div>

        {/* XP bar */}
        <div style={{ padding: '8px 14px 12px', background: 'rgba(0,0,0,0.2)' }}>
          <div style={{ height: 8, background: 'rgba(255,255,255,0.15)', borderRadius: 999, overflow: 'hidden', marginBottom: 4 }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'var(--rr-green)', borderRadius: 999, transition: 'width 0.6s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-display)' }}>
            <span>{xp.toLocaleString()} XP</span>
            <span>{nextLevel ? `${nextLevel.title}: ${nextXP.toLocaleString()}` : 'Max level!'}</span>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <main style={{ flex: 1, overflowY: 'auto', background: '#EEF4FA', padding: 12 }} className="scroll-y">

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
          {[
            { num: profile.total_reviews, label: 'Reviews'         },
            { num: profile.streak,        label: 'Day streak'      },
            { num: familiesHelped,        label: 'Families helped' },
          ].map((s) => (
            <div key={s.label} className="clay-card-sm" style={{ padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 22, color: 'var(--rr-navy)' }}>
                {s.num}
              </div>
              <div className="caption">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Game Tracker link */}
<Link
  href="/game-tracker"
  style={{ textDecoration: 'none', display: 'block', marginBottom: 12 }}
>
  <div className="clay-card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
    <img src="/icons/rr_shottracker_icon.png" style={{ width: 65, height: 65, objectFit: 'contain' }} />
    <div style={{ flex: 1 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 14, color: 'var(--rr-navy)' }}>
        Game Tracker
      </div>
      <div className="body-xs" style={{ color: 'rgba(13,42,74,0.5)', marginTop: 2 }}>
        Track stats, shots & save percentage
      </div>
    </div>
    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: 'rgba(13,42,74,0.25)' }}>›</div>
  </div>
</Link>

        {/* Badges — horizontal scroll carousel */}
        <div
  className="badge-carousel"
  style={{
    display: 'flex', gap: 13, overflowX: 'auto',
    padding: '2px 2px 10px', marginBottom: 12,
    scrollSnapType: 'x proximity',
    WebkitOverflowScrolling: 'touch',
  }}
>
  {badges.map((badge) => (
    <div
      key={badge.id}
      style={{
        flex: '0 0 115px', scrollSnapAlign: 'start',
        background: '#fff', border: 'var(--rr-outline-sm)', borderRadius: 12,
        padding: '12px 10px', textAlign: 'center',
        opacity: badge.earned ? 1 : 0.55,
        boxShadow: 'var(--rr-shadow-sm)',
      }}
    >
      <div style={{
  width: 60, height: 60, borderRadius: 10,
  background: '#fff',
  border: badge.earned ? '2px solid var(--rr-yellow)' : '2px solid rgba(13,42,74,0.12)',
  boxShadow: badge.earned ? '0 0 0 3px rgba(255,209,77,0.25)' : 'none',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  margin: '0 auto 6px',
}}>
  <img
    src={badge.icon}
    alt={badge.label}
    style={{
      width: '98%', height: '98%', objectFit: 'contain',
      filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))',
    }}
  />
</div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, color: 'var(--rr-navy)' }}>
        {badge.label}
      </div>
      <div style={{ fontSize: 14, color: 'rgba(13,42,74,0.5)', marginTop: 2, lineHeight: 1.25 }}>
        {badge.criteria}
      </div>
    </div>
  ))}
</div>

        {/* Next badge */}
        {nextBadge && (
          <div className="clay-card" style={{ padding: '10px 14px', marginBottom: 12, background: 'var(--rr-ice)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 12, color: 'var(--rr-navy)', marginBottom: 4 }}>
              <img src={nextBadge.icon} alt={nextBadge.label} style={{ width: 20, height: 20, objectFit: 'contain', verticalAlign: 'middle', marginRight: 4 }} />
Next up: {nextBadge.label}
            </div>
            <div className="body-sm" style={{ color: 'rgba(13,42,74,0.65)' }}>
              {nextBadge.criteria} to unlock this badge and earn bonus XP.
            </div>
          </div>
        )}

        {/* Community impact */}
        {familiesHelped > 0 && (
          <div className="clay-card" style={{ padding: '10px 14px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 13, color: 'var(--rr-navy)', marginBottom: 5 }}>
              You've helped an estimated {familiesHelped} {familiesHelped === 1 ? 'family' : 'families'}
            </div>
            <div className="body-sm" style={{ color: 'rgba(13,42,74,0.65)' }}>
              Your reviews are answering real questions for real hockey families. Keep it up.
            </div>
          </div>
        )}
      </main>

      <BottomBanner />

      <style jsx>{`
        .badge-carousel::-webkit-scrollbar {
          height: 5px;
        }
        .badge-carousel::-webkit-scrollbar-thumb {
          background: rgba(13, 42, 74, 0.2);
          border-radius: 3px;
        }
      `}</style>
    </div>
  )
}
