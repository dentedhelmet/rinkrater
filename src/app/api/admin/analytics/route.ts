export const maxDuration = 20

import { NextRequest, NextResponse } from 'next/server'
import { JWT } from 'google-auth-library'
import { requireAdmin } from '@/lib/requireAdmin'

// ─── Google Analytics 4 for the admin dashboard ──────────────────────────────
//
// GET /api/admin/analytics?scope=summary  → last 14 days: visitors, sessions, page views
// GET /api/admin/analytics?scope=live     → right now: active visitors, per-minute, top pages, devices
// GET /api/admin/analytics?scope=detail   → live + countries/cities, plus 14-day channels, sources, landing pages
//
// Reads GA through a Google service account. Required environment variables
// (server-only — none of these may be NEXT_PUBLIC_):
//   GA_PROPERTY_ID              numeric GA4 property ID (not the G-… measurement ID)
//   GA_SERVICE_ACCOUNT_EMAIL    e.g. rinkrater-dashboard@<project>.iam.gserviceaccount.com
//   GA_SERVICE_ACCOUNT_KEY      the private_key value from the JSON key file
// Optional:
//   GA_TIMEZONE                 defaults to America/New_York (match the GA property)
//
// Admin-only: every request is checked against admin_roles first.

const GA_API = 'https://analyticsdata.googleapis.com/v1beta'
const SUMMARY_CACHE_MS = 5 * 60_000
const LIVE_CACHE_MS = 20_000

const cache = new Map<string, { expires: number; body: unknown }>()
let jwtClient: JWT | null = null

const stripQuotes = (v: string) => v.trim().replace(/^['"]+|['"]+$/g, '').trim()

/**
 * Rebuilds the private key into proper PEM format no matter how a hosting
 * panel stored it: wrapped in quotes, with literal \n (or \\n), with line
 * breaks collapsed into spaces, or as one long line.
 */
function normalizePrivateKey(raw: string | undefined): string | null {
  if (!raw) return null
  const unescaped = stripQuotes(raw).replace(/\\\\n/g, '\n').replace(/\\n/g, '\n')
  const match = unescaped.match(/-----BEGIN ([A-Z ]*PRIVATE KEY)-----([\s\S]*?)-----END \1-----/)
  if (!match) return null
  const label = match[1]
  const body = match[2].replace(/[^A-Za-z0-9+/=]/g, '')
  if (!body) return null
  const lines = body.match(/.{1,64}/g) ?? []
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----\n`
}

function gaConfig() {
  const propertyId = process.env.GA_PROPERTY_ID ? stripQuotes(process.env.GA_PROPERTY_ID) : ''
  const email = process.env.GA_SERVICE_ACCOUNT_EMAIL ? stripQuotes(process.env.GA_SERVICE_ACCOUNT_EMAIL) : ''
  const rawKey = process.env.GA_SERVICE_ACCOUNT_KEY
  const timeZone = process.env.GA_TIMEZONE?.trim() || 'America/New_York'
  if (!propertyId || !email || !rawKey) return null
  return { propertyId, email, key: normalizePrivateKey(rawKey), timeZone }
}

async function gaRequest(propertyId: string, method: 'runReport' | 'runRealtimeReport', body: object) {
  const config = gaConfig()!
  if (!config.key) {
    throw Object.assign(new Error('GA_SERVICE_ACCOUNT_KEY is not a valid private key'), { kind: 'key' })
  }
  if (!jwtClient) {
    jwtClient = new JWT({
      email: config.email,
      key: config.key,
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    })
  }
  const { token } = await jwtClient.getAccessToken()
  const res = await fetch(`${GA_API}/properties/${propertyId}:${method}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const json = await res.json()
  if (!res.ok) {
    const message = json?.error?.message || `GA request failed (${res.status})`
    throw Object.assign(new Error(message), { status: res.status })
  }
  return json as GaReport
}

interface GaReport {
  rows?: { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] }[]
  totals?: { metricValues?: { value: string }[] }[]
}

const num = (v: string | undefined) => Number(v ?? 0) || 0

// Last 14 calendar days (oldest first) as YYYY-MM-DD in the property's time zone.
function last14Days(timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
  const days: string[] = []
  for (let i = 13; i >= 0; i--) {
    days.push(fmt.format(new Date(Date.now() - i * 86_400_000)))
  }
  return days
}

async function buildSummary(propertyId: string, timeZone: string) {
  const report = await gaRequest(propertyId, 'runReport', {
    dateRanges: [{ startDate: '13daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'date' }],
    metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }],
    metricAggregations: ['TOTAL'],
    orderBys: [{ dimension: { dimensionName: 'date' } }],
  })

  const byDay = new Map<string, { users: number; sessions: number; views: number }>()
  for (const row of report.rows ?? []) {
    const raw = row.dimensionValues?.[0]?.value ?? '' // YYYYMMDD
    const day = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
    byDay.set(day, {
      users:    num(row.metricValues?.[0]?.value),
      sessions: num(row.metricValues?.[1]?.value),
      views:    num(row.metricValues?.[2]?.value),
    })
  }

  const days = last14Days(timeZone).map((day) => ({ day, ...(byDay.get(day) ?? { users: 0, sessions: 0, views: 0 }) }))
  const totalsRow = report.totals?.[0]?.metricValues

  return {
    configured: true,
    days,
    totals: {
      // Unique visitors across the whole range (not the sum of daily counts).
      users:    num(totalsRow?.[0]?.value),
      sessions: num(totalsRow?.[1]?.value),
      views:    num(totalsRow?.[2]?.value),
    },
  }
}

async function buildLive(propertyId: string) {
  const [total, perMinute, pages, devices] = await Promise.all([
    gaRequest(propertyId, 'runRealtimeReport', {
      metrics: [{ name: 'activeUsers' }],
    }),
    gaRequest(propertyId, 'runRealtimeReport', {
      dimensions: [{ name: 'minutesAgo' }],
      metrics: [{ name: 'activeUsers' }],
    }),
    gaRequest(propertyId, 'runRealtimeReport', {
      dimensions: [{ name: 'unifiedScreenName' }],
      metrics: [{ name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      limit: 5,
    }),
    gaRequest(propertyId, 'runRealtimeReport', {
      dimensions: [{ name: 'deviceCategory' }],
      metrics: [{ name: 'activeUsers' }],
    }),
  ])

  // 30 one-minute buckets, oldest → newest, for the live sparkline.
  const minuteMap = new Map<number, number>()
  for (const row of perMinute.rows ?? []) {
    minuteMap.set(num(row.dimensionValues?.[0]?.value), num(row.metricValues?.[0]?.value))
  }
  const minutes = Array.from({ length: 30 }, (_, i) => {
    const minutesAgo = 29 - i
    return { minutesAgo, users: minuteMap.get(minutesAgo) ?? 0 }
  })

  return {
    configured: true,
    activeNow: num(total.rows?.[0]?.metricValues?.[0]?.value),
    minutes,
    topPages: (pages.rows ?? []).map((row) => ({
      page:  row.dimensionValues?.[0]?.value || '(untitled)',
      users: num(row.metricValues?.[0]?.value),
    })),
    devices: (devices.rows ?? []).map((row) => ({
      device: row.dimensionValues?.[0]?.value || 'other',
      users:  num(row.metricValues?.[0]?.value),
    })),
    fetchedAt: new Date().toISOString(),
  }
}

// Events worth showing on Live Visitors, in plain words. Anything else GA
// collects automatically (scrolls, clicks, etc.) is left out.
const ACTION_LABELS: Record<string, string> = {
  page_view:    'Page views',
  search:       'Rink searches',
  ask_tj:       'Questions for TJ',
  review_saved: 'Reviews saved',
  sign_up:      'Sign-ups',
  login:        'Sign-ins',
}

const rowsToList = (report: GaReport, key: string) =>
  (report.rows ?? []).map((row) => ({
    [key]: row.dimensionValues?.[0]?.value || '(not set)',
    users: num(row.metricValues?.[0]?.value),
  })) as ({ users: number } & Record<string, string | number>)[]

// Full Live Visitors page: where people are right now, plus where traffic
// has come from over the last 14 days.
async function buildDetail(propertyId: string) {
  const live = await buildLive(propertyId)
  const top = (dim: string, limit: number) => ({
    dimensions: [{ name: dim }],
    metrics: [{ name: 'activeUsers' }],
    orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
    limit,
  })
  const range = (dim: string, metric: string, limit: number) => ({
    dateRanges: [{ startDate: '13daysAgo', endDate: 'today' }],
    dimensions: [{ name: dim }],
    metrics: [{ name: metric }],
    orderBys: [{ metric: { metricName: metric }, desc: true }],
    limit,
  })

  const [countries, cities, pages, events, channels, sources, landing, broken] = await Promise.all([
    gaRequest(propertyId, 'runRealtimeReport', top('country', 8)),
    gaRequest(propertyId, 'runRealtimeReport', top('city', 8)),
    gaRequest(propertyId, 'runRealtimeReport', top('unifiedScreenName', 10)),
    gaRequest(propertyId, 'runRealtimeReport', {
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: 20,
    }),
    gaRequest(propertyId, 'runReport', range('sessionDefaultChannelGroup', 'sessions', 8)),
    gaRequest(propertyId, 'runReport', range('sessionSource', 'sessions', 8)),
    gaRequest(propertyId, 'runReport', range('landingPage', 'sessions', 10)),
    // Pages that showed the "not found" screen, and which URLs caused them.
    gaRequest(propertyId, 'runReport', {
      dateRanges: [{ startDate: '13daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }],
      dimensionFilter: { filter: { fieldName: 'pageTitle', stringFilter: { matchType: 'CONTAINS', value: '404' } } },
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 10,
    }),
  ])

  const sessionsList = (report: GaReport, key: string) =>
    (report.rows ?? []).map((row) => ({
      [key]: row.dimensionValues?.[0]?.value || '(not set)',
      sessions: num(row.metricValues?.[0]?.value),
    }))

  return {
    ...live,
    countries: rowsToList(countries, 'name'),
    cities:    rowsToList(cities, 'name').filter((c) => c.name !== '(not set)'),
    topPages:  rowsToList(pages, 'page'),
    channels:  sessionsList(channels, 'name'),
    sources:   sessionsList(sources, 'name'),
    landing:   sessionsList(landing, 'page'),
    actions:   (events.rows ?? [])
      .map((row) => ({ name: row.dimensionValues?.[0]?.value || '', count: num(row.metricValues?.[0]?.value) }))
      .filter((e) => e.name in ACTION_LABELS)
      .map((e) => ({ ...e, label: ACTION_LABELS[e.name] })),
    broken:    (broken.rows ?? []).map((row) => ({
      page:  row.dimensionValues?.[0]?.value || '(unknown)',
      views: num(row.metricValues?.[0]?.value),
    })),
  }
}

export async function GET(req: NextRequest) {
  const check = await requireAdmin(req)
  if (!check.ok) return check.response

  const config = gaConfig()
  if (!config) {
    return NextResponse.json({ configured: false })
  }

  const requested = req.nextUrl.searchParams.get('scope')
  const scope = requested === 'live' || requested === 'detail' ? requested : 'summary'
  const cacheKey = scope
  const hit = cache.get(cacheKey)
  if (hit && hit.expires > Date.now()) {
    return NextResponse.json(hit.body)
  }

  try {
    const body =
      scope === 'live'   ? await buildLive(config.propertyId)
      : scope === 'detail' ? await buildDetail(config.propertyId)
      : await buildSummary(config.propertyId, config.timeZone)
    cache.set(cacheKey, { expires: Date.now() + (scope === 'summary' ? SUMMARY_CACHE_MS : LIVE_CACHE_MS), body })
    return NextResponse.json(body)
  } catch (err) {
    const e = err as { status?: number; kind?: string; message?: string; response?: { data?: { error_description?: string; error?: string } } }
    const raw = `${e.message ?? ''} ${e.response?.data?.error_description ?? ''} ${e.response?.data?.error ?? ''}`
    console.error(`GA ${scope} report failed:`, err)
    jwtClient = null // rebuild the client next time in case the env changed

    const hint =
      e.kind === 'key' || /DECODER|PEM|asn1|private key|unsupported/i.test(raw)
        ? 'The private key isn’t readable — re-copy the private_key value from the JSON file into GA_SERVICE_ACCOUNT_KEY (everything from -----BEGIN to -----END PRIVATE KEY-----).'
      : /invalid_grant|account not found|invalid_client|unauthorized_client/i.test(raw)
        ? 'Google rejected the login — check GA_SERVICE_ACCOUNT_EMAIL matches client_email in the same JSON file as the key.'
      : e.status === 403 || /PERMISSION_DENIED/i.test(raw)
        ? /has not been used|is disabled|SERVICE_DISABLED/i.test(raw)
          ? 'The Google Analytics Data API isn’t enabled on the Cloud project that owns this service account.'
          : 'Google said no access — add the service account email as a Viewer on the GA property.'
      : e.status === 404 || e.status === 400
        ? 'GA property not found — check GA_PROPERTY_ID (the numeric ID, not G-…).'
      : 'Google Analytics did not respond. Try again in a minute.'

    // Admin-only route, so it's safe to include Google's own wording for troubleshooting.
    const detail = raw.replace(/\s+/g, ' ').trim().slice(0, 240) || undefined
    return NextResponse.json({ configured: true, error: hint, detail }, { status: 502 })
  }
}
