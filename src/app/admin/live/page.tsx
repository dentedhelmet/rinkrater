'use client'

import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { AdminShell } from '@/components/admin/AdminShell'
import { AnimatedNumber } from '@/components/admin/AnimatedNumber'
import { RefreshButton } from '@/components/admin/RefreshButton'
import { VisitDing } from '@/components/admin/VisitDing'

// ─── Types (mirror /api/admin/analytics?scope=detail) ─────────────────────────
interface Detail {
  configured: boolean
  error?:     string
  detail?:    string
  activeNow?: number
  minutes?:   { minutesAgo: number; users: number }[]
  topPages?:  { page: string; users: number }[]
  devices?:   { device: string; users: number }[]
  countries?: { name: string; users: number }[]
  cities?:    { name: string; users: number }[]
  actions?:   { name: string; label: string; count: number }[]
  channels?:  { name: string; sessions: number }[]
  sources?:   { name: string; sessions: number }[]
  landing?:   { page: string; sessions: number }[]
  broken?:    { page: string; views: number }[]
}

const REFRESH_SECONDS = 20
const DEVICE_ICON: Record<string, string> = { mobile: '📱', desktop: '💻', tablet: '📲' }
const ACTION_ICON: Record<string, string> = {
  page_view: '👀', search: '🔎', ask_tj: '💬', review_saved: '📝', sign_up: '🎉', login: '🔑',
}

export default function AdminLivePage() {
  return (
    <AdminShell title="Live Visitors" subtitle="Who's on Rink Rater right now, and how people are finding it." allow={['super_admin']} wide>
      {() => <LiveView />}
    </AdminShell>
  )
}

function LiveView() {
  const reduceMotion = useReducedMotion()
  const [data, setData] = useState<Detail | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [tick, setTick] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(REFRESH_SECONDS)

  const load = useCallback(async () => {
    setRefreshing(true)
    const { data: session } = await supabase.auth.getSession()
    const token = session.session?.access_token
    const res = await fetch('/api/admin/analytics?scope=detail', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: 'no-store',
    })
    const body = (await res.json().catch(() => ({ configured: true, error: 'Bad response from server.' }))) as Detail
    setData(body)
    setTick((t) => t + 1)
    setSecondsLeft(REFRESH_SECONDS)
    setRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Countdown ring → auto refresh while the tab is visible.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      setSecondsLeft((s) => Math.max(s - 1, 0))
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (secondsLeft === 0 && !refreshing) load()
  }, [secondsLeft, refreshing, load])

  if (data && !data.configured) {
    return <p className="clay-card" style={{ padding: 20 }}>Google Analytics isn&apos;t connected yet.</p>
  }

  const minutes = data?.minutes ?? []
  const maxMinute = Math.max(1, ...minutes.map((m) => m.users))
  const deviceTotal = (data?.devices ?? []).reduce((s, d) => s + d.users, 0)
  const ring = 2 * Math.PI * 16

  return (
    <>
      <div className="toolbar">
        <span className="countdown" aria-hidden="true">
          <svg width="40" height="40" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="16" className="ring-bg" />
            <circle
              cx="20" cy="20" r="16"
              className="ring-fg"
              strokeDasharray={ring}
              strokeDashoffset={ring * (1 - secondsLeft / REFRESH_SECONDS)}
            />
          </svg>
          <span className="ring-num">{secondsLeft}</span>
        </span>
        <RefreshButton onClick={load} refreshing={refreshing} label="Refresh now" />
      </div>

      {data?.error && (
        <div className="clay-card error-card" role="alert">
          <strong>{data.error}</strong>
          {data.detail && <p>Google said: {data.detail}</p>}
        </div>
      )}

      {/* ── Instant ding feed (Supabase Realtime) ─────────────────────── */}
      <VisitDing />

      {/* ── Hero: live count + per-minute bars ─────────────────────────── */}
      <section className="clay-card hero" aria-labelledby="live-h">
        <div className="hero-top">
          <h2 id="live-h">
            <span className="dot-wrap" aria-hidden="true">
              {!reduceMotion && (
                <motion.span
                  className="dot-ring"
                  animate={{ scale: [1, 2.6], opacity: [0.6, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                />
              )}
              <span className="dot" />
            </span>
            On the site now
          </h2>
          <span className="hero-sub">active in the last 30 minutes</span>
        </div>
        <div className="hero-num" aria-live="polite">
          {data ? <AnimatedNumber value={data.activeNow ?? 0} /> : '–'}
          <span>{data?.activeNow === 1 ? 'visitor' : 'visitors'}</span>
        </div>
        <div className="spark" aria-hidden="true">
          {minutes.map((m, i) => (
            <motion.span
              key={`${m.minutesAgo}-${tick}`}
              className={`spark-bar ${m.minutesAgo === 0 ? 'spark-now' : ''}`}
              title={`${m.minutesAgo === 0 ? 'This minute' : `${m.minutesAgo} min ago`}: ${m.users}`}
              initial={reduceMotion ? false : { scaleY: 0 }}
              animate={{ scaleY: Math.max(m.users / maxMinute, m.users > 0 ? 0.06 : 0.015) }}
              transition={{ type: 'spring', stiffness: 170, damping: 20, delay: reduceMotion ? 0 : i * 0.01 }}
            />
          ))}
        </div>
        <div className="spark-axis" aria-hidden="true"><span>30 min ago</span><span>15</span><span>now</span></div>

        {(data?.actions?.length ?? 0) > 0 && (
          <div className="actions" aria-label="What people did in the last 30 minutes">
            <AnimatePresence initial={false}>
              {data!.actions!.map((a) => (
                <motion.span
                  key={a.name}
                  layout={!reduceMotion}
                  className="action-chip"
                  initial={reduceMotion ? false : { opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <span aria-hidden="true">{ACTION_ICON[a.name] ?? '•'} </span>
                  <strong><AnimatedNumber value={a.count} duration={0.5} /></strong> {a.label}
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* ── Right now ──────────────────────────────────────────────────── */}
      <h3 className="group-h">Right now</h3>
      <div className="grid">
        <BarList title="Pages being viewed" icon="👀" rows={(data?.topPages ?? []).map((p) => ({ label: p.page, value: p.users }))} tick={tick} empty="Nobody's browsing right this minute." />
        <BarList title="Countries" icon="🌎" rows={(data?.countries ?? []).map((c) => ({ label: c.name, value: c.users }))} tick={tick} />
        <BarList title="Cities" icon="📍" rows={(data?.cities ?? []).map((c) => ({ label: c.name, value: c.users }))} tick={tick} empty="City not available yet." />
        <section className="clay-card panel" aria-labelledby="dev-h">
          <h4 id="dev-h"><span aria-hidden="true">📱 </span>Devices</h4>
          {deviceTotal === 0 ? <p className="empty">No one yet.</p> : (
            <>
              <div className="device-bar" aria-hidden="true">
                {data!.devices!.map((d) => (
                  <motion.span
                    key={`${d.device}-${tick}`}
                    className={`device-seg seg-${d.device}`}
                    initial={reduceMotion ? false : { width: 0 }}
                    animate={{ width: `${(d.users / deviceTotal) * 100}%` }}
                    transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                  />
                ))}
              </div>
              <ul className="device-legend">
                {data!.devices!.map((d) => (
                  <li key={d.device}>
                    <span aria-hidden="true">{DEVICE_ICON[d.device] ?? '🖥️'}</span>
                    <span className="cap">{d.device}</span>
                    <strong>{Math.round((d.users / deviceTotal) * 100)}%</strong>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      {/* ── Last 14 days ──────────────────────────────────────────────── */}
      <h3 className="group-h">How people found Rink Rater · last 14 days</h3>
      <div className="grid">
        <BarList title="Channels" icon="🧭" unit="visits" rows={(data?.channels ?? []).map((c) => ({ label: c.name, value: c.sessions }))} tick={tick} />
        <BarList title="Sources" icon="🔗" unit="visits" rows={(data?.sources ?? []).map((c) => ({ label: c.name === '(direct)' ? 'Direct / typed in' : c.name, value: c.sessions }))} tick={tick} />
        <BarList title="First page they landed on" icon="🛬" unit="visits" rows={(data?.landing ?? []).map((c) => ({ label: c.page, value: c.sessions }))} tick={tick} />
        <BarList
          title="Broken links"
          icon="🚧"
          unit="hits"
          tone="warn"
          rows={(data?.broken ?? []).map((b) => ({ label: b.page, value: b.views }))}
          tick={tick}
          empty="No one has hit a missing page. 🎉"
          footnote="URLs that showed “page not found”. If these look like old rink links, they need redirects."
        />
      </div>

      <style jsx>{`
        .toolbar { display: flex; justify-content: flex-end; align-items: center; gap: 12px; margin-bottom: 12px; }
        .countdown { position: relative; width: 40px; height: 40px; }
        .countdown svg { transform: rotate(-90deg); }
        .ring-bg { fill: none; stroke: rgba(13, 42, 74, 0.12); stroke-width: 4; }
        .ring-fg { fill: none; stroke: var(--rr-navy); stroke-width: 4; stroke-linecap: round; transition: stroke-dashoffset 1s linear; }
        .ring-num {
          position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
          font-size: 0.75rem; font-weight: 900; color: var(--rr-navy);
        }
        :global(.error-card) { padding: 16px; margin-bottom: 16px; border-color: var(--rr-red) !important; color: var(--rr-red); }
        :global(.error-card) p { margin: 6px 0 0; color: var(--rr-navy); font-size: 0.85rem; overflow-wrap: anywhere; }
        :global(.hero) {
          padding: 20px;
          margin-bottom: 20px;
          background: linear-gradient(160deg, #0d2a4a 0%, #16406b 100%) !important;
          color: #fff;
        }
        .hero-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
        h2 { display: flex; align-items: center; gap: 10px; margin: 0; font-size: 1.1rem; font-weight: 900; color: #fff; }
        .dot-wrap { position: relative; width: 14px; height: 14px; }
        .dot, .dot-wrap :global(.dot-ring) { position: absolute; inset: 0; border-radius: 50%; background: #4ade80; }
        .hero-sub { font-size: 0.85rem; font-weight: 700; color: rgba(255, 255, 255, 0.85); }
        .hero-num {
          display: flex; align-items: baseline; gap: 10px; margin: 12px 0 14px;
          font-family: var(--font-display, 'Nunito', sans-serif); font-weight: 900; font-size: 4rem; line-height: 1;
        }
        .hero-num span { font-size: 1.1rem; font-weight: 800; color: rgba(255, 255, 255, 0.85); }
        .spark { display: grid; grid-template-columns: repeat(30, 1fr); gap: 3px; height: 90px; align-items: end; }
        .spark :global(.spark-bar) {
          display: block; height: 100%; background: rgba(255, 255, 255, 0.55);
          border-radius: 3px 3px 0 0; transform-origin: bottom;
        }
        .spark :global(.spark-now) { background: #4ade80; }
        .spark-axis {
          display: flex; justify-content: space-between; margin-top: 6px;
          font-size: 0.75rem; font-weight: 700; color: rgba(255, 255, 255, 0.8);
        }
        .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
        .actions :global(.action-chip) {
          font-size: 0.85rem; font-weight: 700; padding: 6px 12px; border-radius: 999px;
          background: rgba(255, 255, 255, 0.14); color: #fff;
        }
        .group-h { margin: 8px 0 10px; font-weight: 900; color: var(--rr-navy); font-size: 1.05rem; }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 14px;
          margin-bottom: 22px;
        }
        :global(.panel) { padding: 16px; }
        h4 { margin: 0 0 10px; font-weight: 900; color: var(--rr-navy); font-size: 0.95rem; }
        .empty { margin: 0; color: rgba(13, 42, 74, 0.78); font-weight: 700; font-size: 0.9rem; }
        .device-bar { display: flex; height: 18px; border-radius: 999px; overflow: hidden; background: var(--rr-ice, #d6effa); }
        .device-bar :global(.device-seg) { display: block; height: 100%; }
        .device-bar :global(.seg-desktop) { background: var(--rr-navy); }
        .device-bar :global(.seg-mobile) { background: var(--rr-red); }
        .device-bar :global(.seg-tablet) { background: #2a7ab8; }
        .device-legend { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
        .device-legend li { display: flex; align-items: center; gap: 8px; color: var(--rr-navy); }
        .device-legend strong { margin-left: auto; }
        .cap { text-transform: capitalize; font-weight: 700; }
      `}</style>
    </>
  )
}

// ─── Reusable animated bar list ────────────────────────────────────────────────
function BarList({
  title, icon, rows, tick, unit = 'visitors', empty = 'Nothing yet.', tone = 'default', footnote,
}: {
  title:     string
  icon:      string
  rows:      { label: string; value: number }[]
  tick:      number
  unit?:     string
  empty?:    string
  tone?:     'default' | 'warn'
  footnote?: string
}) {
  const reduceMotion = useReducedMotion()
  const max = Math.max(1, ...rows.map((r) => r.value))
  const id = title.replace(/\W+/g, '-').toLowerCase()

  return (
    <section className={`clay-card panel tone-${tone}`} aria-labelledby={id}>
      <h4 id={id}><span aria-hidden="true">{icon} </span>{title}</h4>
      {rows.length === 0 ? (
        <p className="empty">{empty}</p>
      ) : (
        <ul>
          <AnimatePresence initial={false}>
            {rows.map((r) => (
              <motion.li
                key={r.label}
                layout={!reduceMotion}
                initial={reduceMotion ? false : { opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
              >
                <span className="label" title={r.label}>{r.label}</span>
                <span className="track" aria-hidden="true">
                  <motion.span
                    key={`${r.label}-${tick}`}
                    className="fill"
                    initial={reduceMotion ? false : { width: 0 }}
                    animate={{ width: `${(r.value / max) * 100}%` }}
                    transition={{ type: 'spring', stiffness: 150, damping: 22 }}
                  />
                </span>
                <span className="value">
                  {r.value.toLocaleString()}
                  <span className="sr-only"> {unit}</span>
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
      {footnote && <p className="foot">{footnote}</p>}

      <style jsx>{`
        .panel { padding: 16px; }
        h4 { margin: 0 0 10px; font-weight: 900; color: var(--rr-navy); font-size: 0.95rem; }
        .empty { margin: 0; color: rgba(13, 42, 74, 0.78); font-weight: 700; font-size: 0.9rem; }
        ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
        ul :global(li) {
          display: grid;
          grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) auto;
          align-items: center;
          gap: 10px;
          font-size: 0.85rem;
        }
        .label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--rr-navy); }
        .track { height: 10px; border-radius: 999px; background: var(--rr-ice, #d6effa); overflow: hidden; }
        .track :global(.fill) { display: block; height: 100%; border-radius: 999px; background: var(--rr-navy); }
        .tone-warn .track :global(.fill) { background: var(--rr-red); }
        .value { font-weight: 900; color: var(--rr-navy); min-width: 24px; text-align: right; }
        .foot { margin: 10px 0 0; font-size: 0.78rem; color: rgba(13, 42, 74, 0.78); }
        .sr-only {
          position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
        }
      `}</style>
    </section>
  )
}
