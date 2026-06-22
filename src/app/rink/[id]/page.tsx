'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { TabBar } from '@/components/layout/TabBar'
import { TJ } from '@/components/tj/TJ'

interface RinkData {
  id: string
  name: string
  address?: string
  city: string
  state: string
  phone?: string
  website?: string
  sheets?: number
}

interface StatsData {
  total_reviews: number
  confidence_tier: string
  rr_unique_reviewers?: number
}

export default function RinkProfilePage() {
  const params = useParams()
  const id = params?.id as string

  const [rink, setRink] = useState<RinkData | null>(null)
  const [stats, setStats] = useState<StatsData | null>(null)
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({})
  const [recentReviews, setRecentReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showContactModal, setShowContactModal] = useState(false)

  useEffect(() => {
    if (!id) return
    fetch('/api/rink/' + id)
      .then(function(res) {
        if (!res.ok) throw new Error('not found')
        return res.json()
      })
      .then(function(data) {
        setRink(data.rink)
        setStats(data.stats)
        setCategoryCounts(data.categoryCounts || {})
        setRecentReviews(data.recentReviews || [])
      })
      .catch(function() { setNotFound(true) })
      .finally(function() { setLoading(false) })
  }, [id])

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <TopBar showBack backHref="/" title="Loading..." />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(13,42,74,0.4)' }}>
          Loading rink...
        </div>
      </div>
    )
  }

  if (notFound || !rink) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <TopBar showBack backHref="/" title="Not found" />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(13,42,74,0.4)', padding: 20, textAlign: 'center' }}>
          We could not find that rink. It may have been removed or the link is incorrect.
        </div>
      </div>
    )
  }

  const tier = (stats && stats.confidence_tier ? stats.confidence_tier : 'NO_DATA').toLowerCase()
  const tierClass: Record<string, string> = {
    trusted: 'trusted',
    established: 'trusted',
    emerging: 'emerging',
    single_voice: 'single',
    no_data: 'nodata',
  }
  const tierLabel: Record<string, string> = {
    trusted: 'Trusted',
    established: 'Established',
    emerging: 'Emerging',
    single_voice: '1 reviewer',
    no_data: 'No reviews yet',
  }

  const categories = Object.entries(categoryCounts).sort(function(a, b) { return b[1] - a[1] })
  const hasContactInfo = Boolean(rink.phone) || Boolean(rink.website)
  const totalReviews = stats && stats.total_reviews ? stats.total_reviews : 0
  const tierKey = tierClass[tier] || 'nodata'
  const tierText = tierLabel[tier] || 'No reviews yet'
  const mapsQuery = encodeURIComponent(rink.name + ' ' + rink.city + ' ' + rink.state)
  const mapsUrl = 'https://www.google.com/maps/search/?api=1' + String.fromCharCode(38) + 'query=' + mapsQuery

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, position: 'relative' }}>
      <TopBar
        showBack={true}
        backHref="/"
        title=""
        rightAction={
          <button
            aria-label="Share this rink"
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.18)',
              border: 'none',
              cursor: 'pointer',
              color: '#fff',
              fontSize: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {String.fromCharCode(8599)}
          </button>
        }
      />

      <main style={{ flex: 1, overflowY: 'auto' }} className="scroll-y">
        <div style={{ background: 'var(--rr-navy)', padding: '14px 14px 12px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 20, color: '#fff', marginBottom: 3 }}>
            {rink.name}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 10 }}>
            {rink.address ? rink.address + ' - ' : ''}{rink.city}, {rink.state}{rink.sheets ? ' - ' + rink.sheets + ' sheets' : ''}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <span className={'tier-chip tier-chip--' + tierKey}>
              {totalReviews} reviews - {tierText}
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: '10px 12px', background: 'var(--rr-warm)', borderBottom: 'var(--rr-outline)' }}>
          <button
            onClick={function() { setShowContactModal(true) }}
            disabled={!hasContactInfo}
            style={{
              background: 'var(--rr-warm)',
              border: 'var(--rr-outline)',
              borderRadius: 10,
              boxShadow: 'var(--rr-shadow-sm)',
              padding: '8px 4px',
              textAlign: 'center',
              cursor: hasContactInfo ? 'pointer' : 'default',
              opacity: hasContactInfo ? 1 : 0.4,
            }}
          >
            <div style={{ fontSize: 18, marginBottom: 3 }}>Contact</div>
          </button>
          <a
            href={mapsUrl}
          
            target="_blank"
            rel="noopener noreferrer"
            style={{ background: 'var(--rr-warm)', border: 'var(--rr-outline)', borderRadius: 10, boxShadow: 'var(--rr-shadow-sm)', padding: '8px 4px', textAlign: 'center', textDecoration: 'none', display: 'block' }}
          >
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 10, color: 'var(--rr-navy)' }}>Directions</div>
          </a>

          <Link
            href={'/nearby?rink=' + rink.id}
            style={{ background: 'var(--rr-warm)', border: 'var(--rr-outline)', borderRadius: 10, boxShadow: 'var(--rr-shadow-sm)', padding: '8px 4px', textAlign: 'center', textDecoration: 'none', display: 'block' }}
          >
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 10, color: 'var(--rr-navy)' }}>Nearby</div>
          </Link>
        </div>

        <div style={{ background: '#EEF4FA', padding: '12px 12px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 14, color: 'var(--rr-navy)', marginBottom: 10 }}>
            Categories with reviews
          </div>

          {categories.length === 0 ? (
            <div className="clay-card" style={{ padding: '14px', textAlign: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: 'rgba(13,42,74,0.5)' }}>
                No reviews yet for this rink. Be the first!
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              {categories.map(function(entry) {
                var cat = entry[0]
                var count = entry[1]
                return (
                  <div key={cat} className="clay-card-sm" style={{ padding: '10px 10px 8px' }}>
                    <div className="label" style={{ marginBottom: 4, color: 'rgba(13,42,74,0.5)' }}>
                      {cat}
                    </div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 18 }}>
                      {count} {count !== 1 ? 'reviews' : 'review'}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <Link href={'/chat?rink=' + rink.id} style={{ textDecoration: 'none', display: 'block', marginBottom: 12 }}>
            <div style={{ background: 'var(--rr-warm)', border: 'var(--rr-outline)', borderRadius: 'var(--rr-radius)', boxShadow: 'var(--rr-shadow)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <TJ state="idle" size="sm" />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 13, color: 'var(--rr-navy)', marginBottom: 2 }}>
                  Ask TJ anything about this rink
                </div>
                <div style={{ fontSize: 10, color: 'rgba(13,42,74,0.5)' }}>
                  Is there a girls locker room? How cold is it?
                </div>
              </div>
            </div>
          </Link>

          <Link href={'/review?rink=' + rink.id} style={{ textDecoration: 'none', display: 'block', marginBottom: 16 }}>
            <div className="clay-btn clay-btn-primary" style={{ width: '100%', padding: '13px', borderRadius: 'var(--rr-radius)', fontSize: 14 }}>
              Add your review - plus 125 XP
            </div>
          </Link>

          {recentReviews.length > 0 && (
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 14, color: 'var(--rr-navy)', marginBottom: 10 }}>
                Recent reviews
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 16 }}>
                {recentReviews.map(function(r, i) {
                  return (
                    <div key={i} className="clay-card-sm" style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 11, color: 'var(--rr-navy)' }}>
                          {r.category}
                        </span>
                        <span style={{ fontSize: 10, color: 'rgba(13,42,74,0.4)' }}>
                          {r.source === 'ftloh' ? 'FTLOH' : 'Rink Rater'}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(13,42,74,0.75)', lineHeight: 1.5 }}>
                        {r.comment}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      <TabBar />

      {showContactModal && (
        <div
          onClick={function() { setShowContactModal(false) }}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(13,42,74,0.5)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            zIndex: 200,
          }}
        >
          <div
            onClick={function(e) { e.stopPropagation() }}
            style={{
              background: 'var(--rr-warm)',
              border: 'var(--rr-outline)',
              borderRadius: '16px 16px 0 0',
              boxShadow: '0 -4px 0 var(--rr-navy)',
              padding: '16px 16px 28px',
              width: '100%',
              maxWidth: 430,
            }}
          >
            <div style={{ width: 36, height: 4, background: 'rgba(13,42,74,0.2)', borderRadius: 2, margin: '0 auto 14px' }} />
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 16, color: 'var(--rr-navy)', marginBottom: 14, textAlign: 'center' }}>
              Contact {rink.name}
            </div>

            {rink.phone && (
              
          <a
                href={'tel:+1' + rink.phone.replace(/[^0-9]/g, '')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: '#fff',
                  border: 'var(--rr-outline-sm)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  marginBottom: 8,
                  textDecoration: 'none',
                }}
              >
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 12, color: 'var(--rr-navy)' }}>Call</div>
                  <div style={{ fontSize: 12, color: 'rgba(13,42,74,0.6)' }}>{rink.phone}</div>
                </div>
              </a>
            )}

            {rink.website && (
                <a
              
                href={rink.website}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: '#fff',
                  border: 'var(--rr-outline-sm)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  marginBottom: 8,
                  textDecoration: 'none',
                }}
              >
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 12, color: 'var(--rr-navy)' }}>Website</div>
                  <div style={{ fontSize: 12, color: 'rgba(13,42,74,0.6)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rink.website}</div>
                </div>
              </a>
            )}

            {!hasContactInfo && (
              <div style={{ fontSize: 12, color: 'rgba(13,42,74,0.5)', textAlign: 'center', padding: 10 }}>
                No contact info available for this rink yet.
              </div>
            )}

            <button
              onClick={function() { setShowContactModal(false) }}
              className="clay-btn clay-btn-secondary"
              style={{ width: '100%', marginTop: 4 }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
