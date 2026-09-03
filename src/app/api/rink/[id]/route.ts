export const maxDuration = 30
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rinkId } = await params
  const [{ data: rink, error: rinkError }, { data: stats }, { data: overallRatings }] = await Promise.all([
    supabase.from('rinks').select('*').eq('id', rinkId).single(),
    supabase.from('rink_stats').select('*').eq('rink_id', rinkId).single(),
    supabase.from('rink_overall_ratings').select('rating').eq('rink_id', rinkId),
  ])
  if (rinkError || !rink) {
    return NextResponse.json({ error: 'Rink not found' }, { status: 404 })
  }

  // Pull a sample of reviews grouped by category for quick display
  const { data: reviews } = await supabase
    .from('reviews')
    .select('category, comment, source, review_date, user_alias')
    .eq('rink_id', rinkId)
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('review_date', { ascending: false })
    .limit(50)

  // Group by category for simple counts
  const categoryCounts: Record<string, number> = {}
  for (const r of reviews || []) {
    // @ts-ignore
    categoryCounts[r.category] = (categoryCounts[r.category] || 0) + 1
  }

  // Overall rating average — computed live from rink_overall_ratings rather
  // than stored on rink_stats, since rink_stats is a materialized view we
  // don't write to per-request. Fine at current review volumes; if this
  // table grows very large per rink, revisit with a dedicated lightweight
  // (non-materialized) view instead.
  const ratingsList = overallRatings || []
  const overallRatingCount = ratingsList.length
  const avgOverallRating =
    overallRatingCount > 0
      ? ratingsList.reduce((sum, r) => sum + r.rating, 0) / overallRatingCount
      : null

  return NextResponse.json({
    rink,
    stats: {
      ...(stats || {
        total_reviews: 0,
        confidence_tier: 'NO_DATA',
        rr_unique_reviewers: 0,
      }),
      avg_overall_rating: avgOverallRating,
      overall_rating_count: overallRatingCount,
    },
    categoryCounts,
    recentReviews: (reviews || []).slice(0, 10),
  })
}