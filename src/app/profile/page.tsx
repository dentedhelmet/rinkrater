'use client'

import { TopBar } from '@/components/layout/TopBar'
import { BottomBanner } from '@/components/layout/BottomBanner'

const SAMPLE_USER = {
  alias: 'KMomof3',
  initials: 'KM',
  level: 3,
  levelTitle: 'Road Warrior',
  xp: 1284,
  xpToNext: 2500,
  streak: 12,
  totalReviews: 24,
  familiesHelped: 6,
  badges: [
    { id: 'rink_regular',  emoji: '⛸️', label: 'Rink Regular',   earned: true  },
    { id: 'road_warrior',  emoji: '🏒', label: 'Road Warrior',   earned: true  },
    { id: 'scout',         emoji: '🔍', label: 'Scout',          earned: true  },
    { id: 'pioneer',       emoji: '🥅', label: 'Pioneer',        earned: true  },
    { id: 'temp_reporter', emoji: '❄️', label: 'Temp Reporter',  earned: true  },
    { id: 'review_50',     emoji: '🏆', label: '50 reviews',     earned: false },
    { id: 'coast_to_coast',emoji: '🌎', label: '5 states',       earned: false },
    { id: 'rink_rat_mom',  emoji: '👧', label: 'Rink Rat Mom',   earned: false },
  ],
  nextBadge: {
    emoji: '👧',
    label: 'Rink Rat Mom',
    description: "Add kids' activity reviews at 2 more rinks to earn it. +200 XP!",
  },
}

export default function ProfilePage() {
  const user = SAMPLE_USER
  const pct = Math.round((user.xp / user.xpToNext) * 100)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ background: 'var(--rr-red)', flexShrink: 0 }}>
        <div style={{ padding: '12px 14px 10px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '2px solid rgba(0,0,0,0.1)' }}>
          <div style={{
            width: 50, height: 50, borderRadius: '50%',
            background: 'var(--rr-yellow)', border: 'var(--rr-outline)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 18, color: 'var(--rr-navy)',
            flexShrink: 0,
          }}>
            {user.initials}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 17, color: '#fff' }}>
              {user.alias}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
              {user.levelTitle} · Level {user.level}
            </div>
          </div>
          <div style={{
            background: 'var(--rr-yellow)', border: 'var(--rr-outline-sm)',
            borderRadius: 999, padding: '4px 10px',
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 11,
            color: 'var(--rr-navy)', boxShadow: 'var(--rr-shadow-sm)',
            display: 'flex', alignItems: 'center', gap: 3,
          }}>
            🔥 {user.streak}
          </div>
        </div>

        <div style={{ padding: '8px 14px 12px', background: 'rgba(0,0,0,0.2)' }}>
          <div style={{ height: 8, background: 'rgba(255,255,255,0.15)', borderRadius: 999, overflow: 'hidden', marginBottom: 4 }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'var(--rr-green)', borderRadius: 999 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-display)' }}>
            <span>{user.xp.toLocaleString()} XP</span>
            <span>Team Captain: {user.xpToNext.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <main style={{ flex: 1, overflowY: 'auto', background: '#EEF4FA', padding: 12 }} className="scroll-y">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
          {[
            { num: user.totalReviews,   label: 'Reviews' },
            { num: user.streak,         label: 'Day streak' },
            { num: user.familiesHelped, label: 'Families helped' },
          ].map(s => (
            <div key={s.label} className="clay-card-sm" style={{ padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 22, color: 'var(--rr-navy)' }}>
                {s.num}
              </div>
              <div className="caption">{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 14, color: 'var(--rr-navy)', marginBottom: 10 }}>
          Your badges
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
          {user.badges.map(badge => (
            <div
              key={badge.id}
              className="clay-card-sm"
              style={{ padding: '8px 4px', textAlign: 'center', opacity: badge.earned ? 1 : 0.3 }}
              title={badge.label}
            >
              <div style={{ fontSize: 20, marginBottom: 4 }}>{badge.emoji}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 9, color: 'var(--rr-navy)', lineHeight: 1.2 }}>
                {badge.label}
              </div>
            </div>
          ))}
        </div>

        <div className="clay-card" style={{ padding: '10px 14px', marginBottom: 12, background: 'var(--rr-ice)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 12, color: 'var(--rr-navy)', marginBottom: 4 }}>
            {user.nextBadge.emoji} Next up: {user.nextBadge.label}
          </div>
          <div className="body-sm" style={{ color: 'rgba(13,42,74,0.65)' }}>
            {user.nextBadge.description}
          </div>
        </div>

        <div className="clay-card" style={{ padding: '10px 14px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 13, color: 'var(--rr-navy)', marginBottom: 5 }}>
            You helped {user.familiesHelped} families this week
          </div>
          <div className="body-sm" style={{ color: 'rgba(13,42,74,0.65)' }}>
            Your reviews answered questions at Newington, McKendree, and Smithfield. Real families. Real answers.
          </div>
        </div>
      </main>

      <BottomBanner />
    </div>
  )
}
