export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'

// ─── Category config ───────────────────────────────────────────────────────────
interface CategoryConfig {
  includedTypes: string[]
  radius:        number
  max:           number
  displayName:   string
  emoji:         string
}

// Radius: ~10mi (16000m) across every category.
// Max results per category: 6 — dialed back from an earlier 15, which
// worked but roughly quadrupled outbound photo-fetch calls (one per
// place returned) and meaningfully increased both load time and Google
// API cost for marginal value. 6 lands in the 5-8 range that felt right.
const CATEGORIES: Record<string, CategoryConfig> = {
  food:          { includedTypes: ['restaurant'],                          radius: 16000, max: 6, displayName: 'Food',              emoji: '🍽️' },
  pizza:         { includedTypes: ['pizza_restaurant'],                    radius: 16000, max: 6, displayName: 'Pizza',             emoji: '🍕' },
  fastfood:      { includedTypes: ['fast_food_restaurant'],                radius: 16000, max: 6, displayName: 'Fast Food',         emoji: '🍟' },
  coffee:        { includedTypes: ['cafe'],                                radius: 16000, max: 6, displayName: 'Coffee',            emoji: '☕' },
  bars:          { includedTypes: ['bar'],                                 radius: 16000, max: 6, displayName: 'Bars & Breweries',  emoji: '🍺' },
  dessert:       { includedTypes: ['dessert_shop', 'ice_cream_shop'],      radius: 16000, max: 6, displayName: 'Dessert & Ice Cream', emoji: '🍦' },
  grocery:       { includedTypes: ['grocery_store', 'supermarket'],        radius: 16000, max: 6, displayName: 'Grocery',           emoji: '🛒' },
  sporting:      { includedTypes: ['sporting_goods_store'],                radius: 16000, max: 6, displayName: 'Sporting Goods',    emoji: '🏒' },
  pharmacy:      { includedTypes: ['pharmacy', 'drugstore'],               radius: 16000, max: 6, displayName: 'Pharmacy',          emoji: '💊' },
  gas:           { includedTypes: ['gas_station', 'convenience_store'],    radius: 16000, max: 6, displayName: 'Gas & Convenience', emoji: '⛽' },
  attractions:   { includedTypes: ['tourist_attraction', 'museum', 'amusement_park'], radius: 16000, max: 6, displayName: 'Attractions', emoji: '🎯' },
  entertainment: { includedTypes: ['amusement_center', 'bowling_alley', 'movie_theater'], radius: 16000, max: 6, displayName: 'Entertainment', emoji: '🎮' },
  hotels:        { includedTypes: ['lodging'],                             radius: 16000, max: 6, displayName: 'Hotels',            emoji: '🏨' },
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R    = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a    = Math.sin(dLat / 2) ** 2
              + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

async function fetchPhotoUrl(photoName: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/${photoName}/media?key=${apiKey}&maxWidthPx=400&skipHttpRedirect=true`
    )
    if (!res.ok) return null
    const data = await res.json()
    return (data.photoUri as string) ?? null
  } catch {
    return null
  }
}

async function searchCategory(
  lat: number,
  lng: number,
  config: CategoryConfig,
  apiKey: string
) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type':    'application/json',
      'X-Goog-Api-Key':  apiKey,
      'X-Goog-FieldMask': [
        'places.displayName',
        'places.formattedAddress',
        'places.location',
        'places.rating',
        'places.googleMapsUri',
        'places.photos',
      ].join(','),
    },
    body: JSON.stringify({
      includedTypes:       config.includedTypes,
      maxResultCount:      config.max,
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: config.radius,
        },
      },
    }),
  })

  if (!res.ok) {
    console.error('Places API error:', config.includedTypes, res.status, await res.text())
    return []
  }

  const json  = await res.json()
  const raw   = (json.places ?? []) as any[]

  // Fetch all photo URLs in parallel
  const places = await Promise.all(
    raw.map(async (p) => {
      const photoName = p.photos?.[0]?.name ?? null
      const photoUrl  = photoName ? await fetchPhotoUrl(photoName, apiKey) : null

      return {
        name:          p.displayName?.text ?? 'Unknown',
        vicinity:      p.formattedAddress ?? '',
        rating:        p.rating ?? null,
        mapsUrl:       p.googleMapsUri ?? '#',
        photoUrl,
        distanceMiles: p.location
          ? distanceMiles(lat, lng, p.location.latitude, p.location.longitude)
          : null,
      }
    })
  )

  return places
}

// ─── Route ─────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const lat = parseFloat(req.nextUrl.searchParams.get('lat') || '')
  const lng = parseFloat(req.nextUrl.searchParams.get('lng') || '')

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'Valid lat and lng are required' }, { status: 400 })
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return NextResponse.json({ sections: [], error: 'Nearby search is not configured' })
  }

  // Fetch all categories in parallel
  const entries = Object.entries(CATEGORIES)
  const results = await Promise.all(
    entries.map(async ([key, config]) => {
      try {
        const places = await searchCategory(lat, lng, config, apiKey)
        return { key, displayName: config.displayName, emoji: config.emoji, places }
      } catch (err) {
        console.error('Nearby search failed for', key, err)
        return { key, displayName: config.displayName, emoji: config.emoji, places: [] }
      }
    })
  )

  // Filter out empty sections
  const sections = results.filter((s) => s.places.length > 0)

  return NextResponse.json({ sections })
}
