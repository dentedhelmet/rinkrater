/**
 * Shared Blog types and helpers — used by the admin editor and the public
 * /blog pages. Nothing in here touches the network.
 */

export const SITE_URL = 'https://rinkrater.com'

export type PostStatus = 'draft' | 'published'

export interface Post {
  id:                  string
  slug:                string
  title:               string
  excerpt:             string
  body_html:           string
  cover_image_url:     string
  cover_image_alt:     string
  rink_ids:            string[]
  status:              PostStatus
  published_at:        string | null
  source:              'blog' | 'instagram'
  instagram_permalink: string
  created_at:          string
  updated_at:          string
  deleted_at:          string | null
}

/** Columns for the admin list and editor. */
export const POST_COLUMNS =
  'id, slug, title, excerpt, body_html, cover_image_url, cover_image_alt, rink_ids, status, published_at, source, instagram_permalink, created_at, updated_at, deleted_at'

/** Lighter column set for list cards (no body). */
export const POST_CARD_COLUMNS =
  'id, slug, title, excerpt, cover_image_url, cover_image_alt, published_at, source'

export type PostCard = Pick<Post,
  'id' | 'slug' | 'title' | 'excerpt' | 'cover_image_url' | 'cover_image_alt' | 'published_at' | 'source'>

/** What a post looks like from the outside: Draft, Scheduled, Live or Removed. */
export type PostState = 'draft' | 'scheduled' | 'live' | 'removed'

export function postState(p: Pick<Post, 'status' | 'published_at' | 'deleted_at'>, now = Date.now()): PostState {
  if (p.deleted_at) return 'removed'
  if (p.status === 'draft' || !p.published_at) return 'draft'
  return new Date(p.published_at).getTime() > now ? 'scheduled' : 'live'
}

/** "Rink Owner vs. Hockey Parents!" → "rink-owner-vs-hockey-parents" */
export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '')
}

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** "October 19, 2026" */
export function formatPostDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York',
  })
}

/** Plain text from HTML — for word counts and fallback descriptions. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

export function readingMinutes(html: string): number {
  const words = htmlToText(html).split(' ').filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}
