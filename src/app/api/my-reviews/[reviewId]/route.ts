export const maxDuration = 15

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAsUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return { supabase: null, token: null }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  return { supabase, token }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  const { reviewId } = await params
  const { comment } = await req.json()
  if (!comment || !comment.trim()) {
    return NextResponse.json({ error: 'Comment cannot be empty.' }, { status: 400 })
  }

  const { supabase: supabaseAsUser } = getSupabaseAsUser(req)
  if (!supabaseAsUser) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

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
    .is('deleted_at', null) // can't edit something already deleted
    .select()
    .single()

  if (error || !data) {
    console.error('My review edit error:', error)
    return NextResponse.json({ error: 'Could not save your edit — try again.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, review: data })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  const { reviewId } = await params

  const { supabase: supabaseAsUser } = getSupabaseAsUser(req)
  if (!supabaseAsUser) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const { data: userData, error: userError } = await supabaseAsUser.auth.getUser()
  if (userError || !userData.user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  // Fetch first so we know its current status before soft-deleting —
  // total_reviews should only decrement if this review was actually
  // counted (i.e. published). A pending/rejected review never counted
  // toward that total, so deleting one shouldn't decrement anything.
  const { data: existing, error: fetchError } = await supabaseAsUser
    .from('reviews')
    .select('id, user_id, status, deleted_at')
    .eq('id', reviewId)
    .eq('user_id', userData.user.id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Review not found.' }, { status: 404 })
  }

  if (existing.deleted_at) {
    // Already deleted — treat as success rather than erroring, since the
    // end state the user wants (review gone) is already true.
    return NextResponse.json({ success: true })
  }

  const wasPublished = existing.status === 'published'

  const { error: deleteError } = await supabaseAsUser
    .from('reviews')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', reviewId)
    .eq('user_id', userData.user.id)

  if (deleteError) {
    console.error('My review delete error:', deleteError)
    return NextResponse.json({ error: 'Could not delete your review — try again.' }, { status: 500 })
  }

  // XP is left untouched by design — deleting a review to fix a mistake
  // (e.g. incorrect wording) shouldn't cost the user XP they already
  // earned. total_reviews DOES decrement when the deleted review was
  // published, since that count reflects current, live reviews.
  if (wasPublished) {
    const { error: statsError } = await supabaseAsUser.rpc('decrement_total_reviews', {
      p_user_id: userData.user.id,
      p_amount: 1,
    })
    if (statsError) {
      // Don't fail the whole request over this — the review is already
      // deleted, which is the part the user actually asked for. Log it
      // so a stats drift can be caught and corrected manually if needed.
      console.error('total_reviews decrement error after delete:', statsError)
    }
  }

  return NextResponse.json({ success: true })
}