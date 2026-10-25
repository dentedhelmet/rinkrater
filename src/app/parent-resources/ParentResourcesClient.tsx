'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import styles from './ParentResources.module.css'
import { TipsPreview } from '@/components/tips/TipsPreview'
import ShareTipModal from '@/components/tips/ShareTipModal'
import type { TipCategory } from '@/lib/parentTips'

/* ------------------------------------------------------------------
   OUTBOUND LINKS
   Every external link on this page lives here, so they're easy to
   check each season. We only LINK to USA Hockey's resources; we never
   copy their text, host their PDFs, or use their logo.
   Last verified: Oct 24, 2026.
------------------------------------------------------------------- */
const LINKS = {
  learnToPlay: 'https://learntoplay.nhl.com/about',
  findHockeyNearYou: 'http://www.comeplayyouthhockey.com/',
  whyHockey: 'https://www.usahockey.com/comeplayyouthhockey',
  newParents: 'https://www.usahockey.com/newparents',
  registration: 'https://membership.usahockey.com',
  parentHandbook:
    'https://read.uberflip.com/i/1546662-usa-hockey-new-parent-handbook-2026-27/0?',
  parentModule: 'https://rise.articulate.com/share/mWgDAWYfLDF7u3qdgJ443pNCFYooVmST',
  girlsHockey: 'https://www.usahockey.com/girlshockey',
  disabledHockey: 'https://www.usahockey.com/disabledhockey',
  admKids: 'https://www.admkids.com',
  playerSafety: 'https://www.usahockey.com/playersafety',
  safeSport: 'https://www.usahockey.com/uscenterforsafesport',
  // TODO: swap these two for the exact button URLs from USA Hockey's
  // "First Strides As A Hockey Parent" section.
  howToDress: 'https://www.youtube.com/USAHOCKEYHQ',
  pureHockeyFitting: 'http://www.purehockey.com/',
} as const

/* ------------------------------------------------------------------
   CONTENT
------------------------------------------------------------------- */
type Resource = {
  title: string
  blurb: string
  href: string
  source: string
}

type Period = {
  id: string
  label: string
  name: string
  emoji: string
  /** Optional round badge image; shown instead of the emoji. */
  iconSrc?: string
  tip: string
  resources: Resource[]
}

const PERIODS: Period[] = [
  {
    id: 'try',
    label: '1st Period',
    name: 'Try It',
    emoji: '⛸️',
    iconSrc: '/category-icons/rr-skatesharpening_icon.png',
    tip: "Don't buy a single thing yet. Let your kid try it first. Beginner learn-to-play programs are made for exactly this, and many even fit your kid with gear. You'll know in about ten minutes whether that grin is real. Bring a warm coat for yourself. Trust me on that one.",
    resources: [
      {
        title: 'NHL/NHLPA Learn to Play',
        blurb: 'A beginner program for first-time players ages 4 to 9, with head-to-toe gear included. Find one near you.',
        href: LINKS.learnToPlay,
        source: 'learntoplay.nhl.com',
      },
      {
        title: 'Find Hockey Near You',
        blurb: 'Look up youth programs in your area when you are ready for the next step.',
        href: LINKS.findHockeyNearYou,
        source: 'comeplayyouthhockey.com',
      },
      {
        title: 'Why Hockey?',
        blurb: "USA Hockey's case for why the game is worth it. Spoiler: it's more than a game.",
        href: LINKS.whyHockey,
        source: 'usahockey.com',
      },
    ],
  },
  {
    id: 'sign',
    label: '2nd Period',
    name: 'Sign Up',
    emoji: '📝',
    tip: "Most youth programs need your player to have a USA Hockey membership, and it renews every season. Your club will tell you when. Then grab a coffee and skim the New Parent Handbook. It answers about 80% of the questions you'll be too shy to ask in the lobby.",
    resources: [
      {
        title: 'Join the USA Hockey Family',
        blurb: 'Player registration through USA Hockey membership.',
        href: LINKS.registration,
        source: 'membership.usahockey.com',
      },
      {
        title: 'New Parent Handbook',
        blurb: "USA Hockey's handbook for families starting out, updated for the current season.",
        href: LINKS.parentHandbook,
        source: 'USA Hockey',
      },
      {
        title: 'Welcome to the Game',
        blurb: "USA Hockey's starting page for brand-new hockey parents.",
        href: LINKS.newParents,
        source: 'usahockey.com',
      },
      {
        title: 'Parent Module',
        blurb: 'A self-paced walkthrough for parents from USA Hockey. Good for a quiet evening.',
        href: LINKS.parentModule,
        source: 'USA Hockey',
      },
    ],
  },
  {
    id: 'gear',
    label: '3rd Period',
    name: 'Gear Up',
    emoji: '🎒',
    tip: "Here's where it gets real. It's a LOT of gear, and none of it should be 'room to grow' big. Loose gear doesn't protect. Get fitted in person if you can, ask your club about used gear swaps, and practice dressing your kid at home before the first ice time. Your first locker room shouldn't be your first try.",
    resources: [
      {
        title: 'How to Dress a Youth Hockey Player',
        blurb: 'Step-by-step help for getting it all on in the right order.',
        href: LINKS.howToDress,
        source: 'USA Hockey',
      },
      {
        title: 'Equipment Fitting Guides',
        blurb: "Sizing help from Pure Hockey, USA Hockey's official equipment retailer.",
        href: LINKS.pureHockeyFitting,
        source: 'purehockey.com',
      },
    ],
  },
  {
    id: 'safe',
    label: 'Overtime',
    name: 'Stay Safe & Sane',
    emoji: '🛡️',
    tip: "Know the safety basics before you need them. Concussion signs, neck guards, and SafeSport. And for your own sanity, remember why they're out there. It's supposed to be fun. Cheer for effort, let the coach coach, and save the car-ride breakdown for never.",
    resources: [
      {
        title: 'Player Health & Safety',
        blurb: 'Concussion info, neck laceration protectors, emergency response and more.',
        href: LINKS.playerSafety,
        source: 'usahockey.com',
      },
      {
        title: 'What Is SafeSport?',
        blurb: 'How kids are protected in sport, and what every parent should know.',
        href: LINKS.safeSport,
        source: 'usahockey.com',
      },
      {
        title: 'ADM Kids',
        blurb: "USA Hockey's site on age-appropriate development, written for parents.",
        href: LINKS.admKids,
        source: 'admkids.com',
      },
    ],
  },
]

// iconSrc: round badge in public/tip-icons/. `icon` is the emoji fallback.
type Truth = { id: string; icon: string; iconSrc: string; title: string; teaser: string; answer: string }

const TRUTHS: Truth[] = [
  {
    id: 'gear',
    icon: '🧤',
    iconSrc: '/tip-icons/glove.png',
    title: 'The Gear',
    teaser: 'How much stuff are we talking?',
    answer:
      "Head to toe, plus a bag that'll take up your whole trunk. The good news: kids outgrow it fast, so used gear is everywhere. Ask your club about swaps before you buy new. Just don't go used on the helmet without checking it carefully.",
  },
  {
    id: 'time',
    icon: '⏰',
    iconSrc: '/tip-icons/time.png',
    title: 'The Time',
    teaser: 'Why is practice at 6 a.m.?',
    answer:
      "Ice time is precious, so you take what you get. Early mornings, late nights, and weekend games two towns over. Get a travel mug. Get a good playlist. Make friends with the other parents, because carpools will save your life.",
  },
  {
    id: 'cost',
    icon: '💵',
    iconSrc: '/tip-icons/cash.png',
    title: 'The Cost',
    teaser: "Can we actually afford this?",
    answer:
      "Hockey isn't cheap, and nobody should pretend it is. Start small with a learn-to-skate or learn-to-play program before committing to a full season. Then ask your club straight up about fees, payment plans and scholarships. You won't be the first to ask.",
  },
  {
    id: 'energy',
    icon: '🔋',
    iconSrc: '/tip-icons/energy.png',
    title: 'The Energy',
    teaser: "Who's going to be tired here?",
    answer:
      "Both of you. Pack snacks for the ride home, keep a spare set of everything in the car, and give yourself grace when the skates go on the wrong feet. Everybody's been there. Literally everybody.",
  },
  {
    id: 'commit',
    icon: '🤝',
    iconSrc: '/tip-icons/commitment.png',
    title: 'The Commitment',
    teaser: 'Is it worth it?',
    answer:
      "Watching your kid fall down, get up, and fall down again until they don't... yes. It's worth it. The friendships, the teammates, the lobby crew. You're not just signing up your kid. You're joining a whole family.",
  },
]

/* Pack the Bag: add items anywhere in these two lists. Give each a new,
   unique id. Parents' saved checkmarks are keyed by id, so never reuse
   or rename an existing id. */
type GearItem = { id: string; label: string; note?: string }

const GEAR_ON_PLAYER: GearItem[] = [
  { id: 'helmet', label: 'Helmet with full face cage' },
  { id: 'neck', label: 'Neck guard', note: 'Required by USA Hockey for youth players' },
  { id: 'shoulder', label: 'Shoulder pads' },
  { id: 'elbow', label: 'Elbow pads' },
  { id: 'gloves', label: 'Hockey gloves' },
  { id: 'jock', label: 'Jock or jill (protective cup)' },
  { id: 'pants', label: 'Hockey pants' },
  { id: 'shins', label: 'Shin guards' },
  { id: 'socks', label: 'Hockey socks' },
  { id: 'skates', label: 'Skates (sharpened!)' },
  { id: 'jersey', label: 'Practice jersey' },
]

const GEAR_IN_BAG: GearItem[] = [
  { id: 'stick', label: 'Stick' },
  { id: 'bottle', label: 'Water bottle, labeled with a name' },
  { id: 'guards', label: 'Skate guards' },
  { id: 'tape', label: 'Stick tape and sock tape' },
  { id: 'towel', label: 'Towel to dry blades' },
  { id: 'laces', label: 'Spare laces' },
  { id: 'jacket', label: "A warm coat for YOU" },
]

const ALL_GEAR = [...GEAR_ON_PLAYER, ...GEAR_IN_BAG]

const RINK_INFO = [
  { icon: '📍', label: 'Location & parking' },
  { icon: '❄️', label: 'Rink temp' },
  { icon: '🍴', label: 'Concessions' },
  { icon: '🛍️', label: 'Pro shop' },
  { icon: '⛸️', label: 'Skate sharpening' },
  { icon: '💬', label: 'Real reviews from parents' },
]

const STORAGE_GEAR = 'rr-parent-gear-v1'
const STORAGE_PERIODS = 'rr-parent-periods-v1'

/* ------------------------------------------------------------------
   HELPERS
------------------------------------------------------------------- */
function readStored(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

function writeStored(key: string, value: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage blocked: the page still works, it just won't remember */
  }
}

function ExternalLink({ resource }: { resource: Resource }) {
  return (
    <a className={styles.resourceCard} href={resource.href} target="_blank" rel="noopener noreferrer">
      <span className={styles.resourceTitle}>
        {resource.title}
        <span aria-hidden="true" className={styles.arrow}>
          ↗
        </span>
      </span>
      <span className={styles.resourceBlurb}>{resource.blurb}</span>
      <span className={styles.resourceSource}>
        {resource.source}
        <span className={styles.srOnly}> (opens in a new tab)</span>
      </span>
    </a>
  )
}

/** Card icon image; falls back to the emoji if the file can't load. */
function TruthIcon({ src, fallback }: { src: string; fallback: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <span className={styles.slideIcon} aria-hidden="true">
        {fallback}
      </span>
    )
  }
  return (
    <Image
      src={src}
      alt=""
      aria-hidden="true"
      width={80}
      height={80}
      className={styles.slideIconImg}
      onError={() => setFailed(true)}
    />
  )
}

/* ------------------------------------------------------------------
   PAGE
------------------------------------------------------------------- */
export default function ParentResourcesClient() {
  const [activePeriod, setActivePeriod] = useState(0)
  const [donePeriods, setDonePeriods] = useState<string[]>([])
  const [packed, setPacked] = useState<string[]>([])
  const [flippedCards, setFlippedCards] = useState<string[]>([])
  const [activeSlide, setActiveSlide] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareCategory, setShareCategory] = useState<TipCategory | undefined>(undefined)

  const openShare = (category?: TipCategory) => {
    setShareCategory(category)
    setShareOpen(true)
  }
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const trackRef = useRef<HTMLUListElement | null>(null)

  const toggleFlip = useCallback((id: string) => {
    setFlippedCards((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
  }, [])

  const scrollToSlide = useCallback((index: number) => {
    const track = trackRef.current
    if (!track) return
    const clamped = Math.max(0, Math.min(TRUTHS.length - 1, index))
    const slide = track.children[clamped] as HTMLElement | undefined
    if (!slide) return
    const reduceMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    track.scrollTo({ left: slide.offsetLeft - track.offsetLeft, behavior: reduceMotion ? 'auto' : 'smooth' })
    setActiveSlide(clamped)
  }, [])

  const onTrackScroll = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const first = track.children[0] as HTMLElement | undefined
    if (!first) return
    const gap = parseFloat(getComputedStyle(track).columnGap || '0') || 0
    const step = first.offsetWidth + gap
    const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4
    const index = atEnd ? TRUTHS.length - 1 : Math.round(track.scrollLeft / step)
    setActiveSlide(Math.max(0, Math.min(TRUTHS.length - 1, index)))
  }, [])

  useEffect(() => {
    setDonePeriods(readStored(STORAGE_PERIODS))
    setPacked(readStored(STORAGE_GEAR))
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (loaded) writeStored(STORAGE_PERIODS, donePeriods)
  }, [donePeriods, loaded])

  useEffect(() => {
    if (loaded) writeStored(STORAGE_GEAR, packed)
  }, [packed, loaded])

  const togglePeriodDone = useCallback((id: string) => {
    setDonePeriods((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]))
  }, [])

  const toggleGear = useCallback((id: string) => {
    setPacked((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]))
  }, [])

  const onTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | null = null
    if (e.key === 'ArrowRight') next = (index + 1) % PERIODS.length
    if (e.key === 'ArrowLeft') next = (index - 1 + PERIODS.length) % PERIODS.length
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = PERIODS.length - 1
    if (next !== null) {
      e.preventDefault()
      setActivePeriod(next)
      tabRefs.current[next]?.focus()
    }
  }

  const period = PERIODS[activePeriod]
  const packedCount = ALL_GEAR.filter((g) => packed.includes(g.id)).length
  const packedPct = Math.round((packedCount / ALL_GEAR.length) * 100)
  const allPacked = packedCount === ALL_GEAR.length
  const periodsDone = PERIODS.filter((p) => donePeriods.includes(p.id)).length

  return (
    <main className={styles.page}>
      {/* ---------------- HERO ---------------- */}
      <section className={styles.hero} aria-labelledby="pr-title">
        <div className={styles.heroImageWrap}>
          <Image
            src="/images/tjs-mom-header.jpg"
            alt="TJ's Mom, Rink Rater's hockey mom, gives a thumbs-up outside a snowy ice rink next to a sign listing location, rink temp, concessions, pro shop and skate sharpening."
            fill
            priority
            sizes="100vw"
            className={styles.heroImage}
          />
        </div>
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>Hockey Parent Resources</p>
          <h1 id="pr-title" className={styles.h1}>
            Welcome to the Rink Family
          </h1>
          <div className={styles.bubble}>
            <p>
              Hi, I&apos;m <strong>TJ&apos;s Mom</strong>. If you&apos;re new to hockey and the hockey community,
              it&apos;s just awesome! There&apos;s so much to know when you&apos;re starting out as a Hockey Mom or
              Dad, and I&apos;m here to share some insights.
            </p>
          </div>
        </div>
      </section>

      {/* ---------------- HOCKEY PARENTING 101 (carousel) ---------------- */}
      <section
        className={styles.section}
        aria-labelledby="h101-title"
        aria-roledescription="carousel"
      >
        <div className={styles.carouselHeader}>
          <div>
            <h2 id="h101-title" className={styles.h2}>
              Hockey Parenting 101
            </h2>
            <p className={styles.lede}>
              Swipe through, then flip a card for TJ&apos;s Mom&apos;s real talk.
            </p>
          </div>
          <div className={styles.carouselArrows}>
            <button
              type="button"
              className={styles.arrowButton}
              onClick={() => scrollToSlide(activeSlide - 1)}
              disabled={activeSlide === 0}
              aria-label="Previous card"
            >
              <span aria-hidden="true">←</span>
            </button>
            <button
              type="button"
              className={styles.arrowButton}
              onClick={() => scrollToSlide(activeSlide + 1)}
              disabled={activeSlide === TRUTHS.length - 1}
              aria-label="Next card"
            >
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>

        <ul ref={trackRef} className={styles.carouselTrack} onScroll={onTrackScroll}>
          {TRUTHS.map((t, i) => {
            const flipped = flippedCards.includes(t.id)
            return (
              <li
                key={t.id}
                className={styles.slide}
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${TRUTHS.length}: ${t.title}`}
              >
                <div className={`${styles.flipCard} ${flipped ? styles.flipped : ''}`}>
                  <div className={`${styles.face} ${styles.faceFront}`} aria-hidden={flipped}>
                    <TruthIcon src={t.iconSrc} fallback={t.icon} />
                    <p className={styles.slideTitle}>{t.title}</p>
                    <p className={styles.slideTeaser}>{t.teaser}</p>
                    <button
                      type="button"
                      className={styles.flipButton}
                      onClick={() => toggleFlip(t.id)}
                      tabIndex={flipped ? -1 : 0}
                    >
                      Ask TJ&apos;s Mom
                    </button>
                  </div>
                  <div className={`${styles.face} ${styles.faceBack}`} aria-hidden={!flipped}>
                    <p className={styles.backBy}>TJ&apos;s Mom says</p>
                    <p className={styles.backAnswer}>{t.answer}</p>
                    <button
                      type="button"
                      className={styles.flipBackButton}
                      onClick={() => toggleFlip(t.id)}
                      tabIndex={flipped ? 0 : -1}
                    >
                      Flip back
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>

        <div className={styles.dots}>
          {TRUTHS.map((t, i) => (
            <button
              key={t.id}
              type="button"
              className={`${styles.dot} ${i === activeSlide ? styles.dotActive : ''}`}
              onClick={() => scrollToSlide(i)}
              aria-label={`Go to card ${i + 1}: ${t.title}`}
              aria-current={i === activeSlide ? 'true' : undefined}
            />
          ))}
        </div>
      </section>

      {/* ---------------- GAME PLAN ---------------- */}
      <section className={`${styles.section} ${styles.iceBand}`} aria-labelledby="plan-title">
        <div className={styles.planHeader}>
          <div>
            <h2 id="plan-title" className={styles.h2}>
              Your rookie season game plan
            </h2>
            <p className={styles.lede}>Four periods. Take them one at a time.</p>
          </div>
          <div className={styles.scoreboard} aria-live="polite">
            <span className={styles.scoreLabel}>Periods done</span>
            <span className={styles.scoreValue}>
              {periodsDone}
              <span className={styles.scoreOf}>/{PERIODS.length}</span>
            </span>
          </div>
        </div>

        <div role="tablist" aria-label="Rookie season periods" className={styles.tabs}>
          {PERIODS.map((p, i) => {
            const selected = i === activePeriod
            const done = donePeriods.includes(p.id)
            return (
              <button
                key={p.id}
                ref={(el) => {
                  tabRefs.current[i] = el
                }}
                role="tab"
                type="button"
                id={`tab-${p.id}`}
                aria-selected={selected}
                aria-controls={`panel-${p.id}`}
                tabIndex={selected ? 0 : -1}
                className={`${styles.tab} ${selected ? styles.tabActive : ''}`}
                onClick={() => setActivePeriod(i)}
                onKeyDown={(e) => onTabKeyDown(e, i)}
              >
                <span className={styles.tabLabel}>{p.label}</span>
                <span className={styles.tabName}>
                  {p.name}
                  {done && (
                    <span className={styles.tabCheck} aria-label="(done)">
                      ✓
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>

        <div
          role="tabpanel"
          id={`panel-${period.id}`}
          aria-labelledby={`tab-${period.id}`}
          className={styles.panel}
          tabIndex={0}
        >
          <div className={styles.tipRow}>
            {period.iconSrc ? (
              <Image
                src={period.iconSrc}
                alt=""
                aria-hidden="true"
                width={54}
                height={54}
                className={styles.tipIconImg}
              />
            ) : (
              <span className={styles.tipEmoji} aria-hidden="true">
                {period.emoji}
              </span>
            )}
            <div className={styles.tipBubble}>
              <p className={styles.tipBy}>TJ&apos;s Mom says</p>
              <p>{period.tip}</p>
            </div>
          </div>

          <div className={styles.resourceGrid}>
            {period.resources.map((r) => (
              <ExternalLink key={r.title} resource={r} />
            ))}
          </div>

          <label className={styles.doneToggle}>
            <input
              type="checkbox"
              checked={donePeriods.includes(period.id)}
              onChange={() => togglePeriodDone(period.id)}
            />
            <span>
              We&apos;ve got the {period.label.toLowerCase()} covered
            </span>
          </label>
        </div>
      </section>

      {/* ---------------- GEAR BAG ---------------- */}
      <section className={styles.section} aria-labelledby="gear-title">
        <h2 id="gear-title" className={styles.h2}>
          Pack the bag
        </h2>
        <p className={styles.lede}>
          Check things off the night before. Your list stays saved on this device, so you can use it before every
          practice.
        </p>

        <div className={styles.progressWrap}>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={ALL_GEAR.length}
            aria-valuenow={packedCount}
            aria-label="Gear packed"
          >
            <div className={styles.progressFill} style={{ width: `${packedPct}%` }} />
            <span className={styles.puck} style={{ left: `${packedPct}%` }} aria-hidden="true" />
          </div>
          <p className={styles.progressText} aria-live="polite">
            {allPacked
              ? "Bag's packed. Now go find the car keys. 🏒"
              : `${packedCount} of ${ALL_GEAR.length} packed`}
          </p>
        </div>

        <div className={styles.gearColumns}>
          <fieldset className={styles.gearGroup}>
            <legend className={styles.gearLegend}>On the player, head to toe</legend>
            {GEAR_ON_PLAYER.map((g) => (
              <label key={g.id} className={styles.gearItem}>
                <input type="checkbox" checked={packed.includes(g.id)} onChange={() => toggleGear(g.id)} />
                <span>
                  {g.label}
                  {g.note && <span className={styles.gearNote}>{g.note}</span>}
                </span>
              </label>
            ))}
          </fieldset>
          <fieldset className={styles.gearGroup}>
            <legend className={styles.gearLegend}>In the bag</legend>
            {GEAR_IN_BAG.map((g) => (
              <label key={g.id} className={styles.gearItem}>
                <input type="checkbox" checked={packed.includes(g.id)} onChange={() => toggleGear(g.id)} />
                <span>{g.label}</span>
              </label>
            ))}
            <button type="button" className={styles.resetButton} onClick={() => setPacked([])}>
              Unpack and start over
            </button>
          </fieldset>
        </div>
        <p className={styles.smallPrint}>
          Missing something from the list?{' '}
          <button type="button" className={styles.inlineLink} onClick={() => openShare('gear')}>
            Share it as a Gear tip
          </button>{' '}
          and help the next family pack smarter.
        </p>
        <p className={styles.smallPrint}>
          Your program may have its own requirements. When in doubt, ask your coach, and see USA Hockey&apos;s{' '}
          <a href={LINKS.playerSafety} target="_blank" rel="noopener noreferrer">
            Player Health &amp; Safety page
            <span className={styles.srOnly}> (opens in a new tab)</span>
          </a>
          .
        </p>
      </section>

      {/* ---------------- FROM THE RINK FAMILY (parent tips) ---------------- */}
      <section className={`${styles.section} ${styles.iceBand}`} aria-labelledby="family-tips-title">
        <h2 id="family-tips-title" className={styles.h2}>
          From the Rink Family
        </h2>
        <p className={styles.lede}>
          Tips from hockey moms and dads, for hockey moms and dads. Nutrition, workouts, skills, camps, gear
          and rink life. What do you wish someone had told you?
        </p>
        <TipsPreview onShare={() => openShare()} />
      </section>

      {/* ---------------- RINK RATER TIE-IN ---------------- */}
      <section className={`${styles.section} ${styles.navyBand}`} aria-labelledby="rink-title">
        <h2 id="rink-title" className={`${styles.h2} ${styles.onNavy}`}>
          Plan smart. Play hard.
        </h2>
        <p className={`${styles.lede} ${styles.onNavy}`}>
          Before that first practice, look up the rink. Other hockey parents have already told us what you&apos;ll
          want to know.
        </p>
        <ul className={styles.rinkChips}>
          {RINK_INFO.map((r) => (
            <li key={r.label} className={styles.rinkChip}>
              <span aria-hidden="true">{r.icon}</span> {r.label}
            </li>
          ))}
        </ul>
        <Link href="/" className={styles.cta}>
          Look up your rink
        </Link>
      </section>

      {/* ---------------- MORE WAYS TO PLAY ---------------- */}
      <section className={styles.section} aria-labelledby="more-title">
        <h2 id="more-title" className={styles.h2}>
          Hockey is for everyone
        </h2>
        <div className={styles.resourceGrid}>
          <ExternalLink
            resource={{
              title: "Girls' & Women's Hockey",
              blurb: 'Programs and opportunities for girls getting into the game.',
              href: LINKS.girlsHockey,
              source: 'usahockey.com',
            }}
          />
          <ExternalLink
            resource={{
              title: 'Disabled Hockey',
              blurb: 'Programs for players with disabilities, including sled hockey.',
              href: LINKS.disabledHockey,
              source: 'usahockey.com',
            }}
          />
        </div>
      </section>

      <ShareTipModal isOpen={shareOpen} onClose={() => setShareOpen(false)} initialCategory={shareCategory} />

      {/* ---------------- DISCLAIMER ---------------- */}
      <footer className={styles.disclaimer}>
        <p>
          Rink Rater is not affiliated with or endorsed by USA Hockey. The resources linked on this page belong to
          USA Hockey and their respective owners, and open on their websites. TJ&apos;s Mom&apos;s tips and the
          Rink Family tips are general advice from one hockey parent to another, not professional advice. Always
          follow your program&apos;s and coach&apos;s guidance.
        </p>
      </footer>
    </main>
  )
}
