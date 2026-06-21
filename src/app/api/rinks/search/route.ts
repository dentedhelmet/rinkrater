import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q')?.trim()

  if (!query) {
    // No query — return a few rinks with the most reviews as a default
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

  // Use the fuzzy search function we built in Supabase
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