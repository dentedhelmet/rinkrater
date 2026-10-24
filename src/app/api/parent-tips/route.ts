import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import {
  INSTAGRAM_HANDLE_RE,
  TIP_CATEGORY_MAP,
  TIP_LIMITS,
  cleanInstagramHandle,
  isTipCategory,
} from '@/lib/parentTips'

export const maxDuration = 30

const resend = new Resend(process.env.RESEND_API_KEY)

// Acts as the signed-in parent. The parent_tips insert policy only accepts
// their own user ID and status 'pending', so a tip can never publish itself.
function getSupabaseForRequest(req: NextRequest) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: req.headers.get('authorization') || '' } } }
  )
}

// POST: a signed-in parent shares a tip. It waits for approval.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Missing tip details.' }, { status: 400 })
    }

    const { category, title, tip, instagram_ok, instagram_handle, website } = body as Record<string, unknown>

    // Honeypot: real people never fill this hidden field.
    if (website) return NextResponse.json({ ok: true })

    if (!isTipCategory(category)) {
      return NextResponse.json({ error: 'Please pick a category.' }, { status: 400 })
    }

    const cleanTitle = typeof title === 'string' ? title.trim().replace(/\s+/g, ' ') : ''
    const cleanBody = typeof tip === 'string' ? tip.trim().replace(/\n{3,}/g, '\n\n') : ''

    if (cleanTitle.length < TIP_LIMITS.titleMin || cleanTitle.length > TIP_LIMITS.titleMax) {
      return NextResponse.json(
        { error: `Give your tip a short title (${TIP_LIMITS.titleMin}–${TIP_LIMITS.titleMax} characters).` },
        { status: 400 }
      )
    }
    if (cleanBody.length < TIP_LIMITS.bodyMin || cleanBody.length > TIP_LIMITS.bodyMax) {
      return NextResponse.json(
        { error: `Your tip should be ${TIP_LIMITS.bodyMin}–${TIP_LIMITS.bodyMax} characters.` },
        { status: 400 }
      )
    }

    const featureOk = instagram_ok === true
    let handle: string | null = null
    if (featureOk && typeof instagram_handle === 'string' && instagram_handle.trim()) {
      handle = cleanInstagramHandle(instagram_handle)
      if (!INSTAGRAM_HANDLE_RE.test(handle)) {
        return NextResponse.json(
          { error: 'That Instagram username doesn’t look right. Use letters, numbers, periods or underscores.' },
          { status: 400 }
        )
      }
    }

    const supabase = getSupabaseForRequest(req)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Please sign in to share a tip.' }, { status: 401 })
    }

    // Soft cap so the queue can't be flooded.
    const { count, error: countError } = await supabase
      .from('parent_tips')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .is('deleted_at', null)

    if (countError) {
      console.error('parent_tips count error:', countError)
    } else if ((count ?? 0) >= TIP_LIMITS.maxPendingPerUser) {
      return NextResponse.json(
        { error: `You have ${TIP_LIMITS.maxPendingPerUser} tips waiting for review already. Hang tight, we’ll get to them soon!` },
        { status: 429 }
      )
    }

    const { data: inserted, error: insertError } = await supabase
      .from('parent_tips')
      .insert({
        user_id:          user.id,
        category,
        title:            cleanTitle,
        body:             cleanBody,
        instagram_ok:     featureOk,
        instagram_handle: featureOk ? handle : null,
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('parent_tips insert error:', insertError)
      // RLS rejects banned users' inserts.
      const blocked = insertError.code === '42501'
      return NextResponse.json(
        { error: blocked ? 'Your account can’t share tips right now.' : 'Could not save your tip. Please try again.' },
        { status: blocked ? 403 : 500 }
      )
    }

    // Let Senan know. Best-effort; never block the parent on email delivery.
    try {
      await resend.emails.send({
        from:    'Rink Rater <notifications@rinkrater.com>',
        to:      'senan@rinkrater.com',
        subject: `New parent tip waiting: ${TIP_CATEGORY_MAP[category].label}`,
        text:
          `"${cleanTitle}"\n\n${cleanBody}\n\n` +
          `Instagram OK: ${featureOk ? `yes${handle ? ` (@${handle})` : ''}` : 'no'}\n\n` +
          `Review it in Rink Rater HQ → Parent Tips.`,
      })
    } catch (emailError) {
      console.error('parent tip notification email failed:', emailError)
    }

    return NextResponse.json({ ok: true, id: inserted.id })
  } catch (err) {
    console.error('parent_tips POST error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
