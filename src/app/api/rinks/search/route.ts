export const maxDuration = 30
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const STATE_MAP: Record<string, string> = {
  AL: 'AL', ALABAMA: 'AL',
  AK: 'AK', ALASKA: 'AK',
  AZ: 'AZ', ARIZONA: 'AZ',
  AR: 'AR', ARKANSAS: 'AR',
  CA: 'CA', CALIFORNIA: 'CA',
  CO: 'CO', COLORADO: 'CO',
  CT: 'CT', CONNECTICUT: 'CT',
  DE: 'DE', DELAWARE: 'DE',
  FL: 'FL', FLORIDA: 'FL',
  GA: 'GA', GEORGIA: 'GA',
  HI: 'HI', HAWAII: 'HI',
  ID: 'ID', IDAHO: 'ID',
  IL: 'IL', ILLINOIS: 'IL',
  IN: 'IN', INDIANA: 'IN',
  IA: 'IA', IOWA: 'IA',
  KS: 'KS', KANSAS: 'KS',
  KY: 'KY', KENTUCKY: 'KY',
  LA: 'LA', LOUISIANA: 'LA',
  ME: 'ME', MAINE: 'ME',
  MD: 'MD', MARYLAND: 'MD',
  MA: 'MA', MASSACHUSETTS: 'MA',
  MI: 'MI', MICHIGAN: 'MI',
  MN: 'MN', MINNESOTA: 'MN',
  MS: 'MS', MISSISSIPPI: 'MS',
  MO: 'MO', MISSOURI: 'MO',
  MT: 'MT', MONTANA: 'MT',
  NE: 'NE', NEBRASKA: 'NE',
  NV: 'NV', NEVADA: 'NV',
  NH: 'NH', 'NEW HAMPSHIRE': 'NH',
  NJ: 'NJ', 'NEW JERSEY': 'NJ',
  NM: 'NM', 'NEW MEXICO': 'NM',
  NY: 'NY', 'NEW YORK': 'NY',
  NC: 'NC', 'NORTH CAROLINA': 'NC',
  ND: 'ND', 'NORTH DAKOTA': 'ND',
  OH: 'OH', OHIO: 'OH',
  OK: 'OK', OKLAHOMA: 'OK',
  OR: 'OR', OREGON: 'OR',
  PA: 'PA', PENNSYLVANIA: 'PA',
  RI: 'RI', 'RHODE ISLAND': 'RI',
  SC: 'SC', 'SOUTH CAROLINA': 'SC',
  SD: 'SD', 'SOUTH DAKOTA': 'SD',
  TN: 'TN', TENNESSEE: 'TN',
  TX: 'TX', TEXAS: 'TX',
  UT: 'UT', UTAH: 'UT',
  VT: 'VT', VERMONT: 'VT',
  VA: 'VA', VIRGINIA: 'VA',
  WA: 'WA', WASHINGTON: 'WA',
  WV: 'WV', 'WEST VIRGINIA': 'WV',
  WI: 'WI', WISCONSIN: 'WI',
  WY: 'WY', WYOMING: 'WY',
}

// Returns the subset of the given rink IDs that are active.
// Used for results that come from rink_stats or the fuzzy-search function,
// which don't know about the rinks.active flag on their own.
async function getActiveIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const { data } = await supabase
    .from('rinks')
    .select('id')
    .in('id', ids)
    .eq('active', true)
  return new Set((data || []).map(function(r) { return r.id }))
}

async function attachStats(rows: { id: string; name: string; city: string; state: string }[]) {
  const rinkIds = rows.map(function(r) { return r.id })
  const { data: statsData } = await supabase
    .from('rink_stats')
    .select('rink_id, total_reviews, confidence_tier')
    .in('rink_id', rinkIds)

  const statsMap: Record<string, any> = {}
  for (const s of statsData || []) {
    statsMap[s.rink_id] = s
  }

  return rows.map(function(r) {
    const s = statsMap[r.id]
    return {
      rink_id: r.id,
      rink_name: r.name,
      city: r.city,
      state: r.state,
      total_reviews: s ? s.total_reviews : 0,
      confidence_tier: s ? s.confidence_tier : 'NO_DATA',
    }
  })
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q')?.trim()

  // No query: most-reviewed rinks. Fetch extra, drop inactive, keep top 10.
  if (!query) {
    const { data, error } = await supabase
      .from('rink_stats')
      .select('rink_id, rink_name, city, state, total_reviews, confidence_tier')
      .order('total_reviews', { ascending: false })
      .limit(30)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const activeIds = await getActiveIds((data || []).map(function(s) { return s.rink_id }))
    const rinks = (data || [])
      .filter(function(s) { return activeIds.has(s.rink_id) })
      .slice(0, 10)
    return NextResponse.json({ rinks })
  }

  const upperQuery = query.toUpperCase().trim()
  const stateCode = STATE_MAP[upperQuery]

  // State search: active rinks only.
  if (stateCode) {
    const { data, error } = await supabase
      .from('rinks')
      .select('id, name, city, state')
      .eq('state', stateCode)
      .eq('active', true)
      .order('name')
      .limit(30)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rinks = await attachStats(data || [])
    return NextResponse.json({ rinks })
  }

  // City search: active rinks only.
  const { data: cityMatch } = await supabase
    .from('rinks')
    .select('id, name, city, state')
    .ilike('city', query)
    .eq('active', true)
    .limit(30)

  if (cityMatch && cityMatch.length > 0) {
    const rinks = await attachStats(cityMatch)
    return NextResponse.json({ rinks })
  }

  // Fuzzy name search: fetch extra, drop inactive, keep top 10 in original order.
  const { data, error } = await supabase.rpc('search_rinks_fuzzy', {
    name_query: query,
    state_filter: null,
    limit_count: 20,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const results: any[] = data || []
  const activeIds = await getActiveIds(results.map(function(r) { return r.rink_id ?? r.id }))
  const nameMatches = results.filter(function(r) { return activeIds.has(r.rink_id ?? r.id) })

  // Alternate-name search: catches former names after a rename or merge
  // (e.g. "Tri-Town" -> Delta Dental Arena, "Drady" -> O'Neill Arena).
  // The fuzzy function only looks at the current name.
  const escaped = query.replace(/[\\%_]/g, function(c) { return '\\' + c })
  const { data: altData } = await supabase
    .from('rinks')
    .select('id, name, city, state')
    .ilike('altname', '%' + escaped + '%')
    .eq('active', true)
    .limit(5)

  const seen = new Set(nameMatches.map(function(r) { return r.rink_id ?? r.id }))
  const altMatches = await attachStats((altData || []).filter(function(r) { return !seen.has(r.id) }))

  // Ranking:
  //   1. Strong name matches  - the rink's current name contains the search text
  //   2. Alternate-name matches - a former name contains the search text
  //   3. Weak name matches    - fuzzy "sounds similar" results
  // Comparison ignores case, spaces and punctuation, so "Tri Town" = "Tri-Town".
  const normalize = function(s: string) { return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '') }
  const q = normalize(query)
  const strong = nameMatches.filter(function(r) { return q.length > 0 && normalize(r.rink_name ?? r.name).includes(q) })
  const weak = nameMatches.filter(function(r) { return !(q.length > 0 && normalize(r.rink_name ?? r.name).includes(q)) })

  const rinks = strong
    .concat(altMatches)
    .concat(weak)
    .slice(0, 10)

  return NextResponse.json({ rinks })
}