import { NextRequest, NextResponse } from 'next/server'

interface CategoryConfig {
  includedTypes: string[]
  radius: number
  max: number
}

const CATEGORIES: Record<string, CategoryConfig> = {
  food:   { includedTypes: ['restaurant'], radius: 1500, max: 5 },
  coffee: { includedTypes: ['cafe'], radius: 1200, max: 3 },
  hotels: { includedTypes: ['lodging'], radius: 5000, max: 4 },
}

function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
          + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return R * 2 * Math.asin(Math.sqrt(a))
}

async function searchCategory(lat: number, lng: number, config: CategoryConfig, apiKey: string) {
  const body = {
    includedTypes: config.includedTypes,
    maxResultCount: config.max,
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: config.radius * 1.0,
      },
    },
  }

  const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.rating,places.googleMapsUri',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errorText = await res.text()
    console.error('Places API error for', config.includedTypes, ':', res.status, errorText)
    return []
  }

  const json = await res.json()
  const places = json.places || []

  return places.map(function(p: any) {
    return {
      name: p.displayName && p.displayName.text ? p.displayName.text : 'Unknown',
      vicinity: p.formattedAddress || '',
      rating: p.rating,
      mapsUrl: p.googleMapsUri || '#',
      distanceMiles: p.location
        ? distanceMiles(lat, lng, p.location.latitude, p.location.longitude)
        : undefined,
    }
  })
}

export async function GET(req: NextRequest) {
  const lat = parseFloat(req.nextUrl.searchParams.get('lat') || '')
  const lng = parseFloat(req.nextUrl.searchParams.get('lng') || '')

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'Valid lat and lng are required' }, { status: 400 })
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return NextResponse.json({ places: {}, error: 'Nearby search is not configured yet' })
  }

  const results: Record<string, any[]> = {}

  await Promise.all(
    Object.entries(CATEGORIES).map(async function(entry) {
      const key = entry[0]
      const config = entry[1]
      try {
        results[key] = await searchCategory(lat, lng, config, apiKey)
      } catch (err) {
        console.error('Nearby search failed for', key, err)
        results[key] = []
      }
    })
  )

  return NextResponse.json({ places: results })
}
