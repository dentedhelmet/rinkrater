'use client'

import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { AnimatedNumber } from './AnimatedNumber'
import { ActivityChart } from './ActivityChart'

// ─── Types (mirror /api/admin/analytics) ───────────────────────────────────────
interface SummaryData {
  configured: boolean
  error?:     string
  days?:      { day: string; users: number; sessions: number; views: number }[]
  totals?:    { users: number; sessions: number; views: number }
}

interface LiveData {
  configured: boolean
  error?:     string
  activeNow?: number
  minutes?:   { minutesAgo: number; users: number }[]
  topPages?:  { page: string; users: number }[]
  devices?:   { device: string; users: number }[]
}

const LIVE_REFRESH_MS = 30_000
const SUMMARY_REFRESH_MS = 5 * 60_000

const DEVICE_ICON: Record<string, string> = { mobile: '📱', desktop: '💻', tablet: '📲' }

async function fetchAnalytics<T>(scope: 'summary' | 'live'): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const res = await fetch(`/api/admin/analytics?scope=${scope}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: 'no-store',
  })
  const body = await res.json().catch(() => ({ configured: true, error: 'Bad response from server.' }))
  if (!res.ok && !body.error) body.error = 'Could not load analytics.'
  return body as T
}

/**
 * Right-hand side of the HQ hub: live visitors (refreshes every 30s) above a
 * 14-day visitors chart (refreshes every 5 min). Pass a bumped `refreshSignal`
 * to force both to reload (the hub's refresh button does this).
 */
export function TrafficPanel({ refreshSignal }: { refreshSignal: number }) {
  const reduceMotion = useReducedMotion()
  const [live, setLive] = useState<LiveData | null>(null)
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [liveKey, setLiveKey] = useState(0)
  const [summaryKey, setSummaryKey] = useState(0)

  const loadLive = useCallback(async () => {
    const data = await fetchAnalytics<LiveData>('live')
    setLive(data)
    setLiveKey((k) => k + 1)
  }, [])

  const loadSummary = useCallback(async () => {
    const data = await fetchAnalytics<SummaryData>('summary')
    setSummary(data)
    setSummaryKey((k) => k + 1)
  }, [])

  useEffect(() => {
    loadLive()
    loadSummary()
  }, [loadLive, loadSummary, refreshSignal])

  useEffect(() => {
    const liveTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') loadLive()
    }, LIVE_REFRESH_MS)
    const summaryTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') loadSummary()
    }, SUMMARY_REFRESH_MS)
    return () => {
      window.clearInterval(liveTimer)
      window.clearInterval(summaryTimer)
    }
  }, [loadLive, loadSummary])

  // ── Not set up yet ──────────────────────────────────────────────────────────
  if (live && !live.configured) {
    return (
      <div className="clay-card setup-card">
        <div className="setup-icon" aria-hidden="true">📈</div>
        <h3>Connect Google Analytics</h3>
        <p>
          Live visitors and 14-day traffic will appear here once the GA service account
          details are added to the site&apos;s environment variables.
        </p>
        <style jsx>{`
          .setup-card { padding: 20px; text-align: center; }
          .setup-icon { font-size: 36px; }
          h3 { margin: 8px 0 6px; font-weight: 900; color: var(--rr-navy); }
          p { margin: 0; color: rgba(13, 42, 74, 0.8); font-size: 0.9rem; }
        `}</style>
      </div>
    )
  }

  const minutes = live?.minutes ?? []
  const maxMinute = Math.max(1, ...minutes.map((m) => m.users))
  const maxPage = Math.max(1, ...(live?.topPages ?? []).map((p) => p.users))
  const deviceTotal = (live?.devices ?? []).reduce((s, d) => s + d.users, 0)

  return (
    <div className="traffic">
      {/* ── Live now ──────────────────────────────────────────────────────── */}
      <section className="clay-card live-card" aria-labelledby="live-heading">
        <div className="live-head">
          <h3 id="live-heading">
            <span className="live-dot-wrap" aria-hidden="true">
              {!reduceMotion && (
                <motion.span
                  className="live-ring"
                  animate={{ scale: [1, 2.4], opacity: [0.6, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                />
              )}
              <span className="live-dot" />
            </span>
            Live now
          </h3>
          <span className="live-sub">last 30 min</span>
        </div>

        {live?.error ? (
          <p className="panel-error" role="alert">{live.error}</p>
        ) : (
          <>
            <div className="live-number" aria-live="polite">
              {live ? <AnimatedNumber value={live.activeNow ?? 0} /> : '–'}
              <span className="live-unit">{live?.activeNow === 1 ? 'visitor' : 'visitors'}</span>
            </div>

            {/* Per-minute sparkline: oldest on the left, now on the right */}
            <div className="spark" aria-hidden="true">
              {minutes.map((m, i) => (
                <motion.span
                  key={`${m.minutesAgo}-${liveKey}`}
                  className={`spark-bar ${m.minutesAgo === 0 ? 'spark-now' : ''}`}
                  initial={reduceMotion ? false : { scaleY: 0 }}
                  animate={{ scaleY: Math.max(m.users / maxMinute, m.users > 0 ? 0.08 : 0.02) }}
                  transition={{ type: 'spring', stiffness: 180, damping: 20, delay: reduceMotion ? 0 : i * 0.012 }}
                />
              ))}
            </div>
            <div className="spark-axis" aria-hidden="true"><span>30 min ago</span><span>now</span></div>

            {(live?.topPages?.length ?? 0) > 0 && (
              <div className="top-pages">
                <h4>What they&apos;re looking at</h4>
                <ul>
                  <AnimatePresence initial={false}>
                    {live!.topPages!.map((p) => (
                      <motion.li
                        key={p.page}
                        layout={!reduceMotion}
                        initial={reduceMotion ? false : { opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                      >
                        <span className="page-name" title={p.page}>{p.page}</span>
                        <span className="page-bar-track" aria-hidden="true">
                          <motion.span
                            className="page-bar"
                            initial={reduceMotion ? false : { width: 0 }}
                            animate={{ width: `${(p.users / maxPage) * 100}%` }}
                            transition={{ type: 'spring', stiffness: 160, damping: 22 }}
                          />
                        </span>
                        <span className="page-count">{p.users}</span>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </div>
            )}

            {deviceTotal > 0 && (
              <div className="devices" aria-label="Visitors by device">
                {live!.devices!.map((d) => (
                  <span key={d.device} className="device-chip">
                    <span aria-hidden="true">{DEVICE_ICON[d.device] ?? '🖥️'} </span>
                    {Math.round((d.users / deviceTotal) * 100)}% {d.device}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Last 14 days ──────────────────────────────────────────────────── */}
      <section className="clay-card" aria-label="Site visitors, last 14 days">
        {summary?.error ? (
          <p className="panel-error summary-error" role="alert">{summary.error}</p>
        ) : summary?.days ? (
          <>
            <ActivityChart
              data={summary.days.map((d) => ({ day: d.day, count: d.users }))}
              refreshKey={summaryKey}
              title="Visitors, last 14 days"
              unit="visitors"
              accent="blue"
              totalLabel={`${(summary.totals?.users ?? 0).toLocaleString()} unique`}
            />
            <div className="summary-stats">
              <div>
                <span className="stat-num"><AnimatedNumber value={summary.totals?.sessions ?? 0} /></span>
                <span className="stat-label">visits</span>
              </div>
              <div>
                <span className="stat-num"><AnimatedNumber value={summary.totals?.views ?? 0} /></span>
                <span className="stat-label">page views</span>
              </div>
              <div>
                <span className="stat-num">
                  {summary.totals?.sessions
                    ? (summary.totals.views / summary.totals.sessions).toFixed(1)
                    : '–'}
                </span>
                <span className="stat-label">pages / visit</span>
              </div>
            </div>
          </>
        ) : (
          <div className="summary-loading">Counting the crowd…</div>
        )}
      </section>

      <style jsx>{`
        .traffic {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .traffic :global(.live-card) {
          padding: 16px;
          background: linear-gradient(160deg, #0d2a4a 0%, #16406b 100%);
          color: #fff;
        }
        .live-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        h3 {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 0;
          font-weight: 900;
          font-size: 1rem;
          color: #fff;
        }
        .live-dot-wrap {
          position: relative;
          width: 12px;
          height: 12px;
        }
        .live-dot,
        .live-dot-wrap :global(.live-ring) {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: #4ade80;
        }
        .live-sub {
          font-size: 0.8rem;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.85);
        }
        .live-number {
          display: flex;
          align-items: baseline;
          gap: 8px;
          margin: 10px 0 12px;
          font-family: var(--font-display, 'Nunito', sans-serif);
          font-weight: 900;
          font-size: 3rem;
          line-height: 1;
        }
        .live-unit {
          font-size: 1rem;
          font-weight: 800;
          color: rgba(255, 255, 255, 0.85);
        }
        .spark {
          display: grid;
          grid-template-columns: repeat(30, 1fr);
          gap: 2px;
          height: 48px;
          align-items: end;
        }
        .spark :global(.spark-bar) {
          display: block;
          height: 100%;
          background: rgba(255, 255, 255, 0.55);
          border-radius: 2px 2px 0 0;
          transform-origin: bottom;
        }
        .spark :global(.spark-now) {
          background: #4ade80;
        }
        .spark-axis {
          display: flex;
          justify-content: space-between;
          font-size: 0.72rem;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.8);
          margin-top: 4px;
        }
        .top-pages {
          margin-top: 14px;
        }
        h4 {
          margin: 0 0 8px;
          font-size: 0.85rem;
          font-weight: 900;
          color: #fff;
        }
        ul {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .top-pages :global(li) {
          display: grid;
          grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) auto;
          align-items: center;
          gap: 8px;
          font-size: 0.85rem;
        }
        .page-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #fff;
        }
        .page-bar-track {
          height: 8px;
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.15);
          overflow: hidden;
        }
        .page-bar-track :global(.page-bar) {
          display: block;
          height: 100%;
          background: #4ade80;
          border-radius: 4px;
        }
        .page-count {
          font-weight: 900;
          min-width: 20px;
          text-align: right;
        }
        .devices {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 14px;
        }
        .device-chip {
          font-size: 0.78rem;
          font-weight: 800;
          padding: 4px 10px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.14);
          color: #fff;
          text-transform: capitalize;
        }
        .panel-error {
          margin: 12px 0 0;
          font-weight: 800;
          color: #ffd4da;
        }
        .summary-error {
          padding: 16px;
          margin: 0;
          color: var(--rr-red);
        }
        .summary-loading {
          height: 190px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          color: rgba(13, 42, 74, 0.75);
        }
        .summary-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          border-top: 1px solid rgba(13, 42, 74, 0.1);
          padding: 12px 16px 16px;
          text-align: center;
        }
        .summary-stats > div {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .stat-num {
          font-family: var(--font-display, 'Nunito', sans-serif);
          font-weight: 900;
          font-size: 1.3rem;
          color: var(--rr-navy);
        }
        .stat-label {
          font-size: 0.75rem;
          font-weight: 800;
          color: rgba(13, 42, 74, 0.78);
        }
      `}</style>
    </div>
  )
}
