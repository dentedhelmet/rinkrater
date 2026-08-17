'use client'

import { useEffect, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// Drop your images in: public/about/timeline/
// (hero.jpg + the 6 era images below). Filenames are just a suggestion —
// rename the `img` values to match whatever you actually save them as.
// ---------------------------------------------------------------------------

type Era = {
  id: string
  pickerLabel: string
  pickerSub: string
  label: string
  title: string
  story: string[]
  quote?: string
  story2?: string[]
  img: string
  alt: string
}

const HERO_IMG = '/about/timeline/hero.jpg'

const ERAS: Era[] = [
  {
    id: '2015',
    pickerLabel: '2015',
    pickerSub: 'The Idea',
    label: 'The Lightbulb Moment',
    title: 'Sitting in the stands, an idea clicks',
    story: [
      'Sitting \u2019in the stands during one of our kids games and absolutely freezing as I had come ill-prepared, I had a thought: \u201cMan, I wish I knew how cold this rink was before we got here!\u201d',
    ],
    quote: '\u201cMan, I wish I knew how cold this rink was before we got here!\u201d',
    story2: [
      'After thinking about possible solutions, I bought the domain name, RinkRater.com, right then and there \u2014 and started jotting down every idea I had.',
    ],
    img: '/about/timeline/2015-domain-purchase.jpg',
    alt: 'Domain purchase confirmation screen for RinkRater.com, shown on an ice rink.',
  },
  {
    id: '2016',
    pickerLabel: '2016',
    pickerSub: 'Building',
    label: 'Sketches to Screens',
    title: 'From notebook scribbles to a real app \u2014 and launch',
    story: [
      'Early sketches turned into wireframes, then mockups \u2014 slowly becoming a real vision for the ultimate rink resource, built specifically for hockey families: help hockey parents, build community, improve every rink.',
      'By the end of 2016, Rink Rater launched \u2014 built for hockey parents, by a hockey parent.',
    ],
    img: '/about/timeline/2016-sketches.jpg',
    alt: 'Desk covered in hand-drawn Rink Rater wireframes, sketchbooks, and feature idea notes.',
  },
  {
    id: '2019',
    pickerLabel: '2019',
    pickerSub: 'Growth',
    label: 'The Community Grows',
    title: 'Reviews rolling in from rinks across North America',
    story: [
      'The community grew fast \u2014 hockey families from Vancouver to Boston, Dallas to Montreal, sharing honest, five-star-and-otherwise reviews about the rinks they knew best.',
    ],
    img: '/about/timeline/2019-growth-map.jpg',
    alt: 'Illustrated map of North America showing hockey parents leaving rink reviews from cities across the continent.',
  },
  {
    id: '2020',
    pickerLabel: '2020',
    pickerSub: 'The Pause',
    label: 'COVID Changes Everything',
    title: 'COVID hits \u2014 and a heartbreaking decision',
    story: [
      'Rinks closed. Tournaments were canceled. Usage dropped dramatically, and unfortunately the app updates became unsustainable \u2014 and Rink Rater had to be pulled down from the App Store and Google Play. I remember the exact moment I had to do it.',
      'But that wasn\u2019t the end of the story. It was just the beginning of the next chapter.',
    ],
    img: '/about/timeline/2020-covid.jpg',
    alt: 'Timeline graphic: 2016 Rink Rater launches, 2020 COVID hits and rinks close, 2020 the app is pulled from app stores \u2014 but this is just the beginning.',
  },
  {
    id: '2024',
    pickerLabel: '2024',
    pickerSub: 'AI Spark',
    label: 'The AI Spark',
    title: 'What if you could just ask?',
    story: [
      'I began learning various AI models and soon had a new vision for Rink Rater: an assistant that reads through thousands of real reviews and gives instant, helpful answers \u2014 like \u201cHow cold is The Ice Haus?\u201d \u2014 backed by real hockey parents\u2019 reviews.',
    ],
    img: '/about/timeline/2024-ask-tj.jpg',
    alt: 'Rink Rater 2.0 concept: Ask TJ Anything, showing a sample question and answers pulled from real parent reviews about rink temperature, concessions, parking, and skate sharpening.',
  },
  {
    id: '2026',
    pickerLabel: '2026',
    pickerSub: 'Reborn',
    label: 'Rink Rater 2.0',
    title: 'Rink Rater 2.0 arrives',
    story: [
      'Now powered by 14,400+ real reviews from hockey parents across North America \u2014 plus a new partnership with For the Love of Hockey.',
      'Ask TJ Anything, earn XP and badges, save your favorite rinks, and get honest reviews on what matters most to hockey families.',
    ],
    img: '/about/timeline/2026-rebirth.jpg',
    alt: 'Rink Rater 2.0 feature overview: Ask TJ Anything, rink streaks and badges, reviews that matter, detailed categories, plan and save, family first \u2014 powered by 14,400+ real reviews, in partnership with My Hockey Rankings and For the Love of Hockey.',
  },
]

const BACK_TO_TOP_TRIGGER_ID = '2019'

export function AboutTimeline() {
  const railTrackRef = useRef<HTMLDivElement>(null)
  const railFillRef = useRef<HTMLDivElement>(null)
  const eraRefs = useRef<Record<string, HTMLElement | null>>({})
  const [activeEra, setActiveEra] = useState<string>(ERAS[0].id)
  const [visibleEras, setVisibleEras] = useState<Set<string>>(new Set())
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null)
  const [showBackToTop, setShowBackToTop] = useState(false)

  // All scroll/observer logic below targets the WINDOW, matching how this
  // app actually scrolls (full page scroll, header included) rather than
  // an internal locked-height container.
  useEffect(() => {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-era-id')
            if (id) setVisibleEras((prev) => new Set(prev).add(id))
          }
        })
      },
      { threshold: 0.15 }
    )

    const spyObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-era-id')
            if (id) setActiveEra(id)
          }
        })
      },
      { threshold: 0, rootMargin: '-45% 0px -50% 0px' }
    )

    Object.values(eraRefs.current).forEach((el) => {
      if (el) {
        revealObserver.observe(el)
        spyObserver.observe(el)
      }
    })

    function updateRail() {
      const track = railTrackRef.current
      const fill = railFillRef.current
      if (!track || !fill) return
      const rect = track.getBoundingClientRect()
      const vh = window.innerHeight
      const total = rect.height
      const scrolled = Math.min(Math.max(vh * 0.4 - rect.top, 0), total)
      const pct = total > 0 ? (scrolled / total) * 100 : 0
      fill.style.height = pct + '%'
    }

    function updateBackToTop() {
      const trigger = eraRefs.current[BACK_TO_TOP_TRIGGER_ID]
      if (!trigger) return
      setShowBackToTop(trigger.getBoundingClientRect().top <= 10)
    }

    window.addEventListener('scroll', updateRail, { passive: true })
    window.addEventListener('scroll', updateBackToTop, { passive: true })
    window.addEventListener('resize', updateRail)
    updateRail()
    updateBackToTop()

    return () => {
      revealObserver.disconnect()
      spyObserver.disconnect()
      window.removeEventListener('scroll', updateRail)
      window.removeEventListener('scroll', updateBackToTop)
      window.removeEventListener('resize', updateRail)
    }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightbox(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  function jumpTo(id: string) {
    eraRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function backToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div>
      {/* ---------------- hero banner ---------------- */}
      <div style={{ margin: '0 -16px 20px' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO_IMG}
          alt="Rink Rater mascot on the ice. Headline: Rink Rater is back on the ice! The story of how a simple idea became the go-to resource for hockey families."
          style={{ width: '100%', display: 'block' }}
        />
      </div>

      {/* ---------------- headline ---------------- */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <span
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(13,42,74,0.06)', color: 'var(--rr-navy)',
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 12,
            letterSpacing: 0.6, textTransform: 'uppercase',
            padding: '7px 14px', borderRadius: 999, marginBottom: 14,
          }}
        >
          <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: '#2E9B5C' }} />
          Our Story
        </span>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 26, color: 'var(--rr-navy)', lineHeight: 1.15, marginBottom: 10 }}>
          How did it all start, <span style={{ color: 'var(--rr-red)' }}>you ask?</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(13,42,74,0.7)', maxWidth: 440, margin: '0 auto' }}>
  Rink Rater was born in the stands! I was freezing! I came quite ill-prepared for how cold this particular rink was (you know the one) and ultimately, that was the reason I literally bought the domain: RinkRater.com right there in the stands! It&rsquo;s been a journey ever since, but one that I felt giving another chance to provide our Hockey Community with a helpful resource, was worth it.
</div>
      </div>

      {/* ---------------- sticky year picker ---------------- */}
      {/* position: sticky here sticks relative to the WINDOW's scroll, since
          nothing between this element and the document is its own scroll
          container. Once GlobalHeader/TopBar scroll out of view above it,
          this docks flush to the top of the viewport \u2014 no offset math needed. */}
      <div
        style={{
          position: 'sticky', top: 0, zIndex: 20,
          background: 'rgba(251,249,244,0.94)', backdropFilter: 'blur(6px)',
          borderBottom: 'var(--rr-outline)',
          margin: '0 -16px 24px', padding: '12px 16px',
          display: 'flex', gap: 8, overflowX: 'auto',
        }}
        className="rr-timeline-picker"
        aria-label="Timeline year picker"
        role="navigation"
      >
        {ERAS.map((era) => {
          const isActive = activeEra === era.id
          return (
            <button
              key={era.id}
              type="button"
              onClick={() => jumpTo(era.id)}
              aria-label={`${era.pickerLabel} \u2014 ${era.pickerSub}`}
              className="rr-timeline-picker-btn"
              style={{
                flex: 'none', minHeight: 44, padding: '8px 14px',
                borderRadius: 999,
                border: `2px solid ${isActive ? 'var(--rr-navy)' : 'rgba(13,42,74,0.14)'}`,
                background: isActive ? 'var(--rr-navy)' : '#fff',
                color: isActive ? '#fff' : 'rgba(13,42,74,0.7)',
                fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13,
                display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.25,
                cursor: 'pointer',
              }}
            >
              {era.pickerLabel}
              <small style={{ fontWeight: 700, fontSize: 10, color: isActive ? 'var(--rr-yellow)' : 'rgba(13,42,74,0.55)' }}>
                {era.pickerSub}
              </small>
            </button>
          )
        })}
      </div>

      {/* ---------------- timeline ---------------- */}
      <div style={{ position: 'relative', paddingLeft: 8 }} ref={railTrackRef}>
        <div
          aria-hidden="true"
          style={{ position: 'absolute', left: 18, top: 6, bottom: 6, width: 4, background: 'rgba(13,42,74,0.12)', borderRadius: 4 }}
        >
          <div
            ref={railFillRef}
            style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '0%',
              background: 'linear-gradient(var(--rr-red), var(--rr-warm))', borderRadius: 4,
              transition: 'height .08s linear',
            }}
          />
        </div>

        {ERAS.map((era) => {
          const isVisible = visibleEras.has(era.id)
          return (
            <section
              key={era.id}
              ref={(el) => { eraRefs.current[era.id] = el }}
              data-era-id={era.id}
              style={{
                position: 'relative', paddingLeft: 52, marginBottom: 40,
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(24px)',
                transition: 'opacity .6s ease, transform .6s ease',
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute', left: 2, top: 0, width: 32, height: 32, borderRadius: '50%',
                  background: isVisible ? 'var(--rr-navy)' : 'var(--rr-red)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 10,
                  border: '3px solid var(--rr-paper, #FBF9F4)', boxShadow: `0 0 0 3px ${isVisible ? 'var(--rr-navy)' : 'var(--rr-red)'}`,
                  zIndex: 2,
                }}
              >
                {era.id}
              </div>

              <div className="clay-card" style={{ padding: 0, overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => setLightbox({ src: era.img, alt: era.alt })}
                  aria-label={`Enlarge image: ${era.label}`}
                  className="rr-timeline-img-btn"
                  style={{ display: 'block', width: '100%', border: 'none', padding: 0, margin: 0, cursor: 'zoom-in', background: 'none', position: 'relative' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={era.img} alt={era.alt} loading="lazy" style={{ width: '100%', display: 'block' }} />
                  <span
                    className="rr-timeline-zoom-hint"
                    style={{
                      position: 'absolute', bottom: 10, right: 10,
                      background: 'rgba(13,42,74,0.82)', color: '#fff',
                      fontSize: 11, fontWeight: 800, padding: '5px 9px', borderRadius: 999,
                    }}
                  >
                    \u2295 Tap to enlarge
                  </span>
                </button>

                <div style={{ padding: '18px 18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ background: 'rgba(13,42,74,0.06)', color: 'var(--rr-navy)', fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 12, padding: '3px 9px', borderRadius: 999 }}>
                      {era.id}
                    </span>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--rr-red)' }}>
                      {era.label}
                    </span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 18, color: 'var(--rr-navy)', marginBottom: 8 }}>
                    {era.title}
                  </div>
                  {era.story.map((p, i) => (
                    <p key={i} style={{ fontSize: 14, lineHeight: 1.55, color: 'rgba(13,42,74,0.75)', fontWeight: 600, margin: '0 0 8px' }}>
                      {p}
                    </p>
                  ))}
                  {era.quote && (
                    <blockquote
                      style={{
                        margin: '8px 0 12px', padding: '10px 14px',
                        background: 'rgba(13,42,74,0.05)', borderLeft: '4px solid var(--rr-warm)',
                        borderRadius: 8, fontStyle: 'italic', fontWeight: 700, color: 'var(--rr-navy)', fontSize: 14,
                      }}
                    >
                      {era.quote}
                    </blockquote>
                  )}
                  {era.story2?.map((p, i) => (
                    <p key={i} style={{ fontSize: 14, lineHeight: 1.55, color: 'rgba(13,42,74,0.75)', fontWeight: 600, margin: 0 }}>
                      {p}
                    </p>
                  ))}
                </div>
              </div>
            </section>
          )
        })}
      </div>

      {/* ---------------- lightbox ---------------- */}
      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Enlarged image"
          onClick={(e) => { if (e.target === e.currentTarget) setLightbox(null) }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(13,42,74,0.9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 200, padding: 20,
          }}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Close enlarged image"
            style={{
              position: 'absolute', top: 18, right: 18, width: 44, height: 44, borderRadius: '50%',
              background: '#fff', border: 'none', fontSize: 18, fontWeight: 900, color: 'var(--rr-navy)', cursor: 'pointer',
            }}
          >
            \u2715
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.src}
            alt={lightbox.alt}
            style={{ maxWidth: 'min(94vw, 900px)', maxHeight: '88vh', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
          />
        </div>
      )}

      {/* ---------------- back to top ---------------- */}
      <button
        type="button"
        onClick={backToTop}
        aria-label="Back to top"
        style={{
          position: 'fixed', right: 18, bottom: 18, zIndex: 40,
          width: 50, height: 50, borderRadius: '50%',
          background: 'var(--rr-navy)', color: '#fff', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 8px 22px rgba(13,42,74,0.35)',
          opacity: showBackToTop ? 1 : 0,
          transform: showBackToTop ? 'translateY(0) scale(1)' : 'translateY(14px) scale(0.9)',
          pointerEvents: showBackToTop ? 'auto' : 'none',
          transition: 'opacity .25s ease, transform .25s ease',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <style jsx>{`
        .rr-timeline-picker::-webkit-scrollbar { display: none; }
        .rr-timeline-picker-btn:hover { border-color: var(--rr-warm); }
        .rr-timeline-picker-btn:focus-visible { outline: 3px solid var(--rr-navy); outline-offset: 2px; }
        .rr-timeline-img-btn:focus-visible { outline: 3px solid var(--rr-navy); outline-offset: -3px; }
        .rr-timeline-zoom-hint { opacity: 0; transition: opacity 0.15s ease; }
        .rr-timeline-img-btn:hover .rr-timeline-zoom-hint,
        .rr-timeline-img-btn:focus-visible .rr-timeline-zoom-hint { opacity: 1; }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
        }
      `}</style>
    </div>
  )
}
