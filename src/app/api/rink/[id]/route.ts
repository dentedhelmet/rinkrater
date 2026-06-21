import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rinkId } = await params

  const [{ data: rink, error: rinkError }, { data: stats }] = await Promise.all([
    supabase.from('rinks').select('*').eq('id', rinkId).single(),
    supabase.from('rink_stats').select('*').eq('rink_id', rinkId).single(),
  ])

  if (rinkError || !rink) {
    return NextResponse.json({ error: 'Rink not found' }, { status: 404 })
  }

  // Pull a sample of reviews grouped by category for quick display
  const { data: reviews } = await supabase
    .from('reviews')
    .select('category, comment, source, review_date')
    .eq('rink_id', rinkId)
    .order('review_date', { ascending: false })
    .limit(50)

  // Group by category for simple counts
  const categoryCounts: Record<string, number> = {}
  for (const r of reviews || []) {
    // @ts-ignore
    categoryCounts[r.category] = (categoryCounts[r.category] || 0) + 1
  }

  return NextResponse.json({
    rink,
    stats: stats || {
      total_reviews: 0,
      confidence_tier: 'NO_DATA',
      rr_unique_reviewers: 0,
    },
    categoryCounts,
    recentReviews: (reviews || []).slice(0, 10),
  })
}
