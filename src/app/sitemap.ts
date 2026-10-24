import type { MetadataRoute } from 'next'
import { supabase } from '@/lib/supabase'
import { SITE_URL } from '@/lib/blog'

// Served at rinkrater.com/sitemap.xml. Rebuilt at most once an hour.
export const revalidate = 3600

const STATIC_PAGES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
  { path: '/',               priority: 1.0, changeFrequency: 'daily'   },
  { path: '/blog',           priority: 0.8, changeFrequency: 'weekly'  },
  { path: '/nearby',         priority: 0.6, changeFrequency: 'weekly'  },
  { path: '/parent-resources', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/tips',           priority: 0.7, changeFrequency: 'daily'   },
  { path: '/whats-the-call', priority: 0.5, changeFrequency: 'weekly'  },
  { path: '/about',          priority: 0.4, changeFrequency: 'monthly' },
  { path: '/partners',       priority: 0.4, changeFrequency: 'monthly' },
  { path: '/shop',           priority: 0.4, changeFrequency: 'weekly'  },
  { path: '/contact',        priority: 0.3, changeFrequency: 'yearly'  },
]

/** All active rink IDs. Supabase returns 1,000 rows per request, so page through. */
async function activeRinkIds(): Promise<string[]> {
  const ids: string[] = []
  const PAGE = 1000
  for (let from = 0; from < 20000; from += PAGE) {
    const { data, error } = await supabase
      .from('rinks')
      .select('id')
      .eq('active', true)
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) {
      console.error('sitemap rinks failed:', error.message)
      break
    }
    ids.push(...(data ?? []).map((r: { id: string }) => r.id))
    if (!data || data.length < PAGE) break
  }
  return ids
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ data: posts }, rinkIds] = await Promise.all([
    supabase.from('posts').select('slug, updated_at').order('published_at', { ascending: false }).limit(5000),
    activeRinkIds(),
  ])

  return [
    ...STATIC_PAGES.map((p) => ({
      url: `${SITE_URL}${p.path === '/' ? '' : p.path}`,
      changeFrequency: p.changeFrequency,
      priority: p.priority,
    })),
    ...(posts ?? []).map((p: { slug: string; updated_at: string }) => ({
      url: `${SITE_URL}/blog/${p.slug}`,
      lastModified: p.updated_at,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    ...rinkIds.map((id) => ({
      url: `${SITE_URL}/rink/${encodeURIComponent(id)}`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ]
}
