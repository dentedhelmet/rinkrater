import { cache } from 'react'
import { supabase } from '@/lib/supabase'
import { POST_CARD_COLUMNS, POST_COLUMNS, type Post, type PostCard } from '@/lib/blog'

/**
 * Server-side reads for the public blog. The database's read rule already
 * hides drafts, scheduled and removed posts from the public, so these
 * queries only ever see live posts.
 */

export const getLivePosts = cache(async (limit = 60): Promise<PostCard[]> => {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_CARD_COLUMNS)
    .order('published_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('blog list failed:', error.message)
    return []
  }
  return (data as PostCard[]) ?? []
})

export const getPostBySlug = cache(async (slug: string): Promise<Post | null> => {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_COLUMNS)
    .eq('slug', slug)
    .maybeSingle()
  if (error) {
    console.error('blog post failed:', error.message)
    return null
  }
  return (data as Post | null) ?? null
})

export interface PostRink {
  id:            string
  name:          string
  city:          string
  state:         string
  total_reviews: number
}

/** Tagged rinks (active only) with their live review counts, in tag order. */
export async function getPostRinks(ids: string[]): Promise<PostRink[]> {
  if (ids.length === 0) return []
  const [{ data: rinks }, { data: stats }] = await Promise.all([
    supabase.from('rinks').select('id, name, city, state').in('id', ids).eq('active', true),
    supabase.from('rink_stats').select('rink_id, total_reviews').in('rink_id', ids),
  ])
  const counts = new Map((stats ?? []).map((s: { rink_id: string; total_reviews: number }) => [s.rink_id, Number(s.total_reviews) || 0]))
  const byId = new Map((rinks ?? []).map((r: { id: string; name: string; city: string; state: string }) => [r.id, r]))
  return ids
    .map((id) => byId.get(id))
    .filter((r): r is { id: string; name: string; city: string; state: string } => !!r)
    .map((r) => ({ ...r, total_reviews: counts.get(r.id) ?? 0 }))
}
