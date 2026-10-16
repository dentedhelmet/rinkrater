import type { Metadata } from 'next'
import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { BottomBanner } from '@/components/layout/BottomBanner'
import { SITE_URL, formatPostDate } from '@/lib/blog'
import { getLivePosts } from '@/lib/blogQueries'
import styles from '@/components/blog/blog.module.css'

// Rebuilt at most every 5 minutes, so scheduled posts appear on their own.
export const revalidate = 300

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Rink news, hockey family tips and stories from the stands — from the team behind Rink Rater.',
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/blog`,
    title: 'The Rink Rater Blog',
    description: 'Rink news, hockey family tips and stories from the stands.',
    siteName: 'Rink Rater',
  },
}

export default async function BlogIndexPage() {
  const posts = await getLivePosts()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <TopBar showBack backHref="/" title="Blog" />

      <main className={`${styles.page} ${styles.wide}`}>
        <header className={styles.intro}>
          <h1>The Rink Rater Blog</h1>
          <p>Rink news, hockey family tips and stories from the stands.</p>
        </header>

        {posts.length === 0 ? (
          <div className={`clay-card ${styles.empty}`}>
            <p>The first posts are on their way. Check back soon!</p>
          </div>
        ) : (
          <ul className={styles.grid}>
            {posts.map((p) => (
              <li key={p.id}>
                <Link href={`/blog/${p.slug}`} className={styles.card}>
                  {p.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.cover_image_url} alt={p.cover_image_alt} className={styles.cardImage} loading="lazy" />
                  ) : (
                    <span className={styles.cardImagePlaceholder} aria-hidden="true">🏒</span>
                  )}
                  <span className={styles.cardBody}>
                    <span className={styles.cardMeta}>
                      <time dateTime={p.published_at ?? undefined}>{formatPostDate(p.published_at)}</time>
                    </span>
                    <h2 className={styles.cardTitle}>{p.title}</h2>
                    {p.excerpt && <span className={styles.cardExcerpt}>{p.excerpt}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>

      <BottomBanner />
    </div>
  )
}
