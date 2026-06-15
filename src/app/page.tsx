'use client'

import { useState } from 'react'
import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { TabBar } from '@/components/layout/TabBar'
import { TJ, TJSpeech } from '@/components/tj/TJ'

const NEARBY_RINKS = [
  {
    id: 'newington-ct',
    name: 'Newington Arena',
    city: 'Newington', state: 'CT',
    distance: '2.1 mi',
    tier: 'trusted' as const,
    reviewCount: 29,
    tags: [
      { label: 'Sharpening', color: 'green' },
      { label: 'WiFi', color: 'blue' },
      { label: 'Cold', color: 'yellow' },
      { label: 'Pro shop', color: 'green' },
    ],
  },
  {
    id: 'hallenborg-ma',
    name: 'Hallenborg Ice Rink',
    city: 'Billerica', state: 'MA',
    distance: '18 mi',
    tier: 'emerging' as const,
    reviewCount: 3,
    tags: [
      { label: 'Concessions', color: 'green' },
      { label: 'Small lot', color: 'yellow' },
    ],
  },
  {
    id: 'smithfield-ri',
    name: 'Smithfield Municipal',
    city: 'Smithfield', state: 'RI',
    distance: '31 mi',
    tier: 'single' as const,
    reviewCount: 1,
    tags: [
      { label: 'Great area', color: 'green' },
      { label: 'LiveBarn', color: 'blue' },
    ],
  },
]

export default function HomePage() {
  const [query, setQuery] = useState('')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <TopBar />
      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          background: '#EEF4FA',
          padding: '12px 12px 0',
        }}
      >
        <div style={{ marginBottom: 14 }}>
          <TJSpeech state="idle" size="md">
            Ask me about any rink in North America — or search by name!
          </TJSpeech>
        </div>

        <div
          style={{
            background: 'var(--rr-warm)',
            border: 'var(--rr-outline)',
            borderRadius: 'var(--rr-radius)',
            boxShadow: 'var(--rr-shadow)',
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: 18, color: 'rgba(13,42,74,0.35)' }} aria-hidden="true">⌕</span>
          <input
            type="search"
            placeholder="Rink name, city, or state..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              fontSize: 13,
              fontFamily: 'var(--font-body)',
              color: 'var(--rr-navy)',
              outline: 'none',
              background: 'transparent',
            }}
            aria-label="Search for a rink"
          />
          <button
            aria-label="Voice search"
            style={{
              width: 32, height: 32,
              borderRadius: '50%',
              background: 'var(--rr-red)',
              border: 'var(--rr-outline-sm)',
              boxShadow: 'var(--rr-shadow-sm)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
              color: '#fff', fontSize: 15,
            }}
          >
            🎤
          </button>
        </div>

        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 14,
            color: 'var(--rr-navy)',
            marginBottom: 10,
          }}
        >
          Nearby rinks
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 16 }}>
          {NEARBY_RINKS.map(rink => (
            <RinkCard key={rink.id} rink={rink} />
          ))}
        </div>
      </main>
      <TabBar />
    </div>
  )
}

function RinkCard({ rink }: { rink: typeof NEARBY_RINKS[0] }) {
  return (
    <Link href={`/rink/${rink.id}`} style={{ textDecoration: 'none' }}>
      <div className="clay-card" style={{ padding: '10px 12px', cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 14, color: 'var(--rr-navy)' }}>
            {rink.name}
          </div>
          <span className={`tier-chip tier-chip--${rink.tier}`}>
            {rink.tier === 'trusted' ? 'Trusted' : rink.tier === 'emerging' ? 'Emerging' : '1 review'}
          </span>
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(13,42,74,0.5)', marginBottom: 8 }}>
          {rink.city}, {rink.state} · {rink.distance}
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {rink.tags.map(tag => (
            <span key={tag.label} className={`tag-pill tag-pill--${tag.color}`}>
              {tag.label}
            </span>
          ))}
        </div>
      </div>
    </Link>
  )
}
