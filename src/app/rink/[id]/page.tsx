'use client'

import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { TabBar } from '@/components/layout/TabBar'
import { TJ } from '@/components/tj/TJ'

const SAMPLE_RINK = {
  id: 'newington-ct',
  name: 'Newington Arena',
  address: '300 Alumni Rd',
  city: 'Newington', state: 'CT', zip: '06111',
  phone: '8606657825',
  phoneDisplay: '(860) 665-7825',
  website: 'http://www.newingtonarena.com',
  sheets: 2,
  tier: 'trusted',
  reviewCount: 29,
  totalReviews: 74,
  aiSummary: 'Great facility with reliable sharpening on-site — pay at the register first. Runs cold, dress the kids in layers. Pro shop is well-stocked for basics.',
  categories: [
    { key: 'pro_shop',    label: 'Pro shop',    score: 4.1, pct: 82, tier: 'great', display: '', price: '' },
    { key: 'temperature', label: 'Temperature', score: 2.9, pct: 58, tier: 'poor',  display: 'Very cold', price: '' },
    { key: 'sharpening',  label: 'Sharpening',  score: 3.8, pct: 76, tier: 'ok',   display: '', price: '$7-8' },
    { key: 'parking',     label: 'Parking',     score: 4.6, pct: 92, tier: 'great', display: '', price: '' },
    { key: 'concessions', label: 'Concessions', score: 4.2, pct: 84, tier: 'great', display: '', price: '' },
    { key: 'bathrooms',   label: 'Bathrooms',   score: 4.5, pct: 90, tier: 'great', display: '', price: '' },
  ],
}

const actionButtonStyle = {
  background: 'var(--rr-warm)',
  border: 'var(--rr-outline)',
  borderRadius: 10,
  boxShadow: 'var(--rr-shadow-sm)',
  padding: '8px 4px',
  textAlign: 'center' as const,
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'block',
}

export default function RinkProfilePage({ params }: { params: { id: string } }) {
  const rink = SAMPLE_RINK

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <TopBar
        showBack
        backHref="/"
        title=""
        rightAction={
          <button
            aria-label="Share this rink"
            style={{
              width: 30, height: 30,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.18)',
              border: 'none',
              cursor: 'pointer',
              color: '#fff',
              fontSize: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ↗
          </button>
        }
      />

      <main style={{ flex: 1, overflowY: 'auto' }} className="scroll-y">

        <div style={{ background: 'var(--rr-navy)', padding: '14px 14px 12px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 20, color: '#fff', marginBottom: 3 }}>
            {rink.name}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 10 }}>
            {rink.address} · {rink.city}, {rink.state} · {rink.sheets} sheets
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <span className="tier-chip tier-chip--trusted">{rink.reviewCount} reviewers · Trusted</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: '10px 12px', background: 'var(--rr-warm)', borderBottom: 'var(--rr-outline)' }}>
          <a href="#directions" style={actionButtonStyle}>
            <div style={{ fontSize: 18, marginBottom: 3 }}>📍</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 10, color: 'var(--rr-navy)' }}>Directions</div>
          </a>
          <a href={`tel:+1${rink.phone}`} style={actionButtonStyle}>
            <div style={{ fontSize: 18, marginBottom: 3 }}>📞</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 10, color: 'var(--rr-navy)' }}>{rink.phoneDisplay}</div>
          </a>
          <a href="#nearby" style={actionButtonStyle}>
            <div style={{ fontSize: 18, marginBottom: 3 }}>🍔</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 10, color: 'var(--rr-navy)' }}>Nearby</div>
          </a>
        </div>

        <div style={{ background: '#EEF4FA', padding: '12px 12px' }}>

          <div style={{ background: 'var(--rr-navy)', border: 'var(--rr-outline)', borderRadius: 'var(--rr-radius)', boxShadow: 'var(--rr-shadow)', overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <TJ state="answering" size="sm" />
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  TJ's summary
                </div>
                <div style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 800, color: '#fff' }}>
                  What families are saying
                </div>
              </div>
            </div>
            <div style={{ padding: '10px 14px', fontSize: 12, color: 'rgba(255,255,255,0.88)', lineHeight: 1.6 }}>
              {rink.aiSummary}
            </div>
          </div>

          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 14, color: 'var(--rr-navy)', marginBottom: 10 }}>
            Category scores
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            {rink.categories.map(cat => (
              <div key={cat.key} className="clay-card-sm" style={{ padding: '10px 10px 8px' }}>
                <div className="label" style={{ marginBottom: 4, color: 'rgba(13,42,74,0.5)' }}>
                  {cat.label}
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 20, marginBottom: 5 }}>
                  {cat.display
                    ? <span style={{ fontSize: 13, fontWeight: 700 }}>{cat.display}</span>
                    : cat.price
                    ? <span style={{ fontSize: 14 }}>{cat.price}</span>
                    : cat.score.toFixed(1)
                  }
                </div>
                <div className="score-track">
                  <div className={`score-fill score-fill--${cat.tier}`} style={{ width: `${cat.pct}%` }} />
                </div>
              </div>
            ))}
          </div>

          <Link href={`/chat?rink=${rink.id}`} style={{ textDecoration: 'none', display: 'block', marginBottom: 12 }}>
            <div style={{ background: 'var(--rr-warm)', border: 'var(--rr-outline)', borderRadius: 'var(--rr-radius)', boxShadow: 'var(--rr-shadow)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <TJ state="idle" size="sm" />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 13, color: 'var(--rr-navy)', marginBottom: 2 }}>
                  Ask TJ anything about this rink →
                </div>
                <div style={{ fontSize: 10, color: 'rgba(13,42,74,0.5)' }}>
                  "Is there a girls locker room?" · "How cold is it?"
                </div>
              </div>
            </div>
          </Link>

          <Link href={`/review?rink=${rink.id}`} style={{ textDecoration: 'none', display: 'block' }}>
            <div className="clay-btn clay-btn-primary" style={{ width: '100%', padding: '13px', borderRadius: 'var(--rr-radius)', fontSize: 14 }}>
              ★ Add your review · +125 XP
            </div>
          </Link>

        </div>
      </main>

      <TabBar />
    </div>
  )
}
