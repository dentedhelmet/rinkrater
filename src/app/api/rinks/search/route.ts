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

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q')?.trim()

  if (!query) {
    const { data, error } = await supabase
      .from('rink_stats')
      .select('rink_id, rink_name, city, state, total_reviews, confidence_tier')
      .order('total_reviews', { ascending: false })
      .limit(10)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ rinks: data })
  }

  const upperQuery = query.toUpperCase().trim()
  const stateCode = STATE_MAP[upperQuery]

  if (stateCode) {
    const { data, error } = await supabase
      .from('rinks')
      .select('id, name, city, state')
      .eq('state', stateCode)
      .limit(30)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rinkIds = (data || []).map(function(r) { return r.id })
    const { data: statsData } = await supabase
      .from('rink_stats')
      .select('rink_id, total_reviews, confidence_tier')
      .in('rink_id', rinkIds)

    const statsMap: Record<string, any> = {}
    for (const s of statsData || []) {
      statsMap[s.rink_id] = s
    }

    const rinks = (data || []).map(function(r) {
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

    return NextResponse.json({ rinks })
  }

  const { data: cityMatch } = await supabase
    .from('rinks')
    .select('id, name, city, state')
    .ilike('city', query)
    .limit(30)

  if (cityMatch && cityMatch.length > 0) {
    const rinkIds = cityMatch.map(function(r) { return r.id })
    const { data: statsData } = await supabase
      .from('rink_stats')
      .select('rink_id, total_reviews, confidence_tier')
      .in('rink_id', rinkIds)

    const statsMap: Record<string, any> = {}
    for (const s of statsData || []) {
      statsMap[s.rink_id] = s
    }

    const rinks = cityMatch.map(function(r) {
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

    return NextResponse.json({ rinks })
  }

  const { data, error } = await supabase.rpc('search_rinks_fuzzy', {
    name_query: query,
    state_filter: null,
    limit_count: 10,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ rinks: data })
}
