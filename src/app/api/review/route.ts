export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { anthropic } from '@/lib/ai'

interface Entry {
  category: string
  rawText: string
}

// ─── Claude prompt ─────────────────────────────────────────────────────────────
// The category is chosen by the user in the UI before they type, so Claude's
// job is NOT to guess categories — it's just to clean up wording and moderate
// each already-tagged entry.
function buildPrompt(entries: Entry[], rinkName: string, city: string, state: string) {
  const list = entries
    .map((e, i) => `${i + 1}. Category: ${e.category}\n   Reviewer wrote: "${e.rawText}"`)
    .join('\n\n')

  return `You are processing hockey rink review entries for Rink Rater, a family-friendly platform for hockey parents.

Rink: ${rinkName} in ${city}, ${state}

The reviewer has ALREADY told us which category each entry below belongs to — do not guess or reassign categories. For each numbered entry:
1. Write a clean 1-2 sentence comment in the reviewer's voice, based only on what they actually wrote. Light grammar cleanup is fine; never invent details.
2. Moderate it:
   - "published" = clean, factual, family-friendly → post immediately
   - "pending" = mentions staff/employees by name negatively, unverifiable serious claims, borderline language, or anything needing human review
   - "rejected" = profanity, hate speech, clearly fake/spam, or genuinely unrelated to the stated category

Entries:
${list}

Respond ONLY with valid JSON, entries in the same order as above, and nothing else:
{
  "entries": [
    { "category": "EXACT CATEGORY FROM INPUT", "comment": "...", "status": "published", "reason": null }
  ]
}`.trim()
}

// ─── Route ─────────────────────────────────────────────────────────────────────
// Body shape:
//   { rinkId, entries: [{ category, rawText }], userId, userAlias, isFirstSave }
//
// NOTE on total_reviews semantics: this increments the profile's total_reviews
// by the number of PUBLISHED CATEGORY ENTRIES saved in this call — every call,
// every session. A user who answers 3 categories across 2 checkpoints in one
// sitting gets +3 to total_reviews, same as if they'd done it across 2 separate
// sessions. This is a deliberate choice: "review" == individual category entry,
// not "review session for a rink."
export async function POST(req: NextRequest) {
  try {
    const { rinkId, entries, userId, userAlias, isFirstSave } = await req.json()

    if (!rinkId || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: 'Missing rinkId or entries' }, { status: 400 })
    }

    const cleanEntries: Entry[] = entries.filter(
      (e: any) => e?.category && typeof e.rawText === 'string' && e.rawText.trim()
    )

    if (cleanEntries.length === 0) {
      return NextResponse.json({
        success:         false,
        categoriesFound: 0,
        xpAwarded:       0,
        results:         [],
        reason:          'Nothing to save yet.',
      })
    }

    // ── Build a client scoped to the requesting user's session ──────────────
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
        categoriesFound: 0,
        xpAwarded:       0,
        results:         [],
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

    // ── Claude: clean up + moderate each already-categorized entry ──────────
    const aiResponse = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 1200,
      messages: [{
        role:    'user',
        content: buildPrompt(cleanEntries, rinkName, city, state),
      }],
    })

    const rawJson = aiResponse.content[0].type === 'text' ? aiResponse.content[0].text : ''

    let resultEntries: { category: string; comment: string; status: 'published' | 'pending' | 'rejected'; reason: string | null }[]

    try {
      const clean = rawJson.replace(/```json|```/g, '').trim()
      resultEntries = JSON.parse(clean).entries || []
    } catch {
      resultEntries = cleanEntries.map((e) => ({
        category: e.category,
        comment:  e.rawText,
        status:   'pending' as const,
        reason:   'AI parse error — needs human review',
      }))
    }

    const today = new Date().toISOString().split('T')[0]

    const rowsToInsert = resultEntries
      .filter((e) => e.status !== 'rejected')
      .map((e) => ({
        id:          crypto.randomUUID(),
        rink_id:     rinkId,
        rink_name:   rinkName,
        rink_city:   city,
        rink_state:  state,
        source:      'rinkrater',
        category:    e.category,
        comment:     e.comment,
        user_id:     userId  || null,
        user_alias:  userAlias || 'Rink Rater reviewer',
        review_date: today,
        status:      e.status,
      }))

    if (rowsToInsert.length > 0) {
      const { error: insertError } = await supabaseAsUser.from('reviews').insert(rowsToInsert)

      if (insertError) {
        console.error('Review insert error:', insertError)
        return NextResponse.json({
          success:         false,
          categoriesFound: 0,
          xpAwarded:       0,
          results:         [],
          reason:          'We hit a snag saving your review — please try again.',
        }, { status: 500 })
      }
    }

    // ── Award XP + increment review count (also as the authenticated user) ──
    const publishedCount = resultEntries.filter((e) => e.status === 'published').length

    let xpToAdd = 0
    if (userId && publishedCount > 0) {
      // XP keeps the "125 base once per session, +25/category" structure.
      xpToAdd = (isFirstSave ? 125 : 0) + publishedCount * 25

      // total_reviews increments by the number of published categories in
      // THIS call, every time — not gated by isFirstSave.
      const { error: xpError } = await supabaseAsUser.rpc('increment_profile_stats', {
        p_user_id: userId,
        p_xp:      xpToAdd,
        p_reviews: publishedCount,
      })

      if (xpError) {
        console.error('XP update error:', xpError)
      }
    }

    return NextResponse.json({
      success:         true,
      categoriesFound: publishedCount,
      xpAwarded:       xpToAdd,
      results:         resultEntries,
    })

  } catch (err) {
    console.error('Review submission error:', err)
    return NextResponse.json({ error: 'Failed to process review' }, { status: 500 })
  }
}
