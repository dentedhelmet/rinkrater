export const maxDuration = 15

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getUserClient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

// GET — does this signed-in user already have an overall rating for this rink?
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rinkId } = await params
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const supabaseAsUser = getUserClient(token)
  const { data: userData, error: userError } = await supabaseAsUser.auth.getUser()
  if (userError || !userData.user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const { data, error } = await supabaseAsUser
    .from('rink_overall_ratings')
    .select('rating')
    .eq('rink_id', rinkId)
    .eq('user_id', userData.user.id)
    .maybeSingle()

  if (error) {
    console.error('Overall rating fetch error:', error)
    return NextResponse.json({ error: 'Could not check your rating' }, { status: 500 })
  }

  return NextResponse.json({ rating: data?.rating ?? null })
}

// POST — submit or update this user's overall rating for this rink.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rinkId } = await params
  const { rating } = await req.json()

  if (!rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Rating must be between 1 and 5.' }, { status: 400 })
  }

  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const supabaseAsUser = getUserClient(token)
  const { data: userData, error: userError } = await supabaseAsUser.auth.getUser()
  if (userError || !userData.user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const { data, error } = await supabaseAsUser.rpc('upsert_overall_rating', {
    p_rink_id: rinkId,
    p_user_id: userData.user.id,
    p_rating:  rating,
  })

  if (error) {
    console.error('Overall rating submit error:', error)
    return NextResponse.json({ error: 'Could not save your rating — try again.' }, { status: 500 })
  }

  const row = Array.isArray(data) ? data[0] : data
  return NextResponse.json({
    success:             true,
    avgOverallRating:    row?.avg_overall_rating ?? null,
    overallRatingCount:  row?.overall_rating_count ?? 0,
  })
}
