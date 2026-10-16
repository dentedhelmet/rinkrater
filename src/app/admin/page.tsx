'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import type { AdminRole } from '@/lib/useAdminRole'
import { AdminShell } from '@/components/admin/AdminShell'
import { ADMIN_SECTIONS } from '@/components/admin/adminSections'
import { AnimatedNumber } from '@/components/admin/AnimatedNumber'
import { RefreshButton } from '@/components/admin/RefreshButton'
import { ActivityChart, type ActivityPoint } from '@/components/admin/ActivityChart'

interface DashboardStats {
  pending:   number
  published: number
  removed:   number
  activity:  ActivityPoint[]
}

const AUTO_REFRESH_MS = 60_000

export default function AdminHubPage() {
  return (
    <AdminShell title="Rink Rater HQ" subtitle="Everything behind the boards." showBack={false}>
      {(role) => <HubContent role={role} />}
    </AdminShell>
  )
}

function HubContent({ role }: { role: AdminRole }) {
  const reduceMotion = useReducedMotion()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setRefreshing(true)
    const { data, error: rpcError } = await supabase.rpc('admin_dashboard_stats')
    if (rpcError) {
      console.error('admin_dashboard_stats failed:', rpcError)
      setError('Could not load stats.')
    } else {
      setError(null)
      setStats(data as DashboardStats)
      setRefreshKey((k) => k + 1)
      setUpdatedAt(new Date())
    }
    setRefreshing(false)
  }, [])

  // First load, then a quiet refresh every minute while the tab is visible.
  useEffect(() => {
    load()
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') load()
    }, AUTO_REFRESH_MS)
    return () => window.clearInterval(id)
  }, [load])

  const sections = ADMIN_SECTIONS.filter((s) => s.roles.includes(role))
  const tiles = [
    { label: 'Waiting for review', value: stats?.pending ?? 0,   tone: 'tile-pending', href: '/admin/reviews' },
    { label: 'Live reviews',       value: stats?.published ?? 0, tone: 'tile-live' },
    { label: 'Removed',            value: stats?.removed ?? 0,   tone: 'tile-removed' },
  ]

  return (
    <>
      <div className="toolbar">
        <span className="updated" aria-live="polite">
          {refreshing ? 'Refreshing…' : updatedAt ? `Updated ${updatedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}
        </span>
        <RefreshButton onClick={load} refreshing={refreshing} label="Refresh stats" />
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="tiles">
        {tiles.map((t, i) => {
          const inner = (
            <motion.div
              className={`clay-card tile ${t.tone}`}
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.35 }}
              whileHover={reduceMotion ? undefined : { y: -3 }}
            >
              <motion.span
                key={`${t.label}-${refreshKey}`}
                className="tile-num"
                initial={reduceMotion ? false : { scale: 0.92 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 15 }}
              >
                {stats ? <AnimatedNumber value={t.value} /> : '–'}
              </motion.span>
              <span className="tile-label">{t.label}</span>
            </motion.div>
          )
          return t.href ? (
            <Link key={t.label} href={t.href} className="tile-link" aria-label={`${t.label}: ${t.value}. Open review moderation`}>
              {inner}
            </Link>
          ) : (
            <div key={t.label}>{inner}</div>
          )
        })}
      </div>

      <motion.div
        className="clay-card chart-card"
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.35 }}
      >
        {stats ? (
          <ActivityChart data={stats.activity} refreshKey={refreshKey} />
        ) : (
          <div className="chart-placeholder">Warming up the Zamboni…</div>
        )}
      </motion.div>

      <h2 className="section-heading">Tools</h2>
      <div className="sections">
        {sections.map((s, i) => {
          const badgeCount = s.badge === 'pending' ? stats?.pending ?? 0 : 0
          const card = (
            <motion.div
              className={`clay-card section-card ${s.status === 'soon' ? 'section-soon' : ''}`}
              initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25 + i * 0.05, duration: 0.3 }}
              whileHover={s.status === 'live' && !reduceMotion ? { y: -4, rotate: -0.5 } : undefined}
              whileTap={s.status === 'live' && !reduceMotion ? { scale: 0.98 } : undefined}
            >
              <span className="section-icon" aria-hidden="true">{s.icon}</span>
              <span className="section-text">
                <span className="section-title">{s.title}</span>
                <span className="section-desc">{s.description}</span>
              </span>
              {s.status === 'soon' && <span className="soon-chip">Coming soon</span>}
              {badgeCount > 0 && (
                <motion.span
                  key={`badge-${badgeCount}`}
                  className="count-badge"
                  initial={reduceMotion ? false : { scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 14 }}
                  aria-label={`${badgeCount} waiting`}
                >
                  {badgeCount}
                </motion.span>
              )}
            </motion.div>
          )
          return s.status === 'live' ? (
            <Link key={s.id} href={s.href} className="section-link">{card}</Link>
          ) : (
            <div key={s.id} aria-disabled="true">{card}</div>
          )
        })}
      </div>

      <style jsx>{`
        .toolbar {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }
        .updated {
          font-size: 0.85rem;
          font-weight: 700;
          color: rgba(13, 42, 74, 0.75);
        }
        .error {
          color: var(--rr-red);
          font-weight: 800;
        }
        .tiles {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 16px;
        }
        .tiles :global(.tile-link) {
          text-decoration: none;
          border-radius: 16px;
        }
        .tiles :global(.tile-link:focus-visible),
        .sections :global(.section-link:focus-visible) {
          outline: 3px solid var(--rr-yellow);
          outline-offset: 3px;
        }
        .tiles :global(.tile) {
          padding: 16px 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 4px;
          height: 100%;
          box-sizing: border-box;
        }
        .tiles :global(.tile-num) {
          display: inline-block;
          font-family: var(--font-display, 'Nunito', sans-serif);
          font-weight: 900;
          font-size: 2rem;
          line-height: 1.1;
        }
        .tiles :global(.tile-label) {
          font-size: 0.8rem;
          font-weight: 800;
          color: rgba(13, 42, 74, 0.8);
        }
        .tiles :global(.tile-pending .tile-num) { color: var(--rr-red); }
        .tiles :global(.tile-live .tile-num)    { color: var(--rr-navy); }
        .tiles :global(.tile-removed .tile-num) { color: rgba(13, 42, 74, 0.75); }
        :global(.chart-card) {
          margin-bottom: 24px;
        }
        .chart-placeholder {
          height: 190px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          color: rgba(13, 42, 74, 0.75);
        }
        .section-heading {
          font-weight: 900;
          color: var(--rr-navy);
          font-size: 1.1rem;
          margin: 0 0 10px;
        }
        .sections {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 12px;
        }
        .sections :global(.section-link) {
          text-decoration: none;
          border-radius: 16px;
        }
        .sections :global(.section-card) {
          position: relative;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          min-height: 76px;
          height: 100%;
          box-sizing: border-box;
        }
        .sections :global(.section-soon) {
          opacity: 0.6;
        }
        .sections :global(.section-icon) {
          font-size: 30px;
          flex-shrink: 0;
        }
        .sections :global(.section-text) {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
          min-width: 0;
        }
        .sections :global(.section-title) {
          font-weight: 900;
          color: var(--rr-navy);
        }
        .sections :global(.section-desc) {
          font-size: 0.82rem;
          color: rgba(13, 42, 74, 0.78);
        }
        .sections :global(.soon-chip) {
          font-size: 0.7rem;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 999px;
          background: var(--rr-ice, #eaf4fb);
          color: var(--rr-navy);
          white-space: nowrap;
        }
        .sections :global(.count-badge) {
          position: absolute;
          top: -8px;
          right: -8px;
          min-width: 26px;
          height: 26px;
          padding: 0 7px;
          border-radius: 999px;
          background: var(--rr-red);
          color: #fff;
          font-weight: 900;
          font-size: 0.85rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 0 rgba(13, 42, 74, 0.3);
        }
        @media (max-width: 480px) {
          .tiles :global(.tile-num) { font-size: 1.6rem; }
          .tiles { gap: 8px; }
        }
      `}</style>
    </>
  )
}
