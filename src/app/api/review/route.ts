export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
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

    // ── Fetch rink info ──────────────────────────────────────────────────────
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
      // Strip any accidental markdown fences
      const clean = rawJson.replace(/```json|```/g, '').trim()
      parsed = JSON.parse(clean)
    } catch {
      // If Claude returns malformed JSON, default to pending for human review
      parsed = {
        moderation: { status: 'pending', reason: 'AI parse error — needs human review' },
        categories: [],
      }
    }

    const status = parsed.moderation.status

    // ── Save to Supabase ─────────────────────────────────────────────────────
    const today = new Date().toISOString().split('T')[0]

    if (status !== 'rejected' && parsed.categories.length > 0) {
      const rows = parsed.categories.map((cat) => ({
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

      const { error: insertError } = await supabase.from('reviews').insert(rows)
      if (insertError) {
        console.error('Review insert error:', insertError)
      }

      // ── Award XP ──────────────────────────────────────────────────────────
      if (userId && status === 'published') {
        const xpToAdd = 125 + (parsed.categories.length * 25)

        const { data: profile } = await supabase
          .from('profiles')
          .select('xp, total_reviews')
          .eq('id', userId)
          .single()

        if (profile) {
          await supabase
            .from('profiles')
            .update({
              xp:            profile.xp + xpToAdd,
              total_reviews: profile.total_reviews + 1,
              updated_at:    new Date().toISOString(),
            })
            .eq('id', userId)
        }
      }
    }

    return NextResponse.json({
      success:        true,
      status,
      categoriesFound: parsed.categories.length,
      reason:         parsed.moderation.reason,
    })

  } catch (err) {
    console.error('Review submission error:', err)
    return NextResponse.json({ error: 'Failed to process review' }, { status: 500 })
  }
}
