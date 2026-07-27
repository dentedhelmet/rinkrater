export const maxDuration = 15

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  const { reviewId } = await params
  const { comment } = await req.json()

  if (!comment || !comment.trim()) {
    return NextResponse.json({ error: 'Comment cannot be empty.' }, { status: 400 })
  }

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

  // Editing resets status to 'pending' — an edited review shouldn't stay
  // silently "published" with unreviewed new wording. No AI re-moderation
  // pass here, just a status reset so it surfaces for a human look.
  const { data, error } = await supabaseAsUser
    .from('reviews')
    .update({ comment: comment.trim(), status: 'pending' })
    .eq('id', reviewId)
    .eq('user_id', userData.user.id) // defense in depth beyond RLS
    .select()
    .single()

  if (error || !data) {
    console.error('My review edit error:', error)
    return NextResponse.json({ error: 'Could not save your edit — try again.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, review: data })
}
