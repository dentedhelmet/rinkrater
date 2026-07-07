export const maxDuration = 30
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { openai, anthropic } from '@/lib/ai'
const SYSTEM_PROMPT = `
You are TJ, the friendly mascot and AI agent for Rink Rater — a community review app for ice hockey families across North America. You help parents and players know what to expect at any rink before they make the drive.

You will be given retrieved reviews from a database. Answer ONLY using those reviews. Never invent or assume information not present in what you're given.

Speak warmly and practically, like a hockey parent who's been to a lot of rinks. Keep answers concise — 2-4 sentences for most questions.

When reviews come from "rinkrater" source with multiple unique reviewers, you can say things like "families say" or "reviewers report."
When reviews come from "ftloh" source, remember this is typically a single contributor's observations — phrase it as "one report notes" rather than implying consensus.
If there are no relevant reviews at all for what's being asked, say so honestly and suggest the person call the rink directly or be the first to leave a review.

Never make up phone numbers, prices, or specific details not in the provided reviews.
`.trim()

const SYNONYMS: Record<string, string[]> = {
  sheets: ['rinks', 'surfaces', 'ice'],
  rinks: ['sheets', 'surfaces'],
  wifi: ['internet', 'wi-fi'],
  sharpening: ['sharpener', 'sharpened'],
  bathroom: ['restroom', 'toilet'],
  bathrooms: ['restrooms', 'toilets'],
}

const STOP_WORDS = ['what', 'where', 'when', 'does', 'this', 'there', 'have', 'many']

export async function POST(req: NextRequest) {
  try {
    const { question, rinkId, rinkName } = await req.json()

    if (!question?.trim()) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 })
    }

    // Step 1: Resolve the rink if we only have a name, not an ID
    let resolvedRinkId = rinkId
    let resolvedRinkName = rinkName

    if (!resolvedRinkId && rinkName) {
      const { data: matches } = await supabase.rpc('search_rinks_fuzzy', {
        name_query: rinkName,
        state_filter: null,
        limit_count: 1,
      })
      if (matches?.[0]) {
        resolvedRinkId = matches[0].id
        resolvedRinkName = matches[0].name
      }
    }

    if (!resolvedRinkId) {
      return NextResponse.json({
        answer: "I couldn't figure out which rink you're asking about. Try searching for it by name first!",
      })
    }

    // Step 2: Embed the question for semantic search
    const embedResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: question,
    })
    const queryEmbedding = embedResponse.data[0].embedding

    // Step 3: Vector search within this rink's reviews
    const { data: vectorResults, error: searchError } = await supabase.rpc('search_reviews', {
      query_embedding: queryEmbedding,
      target_rink_id: resolvedRinkId,
      target_category: null,
      target_source: null,
      match_threshold: 0.3,
      match_count: 20,
    })

    if (searchError) {
      console.error('Vector search error:', searchError)
    }

    // Step 3b: Hybrid keyword search — vector search alone misses short
    // factual details buried in longer review text, and misses cases
    // where the question and review use different words for the same
    // thing (e.g. "sheets" vs "rinks"). We expand keywords using a
    // synonym map and do a direct text search as a second pass.
    const baseKeywords = question
      .toLowerCase()
      .replace(/[?.,!]/g, '')
      .split(' ')
      .filter((w: string) => w.length > 3 && !STOP_WORDS.includes(w))

    const keywords = [
      ...baseKeywords,
      ...baseKeywords.flatMap((w: string) => SYNONYMS[w] || []),
    ]

    let keywordResults: any[] = []
    if (keywords.length > 0) {
      const orFilter = keywords.map((k: string) => `comment.ilike.%${k}%`).join(',')
      const { data, error: kwError } = await supabase
        .from('reviews')
        .select('id, rink_id, rink_name, rink_city, rink_state, source, category, comment, review_date')
        .eq('rink_id', resolvedRinkId)
        .or(orFilter)
        .limit(10)

      if (kwError) console.error('Keyword search error:', kwError)
      keywordResults = data || []
    }

    // Merge and de-duplicate by id
    const seen = new Set()
    const reviews = [...(vectorResults || []), ...keywordResults].filter((r: any) => {
      if (seen.has(r.id)) return false
      seen.add(r.id)
      return true
    })

    // Step 4: Get rink stats for confidence context
    const { data: stats } = await supabase
      .from('rink_stats')
      .select('*')
      .eq('rink_id', resolvedRinkId)
      .single()

    // Step 5: Build context block for Claude
    const reviewLines = reviews.map((r: any) =>
      `[${r.category}] (${r.source}): ${r.comment}`
    ).join('\n')

    const contextBlock = `
RINK: ${resolvedRinkName || stats?.rink_name || 'Unknown'}
CONFIDENCE TIER: ${stats?.confidence_tier || 'NO_DATA'}
UNIQUE RINK RATER REVIEWERS: ${stats?.rr_unique_reviewers || 0}
TOTAL REVIEWS: ${stats?.total_reviews || 0}

RELEVANT REVIEWS FOUND:
${reviewLines || '(no relevant reviews found for this question)'}

QUESTION: ${question}
`.trim()

    // Step 6: Call Claude
    const claudeResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: contextBlock }],
    })

    const answer = claudeResponse.content[0].type === 'text'
      ? claudeResponse.content[0].text
      : "Sorry, I had trouble putting together an answer."

    return NextResponse.json({
      answer,
      reviewsUsed: reviews.length,
      rinkId: resolvedRinkId,
      rinkName: resolvedRinkName,
    })
  } catch (err: any) {
    console.error('Ask API error:', err)
    return NextResponse.json(
      { error: 'Something went wrong', detail: err.message },
      { status: 500 }
    )
  }
}