export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { anthropic } from '@/lib/ai'

// ─── Claude prompt ─────────────────────────────────────────────────────────────
function buildPrompt(rawText: string, rinkName: string, city: string, state: string) {
  return `You are processing a hockey rink review for Rink Rater, a family-friendly platform for hockey parents.

The reviewer was asked about different aspects of ${rinkName} in ${city}, ${state} and responded naturally in a conversation.

Your job:
1. Extract their feedback into specific categories
2. Moderate the content for a family-friendly platform

Raw review text:
"${rawText}"

Respond ONLY with valid JSON and absolutely nothing else:
{
  "moderation": {
    "status": "published",
    "reason": null
  },
  "categories": [
    {
      "category": "CATEGORY NAME",
      "comment": "Extracted comment for this category."
    }
  ]
}

MODERATION RULES:
- "published" = clean, factual, family-friendly → post immediately
- "pending" = mentions staff/employees by name negatively, unverifiable serious claims, borderline language, or anything needing human review
- "rejected" = profanity, hate speech, clearly fake/spam, completely off-topic

VALID CATEGORIES (only include if the reviewer actually mentioned it):
RINK TEMPERATURE, LOCKER ROOMS, PARKING, RESTROOMS, SKATE SHARPENING, CONCESSIONS, WIFI, LIVEBARN, RINK RAT ACTIVITIES, FIRST IMPRESSIONS, ICE CONDITIONS, PRO SHOP, SEATING AREA / WARMING AREA, GIRLS LOCKER ROOM, DRINKS

Keep each comment to 1-2 sentences. Never invent information not present in the review. If the review is too short or vague to extract any categories, return an empty categories array with status "pending".`.trim()
}

// ─── Route ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { rinkId, rawText, userId, userAlias } = await req.json()

    if (!rinkId || !rawText?.trim()) {
      return NextResponse.json({ error: 'Missing rinkId or review text' }, { status: 400 })
    }

    // ── Build a client scoped to the requesting user's session ──────────────
    // The shared `supabase` client (anon key, no session) always hits
    // Postgres as `anon`, which RLS policies on `reviews`/`profiles` reject.
    // This client carries the user's access token so inserts/updates run
    // as `authenticated` with auth.uid() correctly populated.
    const token = req.headers.get('authorization')?.replace('Bearer ', '')

    const supabaseAsUser = token
      ? createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          { global: { headers: { Authorization: `Bearer ${token}` } } }
        )
      : null

    if (!supabaseAsUser) {
      return NextResponse.json({
        success:         false,
        status:          'pending',
        categoriesFound: 0,
        reason:          'You need to be signed in to save a review.',
      }, { status: 401 })
    }

    // ── Fetch rink info (read-only, fine on the shared anon client) ─────────
    const { data: rink } = await supabase
      .from('rinks')
      .select('name, city, state')
      .eq('id', rinkId)
      .single()

    const rinkName = rink?.name  || 'this rink'
    const city     = rink?.city  || ''
    const state    = rink?.state || ''

    // ── Claude: parse + moderate ─────────────────────────────────────────────
    const aiResponse = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{
        role:    'user',
        content: buildPrompt(rawText, rinkName, city, state),
      }],
    })

    const rawJson = aiResponse.content[0].type === 'text' ? aiResponse.content[0].text : ''

    let parsed: {
      moderation: { status: 'published' | 'pending' | 'rejected'; reason: string | null }
      categories: { category: string; comment: string }[]
    }

    try {
      const clean = rawJson.replace(/```json|```/g, '').trim()
      parsed = JSON.parse(clean)
    } catch {
      parsed = {
        moderation: { status: 'pending', reason: 'AI parse error — needs human review' },
        categories: [],
      }
    }

    const status = parsed.moderation.status

    // ── Guard: nothing to save ───────────────────────────────────────────────
    if (status === 'rejected') {
      return NextResponse.json({
        success:         false,
        status,
        categoriesFound: 0,
        reason:          parsed.moderation.reason || 'Review could not be published.',
      })
    }

    if (parsed.categories.length === 0) {
      return NextResponse.json({
        success:         false,
        status:          'pending',
        categoriesFound: 0,
        reason:          'Not enough detail to save — try adding a bit more, like how cold it was or what parking was like!',
      })
    }

    // ── Save to Supabase (as the authenticated user) ─────────────────────────
    const today = new Date().toISOString().split('T')[0]

    const rows = parsed.categories.map((cat) => ({
      id:          crypto.randomUUID(),
      rink_id:     rinkId,
      rink_name:   rinkName,
      rink_city:   city,
      rink_state:  state,
      source:      'rinkrater',
      category:    cat.category,
      comment:     cat.comment,
      user_id:     userId  || null,
      user_alias:  userAlias || 'Rink Rater reviewer',
      review_date: today,
      status,
    }))

    const { error: insertError } = await supabaseAsUser.from('reviews').insert(rows)

    if (insertError) {
      console.error('Review insert error:', insertError)
      return NextResponse.json({
        success:         false,
        status,
        categoriesFound: 0,
        reason:          'We hit a snag saving your review — please try again.',
      }, { status: 500 })
    }

    // ── Award XP (also as the authenticated user) ────────────────────────────
    if (userId && status === 'published') {
      const xpToAdd = 125 + (parsed.categories.length * 25)

      const { error: xpError } = await supabaseAsUser.rpc('increment_profile_stats', {
        p_user_id: userId,
        p_xp:      xpToAdd,
        p_reviews: 1,
      })

      if (xpError) {
        console.error('XP update error:', xpError)
      }
    }

    return NextResponse.json({
      success:         true,
      status,
      categoriesFound: parsed.categories.length,
      reason:          parsed.moderation.reason,
    })

  } catch (err) {
    console.error('Review submission error:', err)
    return NextResponse.json({ error: 'Failed to process review' }, { status: 500 })
  }
}