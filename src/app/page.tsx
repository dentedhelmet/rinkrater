'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { PageShell } from '@/components/layout/PageShell'
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

const TRENDING_QUESTIONS = [
  'Is Newington cold?',
  'Do they sharpen skates?',
  'Best seating?',
]

const THUMBNAIL_COUNT = 14

function thumbnailForRink(id: string) {
  var hash = 0
  for (var i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % THUMBNAIL_COUNT
  }
  var num = Math.abs(hash % THUMBNAIL_COUNT) + 1
  return '/rink-thumbnails/rr_arena' + num + '.png'
}

export default function HomePage() {
  const [query, setQuery] = useState('')
  const [rinks, setRinks] = useState<RinkResult[]>([])
  const [loading, setLoading] = useState(true)
  const [showRinkList, setShowRinkList] = useState(false)

  useEffect(function() {
    const timer = setTimeout(function() {
      fetchRinks(query)
    }, 300)
    return function() { clearTimeout(timer) }
  }, [query])

  async function fetchRinks(searchQuery: string) {
    setLoading(true)
    try {
      const url = searchQuery
        ? '/api/rinks/search?q=' + encodeURIComponent(searchQuery)
        : '/api/rinks/search'
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
    <PageShell topBar={<TopBar />} tabBar={<TabBar />}>
      <div className="home-grid" style={{ background: '#EEF4FA' }}>

          <div className="home-main-col">
            <div style={{ marginBottom: 14 }}>
              <TJSpeech state="idle" size="md">
                Ask me about any rink in North America - or search by name!
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
                marginBottom: 14,
              }}
            >
              <span style={{ fontSize: 18, color: 'rgba(13,42,74,0.35)' }} aria-hidden="true">{'\u2315'}</span>
              <input
                type="search"
                placeholder="Search for a rink, city, or state..."
                value={query}
                onChange={function(e) { setQuery(e.target.value); setShowRinkList(true) }}
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
                {'\u{1F3A4}'}
              </button>
            </div>

            <button
              onClick={function() { setShowRinkList(!showRinkList) }}
              style={{
                width: '100%',
                background: 'var(--rr-warm)',
                border: 'var(--rr-outline)',
                borderRadius: 'var(--rr-radius)',
                boxShadow: 'var(--rr-shadow)',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                marginBottom: showRinkList ? 8 : 14,
              }}
            >
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 14, color: 'var(--rr-navy)' }}>
                {query ? 'Search results' : 'Most reviewed rinks'}
              </span>
              <span style={{ fontSize: 14, color: 'var(--rr-navy)', transform: showRinkList ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                {'\u25BC'}
              </span>
            </button>

            {showRinkList && (
              <div style={{ height: 430, overflowY: 'auto', marginBottom: 14, position: 'relative' }} className="scroll-y">
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

                <div className="rink-grid">
                  {rinks.map(function(rink) {
                    return <RinkCard key={rink.rink_id || rink.id} rink={rink} />
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="home-side-col">
            <div className="clay-card" style={{ padding: '14px', marginBottom: 14 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 13, color: 'var(--rr-navy)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{'\u{1F525}'}</span> Trending Questions
              </div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                {TRENDING_QUESTIONS.map(function(q, i) {
                  return (
                    <li key={i} style={{ fontSize: 12, color: 'var(--rr-navy)', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                      <span style={{ color: 'var(--rr-red)' }}>{'\u2022'}</span>
                      <span>{q}</span>
                    </li>
                  )
                })}
              </ul>
              <button
                style={{
                  width: '100%',
                  background: 'var(--rr-ice)',
                  border: 'var(--rr-outline-sm)',
                  borderRadius: 999,
                  padding: '8px 12px',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: 11,
                  color: 'var(--rr-navy)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                }}
              >
                More trending questions {'\u2192'}
              </button>
            </div>

            <div className="clay-card" style={{ padding: '14px', marginBottom: 14 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 13, color: 'var(--rr-navy)', marginBottom: 10 }}>
                Find a Rink Near You
              </div>
              <div
                style={{
                  width: '100%',
                  height: 140,
                  background: 'var(--rr-ice)',
                  border: 'var(--rr-outline-sm)',
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 10,
                  color: 'rgba(13,42,74,0.3)',
                  fontSize: 12,
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                }}
              >
                Map coming soon
              </div>
              <button
                disabled
                style={{
                  width: '100%',
                  background: 'var(--rr-warm)',
                  border: 'var(--rr-outline-sm)',
                  borderRadius: 999,
                  padding: '8px 12px',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: 11,
                  color: 'rgba(13,42,74,0.4)',
                  cursor: 'default',
                }}
              >
                View map
              </button>
            </div>

            <div className="clay-card" style={{ padding: '14px', marginBottom: 14, opacity: 0.5 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 13, color: 'var(--rr-navy)' }}>
                Featured Partners
              </div>
              <div style={{ fontSize: 11, color: 'rgba(13,42,74,0.4)', marginTop: 6 }}>
                Coming soon
                </div>
              </div>
            </div>
        </div>
        <style jsx>{`
          .home-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 14px;
            padding-bottom: 16px;
          }
          .rink-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 8px;
          }
          @media (min-width: 768px) {
            .home-grid {
              grid-template-columns: 2fr 1fr;
              align-items: start;
            }
            .rink-grid {
              grid-template-columns: 1fr 1fr;
            }
          }
        `}</style>
      </PageShell>
  )
}

function RinkCard({ rink }: { rink: RinkResult }) {
  const id = rink.rink_id || rink.id || ''
  const name = rink.rink_name || rink.name
  const reviewCount = rink.total_reviews !== undefined ? rink.total_reviews : (rink.review_count !== undefined ? rink.review_count : 0)
  const tier = (rink.confidence_tier || 'NO_DATA').toLowerCase()
  const thumbnail = thumbnailForRink(id)

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
    <Link href={'/rink/' + id} style={{ textDecoration: 'none' }}>
      <div className="clay-card" style={{ padding: '10px 12px', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center' }}>
        <img
          src={thumbnail}
          alt=""
          style={{ width: 48, height: 48, borderRadius: 8, border: 'var(--rr-outline-sm)', objectFit: 'cover', flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 13, color: 'var(--rr-navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name}
            </div>
            <span className={'tier-chip tier-chip--' + (tierClass[tier] || 'nodata')} style={{ flexShrink: 0 }}>
              {tierLabels[tier] || 'No reviews'}
            </span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(13,42,74,0.5)' }}>
            {rink.city}, {rink.state} - {reviewCount} reviews
          </div>
        </div>
      </div>
    </Link>
  )
}
