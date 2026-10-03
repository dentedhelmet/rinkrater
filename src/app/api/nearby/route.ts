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

const CATEGORIES: Record<string, CategoryConfig> = {
  food: {
    includedTypes: [
      'restaurant', 'american_restaurant', 'italian_restaurant', 'mexican_restaurant',
      'chinese_restaurant', 'japanese_restaurant', 'sushi_restaurant', 'thai_restaurant',
      'indian_restaurant', 'korean_restaurant', 'vietnamese_restaurant', 'mediterranean_restaurant',
      'greek_restaurant', 'french_restaurant', 'spanish_restaurant', 'seafood_restaurant',
      'steak_house', 'bar_and_grill', 'buffet_restaurant', 'breakfast_restaurant',
      'brunch_restaurant', 'diner', 'sandwich_shop', 'deli', 'vegan_restaurant',
      'vegetarian_restaurant', 'middle_eastern_restaurant', 'ramen_restaurant',
      'indonesian_restaurant', 'turkish_restaurant', 'lebanese_restaurant',
      'afghani_restaurant', 'african_restaurant', 'brazilian_restaurant',
      'fine_dining_restaurant', 'food_court',
    ],
    radius: 4000, max: 15, displayName: 'Food', emoji: '🍽️',
  },
  pizza: {
    includedTypes: ['pizza_restaurant'],
    radius: 4000, max: 10, displayName: 'Pizza', emoji: '🍕',
  },
  fastfood: {
    includedTypes: ['fast_food_restaurant'],
    radius: 3000, max: 10, displayName: 'Fast Food', emoji: '🍟',
  },
  coffee: {
    includedTypes: ['cafe', 'coffee_shop'],
    radius: 3000, max: 10, displayName: 'Coffee', emoji: '☕',
  },
  bars: {
    includedTypes: ['bar', 'night_club', 'wine_bar'],
    radius: 4000, max: 10, displayName: 'Bars & Breweries', emoji: '🍺',
  },
  dessert: {
    includedTypes: ['dessert_shop', 'ice_cream_shop', 'bakery'],
    radius: 3000, max: 8, displayName: 'Dessert & Ice Cream', emoji: '🍦',
  },
  grocery: {
    includedTypes: ['grocery_store', 'supermarket'],
    radius: 4000, max: 8, displayName: 'Grocery', emoji: '🛒',
  },
  sporting: {
    includedTypes: ['sporting_goods_store'],
    radius: 6000, max: 8, displayName: 'Sporting Goods', emoji: '🏒',
  },
  pharmacy: {
    includedTypes: ['pharmacy', 'drugstore'],
    radius: 4000, max: 8, displayName: 'Pharmacy', emoji: '💊',
  },
  gas: {
    includedTypes: ['gas_station', 'convenience_store'],
    radius: 3000, max: 8, displayName: 'Gas & Convenience', emoji: '⛽',
  },
  attractions: {
    includedTypes: ['tourist_attraction', 'museum', 'amusement_park', 'aquarium', 'zoo', 'historical_landmark'],
    radius: 8000, max: 10, displayName: 'Attractions', emoji: '🎯',
  },
  entertainment: {
    includedTypes: ['amusement_center', 'bowling_alley', 'movie_theater', 'video_arcade'],
    radius: 6000, max: 8, displayName: 'Entertainment', emoji: '🎮',
  },
  hotels: {
    includedTypes: ['lodging'],
    radius: 8000, max: 10, displayName: 'Hotels', emoji: '🏨',
  },
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

  const sections = results.filter((s) => s.places.length > 0)

  return NextResponse.json({ sections })
}