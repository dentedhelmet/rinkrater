export const maxDuration = 15

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const supabaseAsUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )

  const { data: userData, error: userError } = await supabaseAsUser.auth.getUser()
  if (userError || !userData.user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const { data: reviews, error } = await supabaseAsUser
    .from('reviews')
    .select('id, rink_id, rink_name, rink_city, rink_state, category, comment, review_date, status')
    .eq('user_id', userData.user.id)
    .order('review_date', { ascending: false })

  if (error) {
    console.error('My reviews fetch error:', error)
    return NextResponse.json({ error: 'Failed to load your reviews' }, { status: 500 })
  }

  return NextResponse.json({ reviews: reviews || [] })
}
