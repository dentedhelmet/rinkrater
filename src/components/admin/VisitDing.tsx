'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { AnimatedNumber } from '@/components/admin/AnimatedNumber'
import { IGNORE_KEY } from '@/components/analytics/VisitBeacon'

// ─── Types (mirror public.site_visits) ────────────────────────────────────────
interface Visit {
  id:            number
  visit_id:      string
  path:          string
  rink_id:       string | null
  referrer_host: string | null
  device:        'mobile' | 'tablet' | 'desktop' | null
  created_at:    string
}

const FEED_SIZE = 12
const DING_COOLDOWN_MS = 3000        // at most one ding every 3 seconds
const SOUND_PREF_KEY = 'rr-ding-sound'
const DEVICE_ICON: Record<string, string> = { mobile: '📱', desktop: '💻', tablet: '📲' }

type ListenState = 'connecting' | 'live' | 'reconnecting'

// ─── The ding: a short two-partial bell, made in the browser (no audio file) ──
function playDing(ctx: AudioContext, double: boolean) {
  const strike = (at: number) => {
    const master = ctx.createGain()
    master.gain.value = 0.3
    master.connect(ctx.destination)
    const partials: [number, number][] = [[1318.5, 1], [2637, 0.35], [3951, 0.1]]
    for (const [freq, level] of partials) {
      const osc = ctx.createOscillator()
      const env = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      env.gain.setValueAtTime(0.0001, at)
      env.gain.exponentialRampToValueAtTime(level, at + 0.01)
      env.gain.exponentialRampToValueAtTime(0.0001, at + 1.1)
      osc.connect(env).connect(master)
      osc.start(at)
      osc.stop(at + 1.15)
    }
  }
  const now = ctx.currentTime
  strike(now)
  if (double) strike(now + 0.18) // ding-ding when a few people arrive at once
}

// ─── Friendly labels ──────────────────────────────────────────────────────────
function pageLabel(v: Visit, rinkNames: Record<string, string>): string {
  if (v.rink_id) return rinkNames[v.rink_id] ?? 'A rink page'
  if (v.path === '/') return 'Home'
  const first = v.path.split('/')[1] ?? ''
  const pretty: Record<string, string> = {
    blog: 'Blog', chat: 'Ask TJ', nearby: 'Rinks near me', review: 'Write a review',
    profile: 'Profile', 'parent-resources': 'Parent Resources', tips: 'Parent Tips',
    'game-tracker': 'Game Tracker', 'whats-the-call': "What's the Call?", partners: 'Partners',
    shop: 'Shop', about: 'About', contact: 'Contact', share: 'Shared link',
  }
  return pretty[first] ?? v.path
}

function timeAgo(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  return `${h} hr ago`
}

function startOfToday(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

// ─── Panel ────────────────────────────────────────────────────────────────────
export function VisitDing() {
  const reduceMotion = useReducedMotion()
  const [visits, setVisits] = useState<Visit[]>([])
  const [today, setToday] = useState<number | null>(null)
  const [rinkNames, setRinkNames] = useState<Record<string, string>>({})
  const [listen, setListen] = useState<ListenState>('connecting')
  const [soundWanted, setSoundWanted] = useState(false)
  const [armed, setArmed] = useState(false)
  const [burst, setBurst] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [loadError, setLoadError] = useState<string | null>(null)

  const ctxRef = useRef<AudioContext | null>(null)
  const soundWantedRef = useRef(false)
  const lastDingRef = useRef(0)
  const pendingRef = useRef(0)
  const flushTimer = useRef<number | null>(null)
  const hiddenNew = useRef(0)
  const baseTitle = useRef('')
  const knownRinks = useRef<Set<string>>(new Set())

  // This browser belongs to an admin — stop it from dinging itself.
  useEffect(() => {
    try { localStorage.setItem(IGNORE_KEY, '1') } catch { /* fine */ }
  }, [])

  // Restore the sound preference. Browsers won't play audio until you click
  // something on the page, so a saved "on" starts as "click to re-arm".
  useEffect(() => {
    try {
      const wanted = localStorage.getItem(SOUND_PREF_KEY) === 'on'
      setSoundWanted(wanted)
      soundWantedRef.current = wanted
    } catch { /* fine */ }
  }, [])

  const ensureAudio = useCallback(async (): Promise<AudioContext | null> => {
    try {
      if (!ctxRef.current) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!Ctor) return null
        ctxRef.current = new Ctor()
      }
      if (ctxRef.current.state === 'suspended') await ctxRef.current.resume()
      setArmed(ctxRef.current.state === 'running')
      return ctxRef.current
    } catch {
      return null
    }
  }, [])

  // Any click on the page re-arms a saved "sound on" after a reload.
  useEffect(() => {
    if (!soundWanted || armed) return
    const rearm = () => { ensureAudio() }
    window.addEventListener('pointerdown', rearm, { once: true })
    window.addEventListener('keydown', rearm, { once: true })
    return () => {
      window.removeEventListener('pointerdown', rearm)
      window.removeEventListener('keydown', rearm)
    }
  }, [soundWanted, armed, ensureAudio])

  const toggleSound = useCallback(async () => {
    if (soundWanted && armed) {
      setSoundWanted(false)
      soundWantedRef.current = false
      try { localStorage.setItem(SOUND_PREF_KEY, 'off') } catch { /* fine */ }
      return
    }
    const ctx = await ensureAudio()
    setSoundWanted(true)
    soundWantedRef.current = true
    try { localStorage.setItem(SOUND_PREF_KEY, 'on') } catch { /* fine */ }
    if (ctx) playDing(ctx, false) // confirmation ding
  }, [soundWanted, armed, ensureAudio])

  // Ding, at most once per cooldown; extra arrivals roll into a "+N" burst.
  const ding = useCallback(() => {
    pendingRef.current += 1
    const fire = () => {
      flushTimer.current = null
      const count = pendingRef.current
      if (count === 0) return
      pendingRef.current = 0
      lastDingRef.current = Date.now()
      setBurst(count)
      const ctx = ctxRef.current
      if (soundWantedRef.current && ctx && ctx.state === 'running') playDing(ctx, count > 1)
    }
    const wait = DING_COOLDOWN_MS - (Date.now() - lastDingRef.current)
    if (wait <= 0) fire()
    else if (flushTimer.current === null) flushTimer.current = window.setTimeout(fire, wait)
  }, [])

  useEffect(() => () => { if (flushTimer.current) window.clearTimeout(flushTimer.current) }, [])

  // Look up rink names for rink pages in the feed (rinks are public).
  const resolveRinks = useCallback(async (ids: (string | null)[]) => {
    const missing = Array.from(new Set(ids.filter((id): id is string => !!id && !knownRinks.current.has(id))))
    if (missing.length === 0) return
    missing.forEach((id) => knownRinks.current.add(id))
    const { data } = await supabase.from('rinks').select('id, name').in('id', missing)
    if (data?.length) {
      setRinkNames((prev) => {
        const next = { ...prev }
        for (const r of data as { id: string; name: string }[]) next[r.id] = r.name
        return next
      })
    }
  }, [])

  // Initial feed + today's count.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [feed, count] = await Promise.all([
        supabase.from('site_visits').select('*').order('created_at', { ascending: false }).limit(FEED_SIZE),
        supabase.from('site_visits').select('id', { count: 'exact', head: true }).gte('created_at', startOfToday()),
      ])
      if (cancelled) return
      if (feed.error || count.error) {
        setLoadError((feed.error ?? count.error)!.message)
        return
      }
      const rows = (feed.data ?? []) as Visit[]
      setVisits(rows)
      setToday(count.count ?? 0)
      resolveRinks(rows.map((r) => r.rink_id))
    })()
    return () => { cancelled = true }
  }, [resolveRinks])

  // Live stream of new visitors.
  useEffect(() => {
    const channel = supabase
      .channel('admin-site-visits')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'site_visits' },
        (payload) => {
          const v = payload.new as Visit
          setVisits((prev) => (prev.some((p) => p.id === v.id) ? prev : [v, ...prev].slice(0, FEED_SIZE)))
          if (v.created_at >= startOfToday()) setToday((t) => (t ?? 0) + 1)
          resolveRinks([v.rink_id])
          ding()
          if (document.visibilityState !== 'visible') {
            hiddenNew.current += 1
            if (!baseTitle.current) baseTitle.current = document.title
            document.title = `🔔 ${hiddenNew.current} new — ${baseTitle.current}`
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setListen('live')
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setListen('reconnecting')
      })

    return () => { supabase.removeChannel(channel) }
  }, [ding, resolveRinks])

  // Restore the tab title when you come back to it.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && baseTitle.current) {
        document.title = baseTitle.current
        baseTitle.current = ''
        hiddenNew.current = 0
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  // Keep "x min ago" fresh.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const soundLabel = !soundWanted ? 'Ding is off' : armed ? 'Ding is on' : 'Click to re-arm ding'
  const soundIcon = !soundWanted ? '🔕' : armed ? '🔔' : '⏸️'

  return (
    <section className="clay-card ding-card" aria-labelledby="ding-h">
      <div className="ding-top">
        <div>
          <h2 id="ding-h">
            <span aria-hidden="true">🛎️ </span>Just arrived
            <span className={`listen listen-${listen}`}>
              {listen === 'live' ? 'Listening' : listen === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
            </span>
          </h2>
          <p className="ding-sub">
            Each new visitor dings the moment they land. Keep this tab open.
          </p>
        </div>

        <div className="ding-controls">
          <div className="today" aria-live="polite">
            <strong>{today === null ? '–' : <AnimatedNumber value={today} />}</strong>
            <span>visits today</span>
          </div>
          <button
            type="button"
            className={`sound-btn ${soundWanted && armed ? 'sound-on' : ''}`}
            aria-pressed={soundWanted && armed}
            onClick={toggleSound}
          >
            <span aria-hidden="true">{soundIcon} </span>{soundLabel}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {burst > 0 && (
          <motion.div
            key={`burst-${lastDingRef.current}`}
            className="burst"
            aria-hidden="true"
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.6, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 18 }}
            onAnimationComplete={() => window.setTimeout(() => setBurst(0), 1800)}
          >
            +{burst} {burst === 1 ? 'visitor' : 'visitors'}
          </motion.div>
        )}
      </AnimatePresence>

      {loadError ? (
        <p className="empty" role="alert">
          Couldn&apos;t load visits: {loadError}. Has <code>live_visit_ding.sql</code> been run?
        </p>
      ) : visits.length === 0 ? (
        <p className="empty">No visits recorded yet. The next one will ding.</p>
      ) : (
        <ul className="feed">
          <AnimatePresence initial={false}>
            {visits.map((v) => (
              <motion.li
                key={v.id}
                layout={!reduceMotion}
                initial={reduceMotion ? false : { opacity: 0, x: -14, backgroundColor: 'rgba(74, 222, 128, 0.35)' }}
                animate={{ opacity: 1, x: 0, backgroundColor: 'rgba(74, 222, 128, 0)' }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, backgroundColor: { duration: 2.5 } }}
              >
                <span className="dev" title={v.device ?? 'unknown device'}>
                  <span aria-hidden="true">{DEVICE_ICON[v.device ?? ''] ?? '🖥️'}</span>
                  <span className="sr-only">{v.device ?? 'unknown device'}</span>
                </span>
                <span className="what">
                  <span className="page" title={v.path}>{pageLabel(v, rinkNames)}</span>
                  {v.referrer_host && <span className="from">from {v.referrer_host}</span>}
                </span>
                <time className="when" dateTime={v.created_at}>{timeAgo(v.created_at, now)}</time>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <style jsx>{`
        :global(.ding-card) { position: relative; padding: 18px 20px; margin-bottom: 20px; }
        .ding-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; flex-wrap: wrap; }
        h2 { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 0; font-size: 1.1rem; font-weight: 900; color: var(--rr-navy); }
        .listen { font-size: 0.75rem; font-weight: 800; padding: 3px 10px; border-radius: 999px; }
        .listen-live { background: #dcfce7; color: #14532d; }
        .listen-connecting, .listen-reconnecting { background: #fef3c7; color: #78350f; }
        .ding-sub { margin: 4px 0 0; font-size: 0.85rem; color: rgba(13, 42, 74, 0.78); font-weight: 600; }
        .ding-controls { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
        .today { display: flex; align-items: baseline; gap: 6px; color: var(--rr-navy); }
        .today strong { font-size: 1.8rem; font-weight: 900; line-height: 1; }
        .today span { font-size: 0.85rem; font-weight: 700; }
        .sound-btn {
          min-height: 44px; padding: 0 16px; border-radius: 999px; cursor: pointer;
          font: inherit; font-weight: 800; font-size: 0.9rem;
          border: 2px solid var(--rr-navy); background: #fff; color: var(--rr-navy);
        }
        .sound-btn.sound-on { background: var(--rr-navy); color: #fff; }
        .sound-btn:focus-visible { outline: 3px solid var(--rr-red); outline-offset: 2px; }
        .burst {
          position: absolute; top: 14px; left: 50%; transform: translateX(-50%);
          padding: 6px 14px; border-radius: 999px; background: #4ade80; color: #052e16;
          font-weight: 900; font-size: 0.9rem; pointer-events: none;
        }
        .empty { margin: 14px 0 0; color: rgba(13, 42, 74, 0.78); font-weight: 700; font-size: 0.9rem; }
        .feed { list-style: none; margin: 14px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
        .feed :global(li) {
          display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; align-items: center; gap: 10px;
          padding: 8px 10px; border-radius: 10px; font-size: 0.9rem;
        }
        .dev { font-size: 1.1rem; text-align: center; }
        .what { display: flex; flex-direction: column; min-width: 0; }
        .page { font-weight: 800; color: var(--rr-navy); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .from { font-size: 0.78rem; color: rgba(13, 42, 74, 0.78); }
        .when { font-size: 0.8rem; font-weight: 700; color: rgba(13, 42, 74, 0.78); white-space: nowrap; }
        .sr-only {
          position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
        }
      `}</style>
    </section>
  )
}
