'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { SiteHeader } from '@/components/redesign/SiteHeader'
import { AuthModal } from '@/components/auth/AuthModal'
import { PageShell } from '@/components/layout/PageShell'
import { BottomBanner } from '@/components/layout/BottomBanner'
import { RotatingQuestions } from '@/components/home/RotatingQuestions'
import { FeaturedPartners } from '@/components/home/FeaturedPartners'
import { Footer } from '@/components/layout/Footer'

interface RinkResult {
  rink_id?: string
  id?: string
  rink_name?: string
  name?: string
  city: string
  state: string
  total_reviews?: number
  review_count?: number
  confidence_tier?: string
}

const TRENDING_QUESTIONS = [
  'Are there Concessions?',
  'Is there Skate Sharpening?',
  "Are there Girl's Locker Rooms?",
  'How cold is the rink?',
]

const THUMBNAIL_COUNT = 14

function thumbnailForRink(id: string) {
  var hash = 0
  for (var i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % THUMBNAIL_COUNT
  }
  var num = Math.abs(hash % THUMBNAIL_COUNT) + 1
  return '/rink-thumbnails/rr_arena' + num + '.png'
}

const HERO_BACKGROUND = '/hero/hero-main.jpg'
const HERO_BACKGROUND_MOBILE = '/hero/hero-mobile.jpg'

// Ad rotation: each entry is one ad. Add more entries here later and they
// automatically join the rotation — no other code changes needed.
const ADS = [
  {
    id: 'heated-jacket-1',
    desktop: '/ads/heated-jacket-desktop.png',
    mobile: '/ads/heated-jacket-mobile.png',
    // TODO: replace with the real Amazon affiliate/product link before launch
    link: 'https://www.amazon.com/',
    alt: 'Amazon: heated jackets for every rink — 5 heating zones, all-day warmth, rechargeable power. Shop Now.',
    aspectDesktop: '650 / 548',
    aspectMobile: '750 / 290',
  },
  {
    id: 'bubble-hockey-1',
    desktop: '/ads/bubble-hockey-desktop.png',
    mobile: '/ads/bubble-hockey-mobile.png',
    // TODO: replace with the real destination link before launch
    link: 'https://www.amazon.com/',
    // TODO: update this description once the actual ad copy/offer is confirmed
    alt: 'Advertisement: bubble hockey table. Shop Now.',
    // TODO: these aspect ratios are copied from the heated-jacket ad as a
    // starting guess — check against the actual PNG dimensions and adjust
    // if the bubble hockey creative has a different shape. object-fit:
    // contain means a wrong guess won't distort the image, just add extra
    // padding on two sides, so this is safe to leave until confirmed.
    aspectDesktop: '650 / 548',
    aspectMobile: '750 / 290',
  },
]

const AD_ROTATION_KEY = 'rinkrater_ad_rotation_index'

export default function HomePage() {
  const [query, setQuery] = useState('')
  const [rinks, setRinks] = useState<RinkResult[]>([])
  const [loading, setLoading] = useState(true)
  const [showRinkList, setShowRinkList] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const [adIndex, setAdIndex] = useState(0)

  useEffect(function() {
    const mq = window.matchMedia('(min-width: 768px)')
    setIsDesktop(mq.matches)
    function handleChange(e: MediaQueryListEvent) { setIsDesktop(e.matches) }
    mq.addEventListener('change', handleChange)
    return function() { mq.removeEventListener('change', handleChange) }
  }, [])

  useEffect(function() {
    if (ADS.length <= 1) return
    const stored = parseInt(localStorage.getItem(AD_ROTATION_KEY) || '0', 10)
    const current = stored % ADS.length
    setAdIndex(current)
    localStorage.setItem(AD_ROTATION_KEY, String((current + 1) % ADS.length))
  }, [])

  useEffect(function() {
    const timer = setTimeout(function() {
      fetchRinks(query)
    }, 300)
    return function() { clearTimeout(timer) }
  }, [query])

  async function fetchRinks(searchQuery: string) {
    setLoading(true)
    try {
      const url = searchQuery
        ? '/api/rinks/search?q=' + encodeURIComponent(searchQuery)
        : '/api/rinks/search'
      const res = await fetch(url)
      const data = await res.json()
      setRinks(data.rinks || [])
    } catch {
      setRinks([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageShell topBar={<SiteHeader onSignIn={() => setShowAuth(true)} />} tabBar={<BottomBanner />}>
      <div className="home-grid" >
        <div className="home-main-col">

        {/* ── Hero ──────────────────────────────────────────────────────────
             hero-outer has NO fixed height of its own — its height comes
             entirely from hero-photo, which is the only normal-flow child.
             hero-photo carries the aspect-ratio, so next/image's `fill`
             always has a predictable box to fill (this is what was broken
             before — the box was growing to fit the text, stretching the
             photo along with it).
             The callout+search overlay is absolutely positioned at every
             breakpoint. The sidebar (Partners/Trending) is a normal block
             below the photo on mobile, then switches to absolute — floating
             over the photo — at desktop widths. Same DOM node either way,
             so nothing is duplicated or double-fetched. */}
        <div className="hero-outer">
          <div className="hero-photo">
            <Image
              src={isDesktop ? HERO_BACKGROUND : HERO_BACKGROUND_MOBILE}
              alt=""
              fill
              priority
              sizes={isDesktop ? '66vw' : '100vw'}
              className="hero-photo-img"
            />
          </div>

          <div className="hero-overlay-left">
            <div className="hero-callout">
              <h1 className="hero-headline">
                <span className="hero-line-sm">ASK ME ABOUT</span>
                <span className="hero-line-lg">ANY RINK</span>
                <span className="hero-line-lg hero-accent">ANYWHERE</span>
                <span className="hero-line-md">IN NORTH AMERICA!</span>
              </h1>
            </div>
          </div>

          {/* Search bar spans (nearly) the full width of the photo, anchored
              to the bottom, at every breakpoint — so results dropped beneath
              it have room to show full rink names without truncating */}
          <div className="hero-search-wrap hero-search-wrap--bottom">
            <div className="hero-search">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0, color: 'var(--rr-navy)', opacity: 0.5 }}>
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                placeholder="Search for a rink..."
                value={query}
                onChange={function(e) { setQuery(e.target.value) }}
                onKeyDown={function(e) { if (e.key === 'Enter') { fetchRinks(query) } }}
                style={{
                  flex: 1,
                  border: 'none',
                  fontSize: 13,
                  fontFamily: 'var(--font-body)',
                  color: 'var(--rr-navy)',
                  outline: 'none',
                  background: 'transparent',
                  paddingLeft: 0,
                  minWidth: 0,
                  width: '100%',
                }}
                aria-label="Search for a rink by name, city, or state"
              />
              <button
                type="button"
                onClick={function() { fetchRinks(query) }}
                aria-label="Search"
                style={{
                  width: 30, height: 30,
                  borderRadius: '50%',
                  background: 'var(--rr-red)',
                  border: 'var(--rr-outline-sm)',
                  boxShadow: 'var(--rr-shadow-sm)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', flexShrink: 0,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" stroke="#fff" strokeWidth="2.2" />
                  <path d="M21 21l-4.3-4.3" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {query.trim() !== '' && (
              <div className="hero-search-results">
                {loading && (
                  <div className="hero-search-status">Searching...</div>
                )}
                {!loading && rinks.length === 0 && (
                  <div className="hero-search-status">
                    No rinks found for "{query}".
                  </div>
                )}
                {!loading && rinks.length > 0 && (
                  <div className="hero-search-results-list">
                    {rinks.map(function(rink) {
                      return <RinkCard key={rink.rink_id || rink.id} rink={rink} />
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

        <div className="rink-list-row">
          <div className="rink-list-col">
          <button
            type="button"
            onClick={function() { setShowRinkList(!showRinkList) }}
            style={{
              width: '100%',
              background: 'var(--rr-warm)',
              border: 'var(--rr-outline)',
              borderRadius: 'var(--rr-radius)',
              boxShadow: 'var(--rr-shadow)',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              marginBottom: showRinkList ? 8 : 14,
            }}
          >
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 14, color: 'var(--rr-navy)' }}>
              {query ? 'Search results' : 'Most reviewed rinks'}
            </span>
            <span style={{ fontSize: 14, color: 'var(--rr-navy)', transform: showRinkList ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
              {'\u25BC'}
            </span>
          </button>

          {showRinkList && (
            <div style={{ height: 430, overflowY: 'auto', marginBottom: 14, position: 'relative' }} className="scroll-y">
              {loading && (
                <div style={{ textAlign: 'center', padding: 20, color: 'rgba(13,42,74,0.4)', fontSize: 12 }}>
                  Loading rinks...
                </div>
              )}

              {!loading && rinks.length === 0 && (
                <div style={{ textAlign: 'center', padding: 20 }}>
                  <div style={{ color: 'rgba(13,42,74,0.5)', fontSize: 12, marginBottom: 10 }}>
                    No rinks found for "{query}".
                  </div>
                  <a
                    href={'mailto:senan@rinkrater.com?subject=Add a Rink&body=Rink name: ' + encodeURIComponent(query) + '%0ACity, State: %0AAddress (optional): %0AAnything else: '}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'var(--rr-ice)',
                      border: 'var(--rr-outline-sm)',
                      borderRadius: 999,
                      padding: '8px 14px',
                      fontFamily: 'var(--font-display)',
                      fontWeight: 800,
                      fontSize: 11,
                      color: 'var(--rr-navy)',
                      textDecoration: 'none',
                    }}
                  >
                    Can't find your rink? Let us know {'\u2192'}
                  </a>
                </div>
              )}

              <div className="rink-grid">
                {rinks.map(function(rink) {
                  return <RinkCard key={rink.rink_id || rink.id} rink={rink} />
                })}
              </div>
            </div>
          )}
          </div>

          <div className="rink-ad-col">
            {(function() {
              const ad = ADS[adIndex]
              return (
                <a
                  href={ad.link}
                  target="_blank"
                  rel="sponsored noopener noreferrer"
                  className="ad-link"
                  aria-label={'Advertisement: ' + ad.alt}
                >
                  <div
                    className="ad-image-wrap"
                    style={{ aspectRatio: isDesktop ? ad.aspectDesktop : ad.aspectMobile }}
                  >
                    <Image
                      src={isDesktop ? ad.desktop : ad.mobile}
                      alt={ad.alt}
                      fill
                      sizes={isDesktop ? '240px' : '100vw'}
                      style={{ objectFit: 'contain' }}
                    />
                  </div>
                </a>
              )
            })()}
          </div>
        </div>

        </div>

        <div className="home-side-col">
          <FeaturedPartners />
          <div className="clay-card" style={{ padding: '14px', marginBottom: 14 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 13, color: 'var(--rr-navy)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{'\u{1F525}'}</span> Trending Questions
            </div>
            <RotatingQuestions questions={TRENDING_QUESTIONS} />
          </div>
          <div className="clay-card" style={{ padding: '14px', marginBottom: 14 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 13, color: 'var(--rr-navy)', marginBottom: 10 }}>
              Find a Rink Near You
            </div>
            <div
              style={{
                width: '100%',
                height: 140,
                background: 'var(--rr-ice)',
                border: 'var(--rr-outline-sm)',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 10,
                color: 'rgba(13,42,74,0.3)',
                fontSize: 12,
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
              }}
            >
              Map coming soon
            </div>
            <button
              disabled
              style={{
                width: '100%',
                background: 'var(--rr-warm)',
                border: 'var(--rr-outline-sm)',
                borderRadius: 999,
                padding: '8px 12px',
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 11,
                color: 'rgba(13,42,74,0.4)',
                cursor: 'default',
              }}
            >
              View map
            </button>
          </div>
        </div>

      </div>

      <style jsx>{`
        .home-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
          padding-bottom: 16px;
        }
        .rink-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
        }

        /* Rink list + ad card: stacked on mobile, side-by-side on desktop */
        .rink-list-row {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .rink-list-col {
          flex: 1;
          min-width: 0;
        }

        /* ── Hero outer ──────────────────────────────────────────────────
             Mobile: hero-photo and hero-overlay-left are both normal-flow
             children, stacked vertically — photo on top, callout+search
             below. No overlap is possible because nothing is absolutely
             positioned over the image at this breakpoint.
             Desktop: hero-overlay-left switches to position:absolute and
             floats over the photo instead (see media query below). ── */
        .hero-outer {
          position: relative;
          margin-bottom: 14px;
        }

        .hero-photo {
          position: relative;
          width: 100%;
          aspect-ratio: 4 / 3;
          border-radius: 20px 20px 20px 4px;
          overflow: hidden;
          box-shadow: var(--rr-shadow);
        }
        .hero-photo-img {
          object-fit: cover;
          object-position: center top;
        }

        .hero-overlay-left {
          position: absolute;
          top: 14px;
          left: 14px;
          z-index: 2;
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-width: 220px;
        }

        .hero-callout {
          background: var(--rr-warm);
          border: var(--rr-outline);
          border-radius: 14px 14px 14px 3px;
          box-shadow: var(--rr-shadow-lg);
          padding: 10px 12px;
        }
        .hero-headline {
          margin: 0;
          display: flex;
          flex-direction: column;
          font-family: var(--font-display);
          text-transform: uppercase;
          line-height: 1.15;
        }
        .hero-line-sm {
          font-size: 12px;
          font-weight: 800;
          color: var(--rr-navy);
        }
        .hero-line-lg {
          font-size: 19px;
          font-weight: 900;
          color: var(--rr-navy);
        }
        .hero-line-md {
          font-size: 11px;
          font-weight: 800;
          color: var(--rr-navy);
          margin-top: 2px;
        }
        .hero-accent {
          color: var(--rr-red);
        }

        .hero-search-wrap {
          position: relative;
        }
        .hero-search-wrap--bottom {
          position: absolute;
          bottom: 14px;
          left: 14px;
          right: 14px;
          z-index: 2;
        }
        .hero-search {
          background: var(--rr-warm);
          border: var(--rr-outline);
          border-radius: var(--rr-radius);
          box-shadow: var(--rr-shadow-lg);
          padding: 8px 10px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .hero-search-results {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          right: 0;
          background: var(--rr-warm);
          border: var(--rr-outline);
          border-radius: var(--rr-radius);
          box-shadow: var(--rr-shadow-lg);
          max-height: 320px;
          overflow-y: auto;
          z-index: 20;
          padding: 8px;
        }
        .hero-search-status {
          padding: 16px;
          text-align: center;
          font-size: 12px;
          font-family: var(--font-body);
          color: rgba(13, 42, 74, 0.5);
        }
        .hero-search-results-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        /* Ad card, next to Most Reviewed Rinks — stacked below on mobile,
           beside it on desktop */
        .rink-ad-col {
          width: 100%;
        }
        .ad-link {
          display: block;
        }
        .ad-image-wrap {
          position: relative;
          width: 100%;
          border-radius: var(--rr-radius);
          overflow: hidden;
        }
        .ad-link:focus-visible .ad-image-wrap {
          outline: 3px solid var(--rr-navy);
          outline-offset: 2px;
        }

        @media (min-width: 768px) {
          .home-grid {
            grid-template-columns: 2fr 1fr;
            align-items: start;
          }
          .rink-grid {
            grid-template-columns: 1fr 1fr;
          }
          .hero-photo {
            aspect-ratio: 16 / 9;
          }
          .hero-photo-img {
            object-position: center 25%;
          }
          .hero-overlay-left {
            top: 28px;
            left: 28px;
            max-width: 400px;
            gap: 14px;
          }
          .hero-callout {
            padding: 18px 22px;
          }
          .hero-line-sm {
            font-size: 18px;
          }
          .hero-line-lg {
            font-size: 36px;
          }
          .hero-line-md {
            font-size: 18px;
          }
          .hero-search {
            padding: 10px 14px;
          }
          .hero-search-wrap--bottom {
            bottom: 24px;
            left: 28px;
            right: 28px;
          }
          .hero-search-results {
            max-height: 380px;
          }

          /* Desktop: rink list and ad card sit side by side */
          .rink-list-row {
            flex-direction: row;
            align-items: flex-start;
          }
          .rink-ad-col {
            width: 240px;
            flex-shrink: 0;
          }
        }
      `}</style>
      <Footer />
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </PageShell>
  )
}

function RinkCard({ rink }: { rink: RinkResult }) {
  const id = rink.rink_id || rink.id || ''
  const name = rink.rink_name || rink.name
  const reviewCount = rink.total_reviews !== undefined ? rink.total_reviews : (rink.review_count !== undefined ? rink.review_count : 0)
  const tier = (rink.confidence_tier || 'NO_DATA').toLowerCase()
  const thumbnail = thumbnailForRink(id)

  const tierLabels: Record<string, string> = {
    trusted: 'Trusted',
    established: 'Established',
    emerging: 'Emerging',
    single_voice: '1 reviewer',
    no_data: 'No reviews',
  }

  const tierClass: Record<string, string> = {
    trusted: 'trusted',
    established: 'trusted',
    emerging: 'emerging',
    single_voice: 'single',
    no_data: 'nodata',
  }

  return (
    <Link href={'/rink/' + id} style={{ textDecoration: 'none' }}>
      <div className="clay-card" style={{ padding: '10px 12px', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center' }}>
        <img
          src={thumbnail}
          alt=""
          style={{ width: 48, height: 48, borderRadius: 8, border: 'var(--rr-outline-sm)', objectFit: 'cover', flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent:'space-between', alignItems: 'flex-start', gap: 6 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 13, color: 'var(--rr-navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name}
            </div>
            <span className={'tier-chip tier-chip--' + (tierClass[tier] || 'nodata')} style={{ flexShrink: 0 }}>
              {tierLabels[tier] || 'No reviews'}
            </span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(13,42,74,0.5)' }}>
            {rink.city}, {rink.state} - {reviewCount} reviews
          </div>
        </div>
      </div>
    </Link>
  )
}
