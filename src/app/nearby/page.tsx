'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { TJ } from '@/components/tj/TJ'
import { useLocation } from '@/lib/useLocation'

interface NearbyPlace {
  name: string
  vicinity: string
  rating?: number
  distanceMiles?: number
  mapsUrl: string
}

function NearbyPageContent() {
  const searchParams = useSearchParams()
  const rinkId = searchParams.get('rink') || ''
  const { lat, lng, status, error, requestLocation } = useLocation()
  const [places, setPlaces] = useState<Record<string, NearbyPlace[]>>({})
  const [loadingPlaces, setLoadingPlaces] = useState(false)
  const [rinkLat, setRinkLat] = useState<number | null>(null)
  const [rinkLng, setRinkLng] = useState<number | null>(null)
  const [rinkName, setRinkName] = useState('')

  // Pull the rink's own coordinates as a fallback if user declines location
  useEffect(() => {
    if (!rinkId) return
    fetch(`/api/rink/${rinkId}`)
      .then(res => res.json())
      .then(data => {
        if (data.rink) {
          setRinkLat(data.rink.lat)
          setRinkLng(data.rink.long)
          setRinkName(data.rink.name)
        }
      })
      .catch(() => {})
  }, [rinkId])

  // Once we have coordinates from either source, fetch nearby places
  useEffect(() => {
    const useLat = lat ?? rinkLat
    const useLng = lng ?? rinkLng
    if (!useLat || !useLng) return

    setLoadingPlaces(true)
    fetch(`/api/nearby?lat=${useLat}&lng=${useLng}`)
      .then(res => res.json())
      .then(data => setPlaces(data.places || {}))
      .catch(() => setPlaces({}))
      .finally(() => setLoadingPlaces(false))
  }, [lat, lng, rinkLat, rinkLng])

  const hasCoords = (lat && lng) || (rinkLat && rinkLng)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <TopBar showBack backHref={rinkId ? `/rink/${rinkId}` : '/'} title="What's nearby" />

      <main style={{ flex: 1, overflowY: 'auto', background: '#EEF4FA', padding: '12px 12px 0' }} className="scroll-y">

        {!hasCoords && status === 'idle' && (
          <div className="clay-card" style={{ padding: '16px', marginBottom: 14, textAlign: 'center' }}>
            <TJ state="idle" size="lg" />
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 15, color: 'var(--rr-navy)', margin: '10px 0 6px' }}>
              Find food, coffee, and more nearby
            </div>
            <div style={{ fontSize: 12, color: 'rgba(13,42,74,0.6)', marginBottom: 14, lineHeight: 1.5 }}>
              Share your location to see what's close to {rinkName || 'this rink'} — restaurants, coffee shops, and hotels. We only use this to show nearby spots, nothing else.
            </div>
            <button onClick={requestLocation} className="clay-btn clay-btn-primary" style={{ width: '100%' }}>
              📍 Share my location
            </button>
            <div style={{ fontSize: 10, color: 'rgba(13,42,74,0.4)', marginTop: 8 }}>
              Or we'll just show what's near the rink itself
            </div>
          </div>
        )}

        {status === 'requesting' && (
          <div style={{ textAlign: 'center', padding: 30, color: 'rgba(13,42,74,0.4)', fontSize: 12 }}>
            Getting your location...
          </div>
        )}

        {status === 'denied' && error && (
          <div className="clay-card" style={{ padding: '14px', marginBottom: 14, background: 'var(--rr-ice)' }}>
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

        {!loadingPlaces && hasCoords && Object.keys(places).length === 0 && (
          <div style={{ textAlign: 'center', padding: 30, color: 'rgba(13,42,74,0.4)', fontSize: 12 }}>
            No nearby places found right now.
          </div>
        )}

        {Object.entries(places).map(([category, items]) => (
          <div key={category} style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 13, color: 'var(--rr-navy)', marginBottom: 8, textTransform: 'capitalize' }}>
              {category}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((place, i) => (
                <a key={i} href={place.mapsUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                  <div className="clay-card-sm" style={{ padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 12, color: 'var(--rr-navy)' }}>
                        {place.name}
                      </div>
                      <div style={{ fontSize: 10, color: 'rgba(13,42,74,0.5)' }}>
                        {place.vicinity}
                      </div>
                    </div>
                    {place.distanceMiles && (
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(13,42,74,0.4)', whiteSpace: 'nowrap' }}>
                        {place.distanceMiles.toFixed(1)} mi
                      </div>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}

export default function NearbyPage() {
  return (
    <Suspense fallback={<div style={{ padding: 20, textAlign: 'center', color: 'rgba(13,42,74,0.4)' }}>Loading...</div>}>
      <NearbyPageContent />
    </Suspense>
  )
}