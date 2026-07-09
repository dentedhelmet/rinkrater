'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { TJ } from '@/components/tj/TJ'
import { useLocation } from '@/lib/useLocation'

// ─── Types ─────────────────────────────────────────────────────────────────────
interface NearbyPlace {
  name:          string
  vicinity:      string
  rating?:       number | null
  distanceMiles?: number | null
  mapsUrl:       string
  photoUrl?:     string | null
}

interface NearbySection {
  key:         string
  displayName: string
  emoji:       string
  places:      NearbyPlace[]
}

// ─── Star rating ───────────────────────────────────────────────────────────────
function StarRating({ rating }: { rating: number }) {
  const full  = Math.floor(rating)
  const half  = rating % 1 >= 0.5 ? 1 : 0
  const empty = 5 - full - half
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      <span style={{ fontSize: 10, letterSpacing: 1 }}>
        {'★'.repeat(full)}{'½'.repeat(half)}{'☆'.repeat(empty)}
      </span>
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 10, color: 'rgba(13,42,74,0.6)' }}>
        {rating.toFixed(1)}
      </span>
    </div>
  )
}

// ─── Place card ────────────────────────────────────────────────────────────────
function PlaceCard({ place, emoji }: { place: NearbyPlace; emoji: string }) {
  return (
    <a href={place.mapsUrl} target="_blank" rel="noopener noreferrer"
      style={{ textDecoration: 'none', display: 'block' }}>
      <div className="clay-card-sm" style={{
        padding:    0,
        overflow:   'hidden',
        display:    'flex',
        alignItems: 'stretch',
        background: 'var(--rr-warm)',
      }}>
        {/* Photo or emoji fallback */}
        <div style={{
          width:      80,
          minWidth:   80,
          background: 'var(--rr-ice)',
          display:    'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow:   'hidden',
          flexShrink: 0,
        }}>
          {place.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={place.photoUrl}
              alt={place.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span style={{ fontSize: 28 }}>{emoji}</span>
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, padding: '10px 10px', overflow: 'hidden' }}>
          <div style={{
            fontFamily:   'var(--font-display)',
            fontWeight:   800,
            fontSize:     13,
            color:        'var(--rr-navy)',
            marginBottom: 2,
            whiteSpace:   'nowrap',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
          }}>
            {place.name}
          </div>
          <div style={{
            fontSize:     10,
            color:        'rgba(13,42,74,0.45)',
            marginBottom: 5,
            whiteSpace:   'nowrap',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
          }}>
            {place.vicinity}
          </div>
          {place.rating ? <StarRating rating={place.rating} /> : null}
        </div>

        {/* Distance */}
        {place.distanceMiles != null && (
          <div style={{
            padding:    '10px 10px',
            display:    'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 900,
              fontSize:   13,
              color:      'var(--rr-navy)',
            }}>
              {place.distanceMiles.toFixed(1)}
            </span>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize:   9,
              color:      'rgba(13,42,74,0.4)',
            }}>
              mi
            </span>
          </div>
        )}
      </div>
    </a>
  )
}

// ─── Page content ──────────────────────────────────────────────────────────────
function NearbyPageContent() {
  const searchParams = useSearchParams()
  const rinkId = searchParams.get('rink') || ''
  const { lat, lng, status, error, requestLocation } = useLocation()
  const [sections,      setSections]      = useState<NearbySection[]>([])
  const [loadingPlaces, setLoadingPlaces] = useState(false)
  const [rinkLat,       setRinkLat]       = useState<number | null>(null)
  const [rinkLng,       setRinkLng]       = useState<number | null>(null)
  const [rinkName,      setRinkName]      = useState('')

  // Pull rink coords as fallback
  useEffect(() => {
    if (!rinkId) return
    fetch(`/api/rink/${rinkId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.rink) {
          setRinkLat(data.rink.lat)
          setRinkLng(data.rink.long)
          setRinkName(data.rink.name)
        }
      })
      .catch(() => {})
  }, [rinkId])

  // Fetch nearby when coords are ready
  useEffect(() => {
    // Wait for user to grant or deny before falling back to rink coords
    const userDecided = status === 'granted' || status === 'denied' || status === 'unsupported'
    const useLat = status === 'granted' ? lat : userDecided ? rinkLat : null
    const useLng = status === 'granted' ? lng : userDecided ? rinkLng : null
    if (!useLat || !useLng) return

    setLoadingPlaces(true)
    fetch(`/api/nearby?lat=${useLat}&lng=${useLng}`)
      .then((r) => r.json())
      .then((data) => setSections(data.sections || []))
      .catch(() => setSections([]))
      .finally(() => setLoadingPlaces(false))
  }, [lat, lng, rinkLat, rinkLng])

  const hasCoords = !!(lat && lng) || !!(rinkLat && rinkLng)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <TopBar showBack backHref={rinkId ? `/rink/${rinkId}` : '/'} title="What's nearby" />

      <main style={{ flex: 1, overflowY: 'auto', background: '#EEF4FA', padding: '12px 12px 0' }}
        className="scroll-y">

        {/* ── Location prompt ── */}
        {!hasCoords && status === 'idle' && (
          <div className="clay-card" style={{ padding: 16, marginBottom: 14, textAlign: 'center' }}>
            <TJ state="idle" size="lg" />
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 15, color: 'var(--rr-navy)', margin: '10px 0 6px' }}>
              Find food, coffee & more nearby
            </div>
            <div style={{ fontSize: 12, color: 'rgba(13,42,74,0.6)', marginBottom: 14, lineHeight: 1.5 }}>
              Share your location to see what's close to {rinkName || 'this rink'} — restaurants, coffee, hotels and more. Only used to show nearby spots.
            </div>
            <button onClick={requestLocation} className="clay-btn clay-btn-primary" style={{ width: '100%' }}>
              📍 Share my location
            </button>
            <div style={{ fontSize: 10, color: 'rgba(13,42,74,0.4)', marginTop: 8 }}>
              Or we'll show what's near the rink itself
            </div>
          </div>
        )}

        {status === 'requesting' && (
          <div style={{ textAlign: 'center', padding: 30, color: 'rgba(13,42,74,0.4)', fontSize: 12 }}>
            Getting your location...
          </div>
        )}

        {status === 'denied' && error && (
          <div className="clay-card" style={{ padding: 14, marginBottom: 14, background: 'var(--rr-ice)' }}>
            <div style={{ fontSize: 12, color: 'var(--rr-navy)', lineHeight: 1.5 }}>
              {error} Showing nearby spots based on the rink's location instead.
            </div>
          </div>
        )}

        {loadingPlaces && (
          <div style={{ textAlign: 'center', padding: 30, color: 'rgba(13,42,74,0.4)', fontSize: 12 }}>
            Finding nearby spots...
          </div>
        )}

        {!loadingPlaces && hasCoords && sections.length === 0 && (
          <div style={{ textAlign: 'center', padding: 30, color: 'rgba(13,42,74,0.4)', fontSize: 12 }}>
            No nearby places found right now.
          </div>
        )}

        {/* ── Sections ── */}
        {sections.map((section) => (
          <div key={section.key} style={{ marginBottom: 20 }}>
            {/* Category header */}
            <div style={{
              display:      'flex',
              alignItems:   'center',
              gap:          6,
              marginBottom: 8,
            }}>
              <span style={{ fontSize: 16 }}>{section.emoji}</span>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 900,
                fontSize:   14,
                color:      'var(--rr-navy)',
              }}>
                {section.displayName}
              </span>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize:   10,
                color:      'rgba(13,42,74,0.35)',
              }}>
                {section.places.length} nearby
              </span>
            </div>

            {/* Place cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {section.places.map((place, i) => (
                <PlaceCard key={i} place={place} emoji={section.emoji} />
              ))}
            </div>
          </div>
        ))}

        <div style={{ height: 24 }} />
      </main>
    </div>
  )
}

export default function NearbyPage() {
  return (
    <Suspense fallback={
      <div style={{ padding: 20, textAlign: 'center', color: 'rgba(13,42,74,0.4)' }}>
        Loading...
      </div>
    }>
      <NearbyPageContent />
    </Suspense>
  )
}
