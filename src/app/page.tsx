'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { TabBar } from '@/components/layout/TabBar'
import { TJ, TJSpeech } from '@/components/tj/TJ'

interface RinkResult {
  rink_id?: string
  id?: string
  rink_name?: string
  name?: string
  city: string
  state: string
  total_reviews?: number
  review_count?: number
  confidence_tier?: string
}

export default function HomePage() {
  const [query, setQuery] = useState('')
  const [rinks, setRinks] = useState<RinkResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRinks(query)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  async function fetchRinks(searchQuery: string) {
    setLoading(true)
    try {
      const url = searchQuery
        ? `/api/rinks/search?q=${encodeURIComponent(searchQuery)}`
        : `/api/rinks/search`
      const res = await fetch(url)
      const data = await res.json()
      setRinks(data.rinks || [])
    } catch {
      setRinks([])
    } finally {
      setLoading(false)
    }
  }

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
          {query ? 'Search results' : 'Most reviewed rinks'}
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: 20, color: 'rgba(13,42,74,0.4)', fontSize: 12 }}>
            Loading rinks...
          </div>
        )}

        {!loading && rinks.length === 0 && (
          <div style={{ textAlign: 'center', padding: 20, color: 'rgba(13,42,74,0.4)', fontSize: 12 }}>
            No rinks found. Try a different search.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 16 }}>
          {rinks.map(rink => (
            <RinkCard key={rink.rink_id || rink.id} rink={rink} />
          ))}
        </div>
      </main>

      <TabBar />
    </div>
  )
}

function RinkCard({ rink }: { rink: RinkResult }) {
  const id = rink.rink_id || rink.id
  const name = rink.rink_name || rink.name
  const reviewCount = rink.total_reviews ?? rink.review_count ?? 0
  const tier = (rink.confidence_tier || 'NO_DATA').toLowerCase()

  const tierLabels: Record<string, string> = {
    trusted: 'Trusted',
    established: 'Established',
    emerging: 'Emerging',
    single_voice: '1 reviewer',
    no_data: 'No reviews',
  }

  const tierClass: Record<string, string> = {
    trusted: 'trusted',
    established: 'trusted',
    emerging: 'emerging',
    single_voice: 'single',
    no_data: 'nodata',
  }

  return (
    <Link href={`/rink/${id}`} style={{ textDecoration: 'none' }}>
      <div className="clay-card" style={{ padding: '10px 12px', cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 14, color: 'var(--rr-navy)' }}>
            {name}
          </div>
          <span className={`tier-chip tier-chip--${tierClass[tier] || 'nodata'}`}>
            {tierLabels[tier] || 'No reviews'}
          </span>
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(13,42,74,0.5)' }}>
          {rink.city}, {rink.state} · {reviewCount} reviews
        </div>
      </div>
    </Link>
  )
}
