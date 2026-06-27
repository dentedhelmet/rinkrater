import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; category: string }> }
) {
  const { id: rinkId, category } = await params
  const decodedCategory = decodeURIComponent(category)

  const { data: reviews, error } = await supabase
    .from('reviews')
    .select('comment, source, review_date')
    .eq('rink_id', rinkId)
    .eq('category', decodedCategory)
    .order('review_date', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 })
  }

  return NextResponse.json({
    category: decodedCategory,
    reviews: reviews || [],
    total: (reviews || []).length,
  })
}
