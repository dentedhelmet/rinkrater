import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PostTopBar, PostBackLink } from '@/components/blog/PostBackNav'
import { BottomBanner } from '@/components/layout/BottomBanner'
import { SITE_URL, formatPostDate, htmlToText, readingMinutes } from '@/lib/blog'
import { getPostBySlug, getPostRinks } from '@/lib/blogQueries'
import { cleanPostHtml } from '@/lib/blogHtml'
import styles from '@/components/blog/blog.module.css'

// Each post is built on first visit, then cached and refreshed at most every
// 5 minutes. (An empty list here means "build pages on demand, then cache".)
export const revalidate = 300
export const dynamicParams = true
export async function generateStaticParams() {
  return []
}

type Params = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const post = await getPostBySlug(slug)
  if (!post) return { title: 'Post not found', robots: { index: false } }

  const description = post.excerpt || htmlToText(post.body_html).slice(0, 160)
  const url = `${SITE_URL}/blog/${post.slug}`
  const images = post.cover_image_url ? [{ url: post.cover_image_url, alt: post.cover_image_alt }] : undefined

  return {
    title: post.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      title: post.title,
      description,
      siteName: 'Rink Rater',
      publishedTime: post.published_at ?? undefined,
      modifiedTime: post.updated_at,
      images,
    },
    twitter: {
      card: post.cover_image_url ? 'summary_large_image' : 'summary',
      title: post.title,
      description,
      images: post.cover_image_url ? [post.cover_image_url] : undefined,
    },
  }
}

export default async function BlogPostPage({ params }: Params) {
  const { slug } = await params
  const post = await getPostBySlug(slug)
  if (!post) notFound()

  const [rinks, html] = await Promise.all([
    getPostRinks(post.rink_ids ?? []),
    Promise.resolve(cleanPostHtml(post.body_html)),
  ])

  const url = `${SITE_URL}/blog/${post.slug}`
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt || htmlToText(post.body_html).slice(0, 160),
    image: post.cover_image_url ? [post.cover_image_url] : undefined,
    datePublished: post.published_at,
    dateModified: post.updated_at,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
    author: { '@type': 'Organization', name: 'Rink Rater', url: SITE_URL },
    publisher: {
      '@type': 'Organization',
      name: 'Rink Rater',
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo/rinkrater-logo.png` },
    },
    about: rinks.map((r) => ({
      '@type': 'SportsActivityLocation',
      name: r.name,
      url: `${SITE_URL}/rink/${encodeURIComponent(r.id)}`,
      address: [r.city, r.state].filter(Boolean).join(', ') || undefined,
    })),
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <PostTopBar slug={post.slug} />

      <main className={styles.page}>
        <article>
          <PostBackLink slug={post.slug} />
          <h1 className={styles.title}>{post.title}</h1>
          <p className={styles.byline}>
            <time dateTime={post.published_at ?? undefined}>{formatPostDate(post.published_at)}</time>
            {' · '}{readingMinutes(post.body_html)} min read
          </p>

          {post.cover_image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.cover_image_url} alt={post.cover_image_alt} className={styles.cover} />
          )}

          <div className={styles.prose} dangerouslySetInnerHTML={{ __html: html }} />

          {post.instagram_permalink && (
            <a href={post.instagram_permalink} target="_blank" rel="noopener noreferrer" className={styles.instagramLink}>
              See it on Instagram →
            </a>
          )}
        </article>

        {rinks.length > 0 && (
          <section className={`clay-card ${styles.rinksSection}`} aria-labelledby="post-rinks">
            <h2 id="post-rinks">Rinks in this post</h2>
            <p>See what hockey families say before you make the drive.</p>
            <ul className={styles.rinkList}>
              {rinks.map((r) => (
                <li key={r.id}>
                  <Link href={`/rink/${encodeURIComponent(r.id)}`} className={styles.rinkLink}>
                    <span>
                      <span className={styles.rinkName}>{r.name}</span>
                      <span className={styles.rinkPlace}>{[r.city, r.state].filter(Boolean).join(', ')}</span>
                    </span>
                    <span className={styles.rinkCount}>
                      {r.total_reviews > 0
                        ? `${r.total_reviews.toLocaleString('en-US')} review${r.total_reviews === 1 ? '' : 's'}`
                        : 'Be the first to review'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className={`clay-card ${styles.cta}`}>
          <p>Heading to a rink this weekend? Look it up before you go.</p>
          <Link href="/" className="clay-btn clay-btn-primary" style={{ display: 'inline-block', textDecoration: 'none', padding: '10px 24px' }}>
            Search rinks
          </Link>
        </section>
      </main>

      <script
        type="application/ld+json"
        // JSON-LD can't contain a raw "</script>" — escape "<" to be safe.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />

      <BottomBanner />
    </div>
  )
}
