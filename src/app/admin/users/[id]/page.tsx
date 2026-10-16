'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { getLevelForXP, getNextLevelXP } from '@/lib/levels'
import { badgesFor } from '@/lib/badges'
import type { AdminRole } from '@/lib/useAdminRole'
import { AdminShell } from '@/components/admin/AdminShell'
import { AnimatedNumber } from '@/components/admin/AnimatedNumber'
import { RefreshButton } from '@/components/admin/RefreshButton'
import { UserAvatar } from '@/components/admin/UserAvatar'
import { ROLE_LABELS } from '@/components/admin/adminSections'

// ─── Types (mirror admin_get_user) ─────────────────────────────────────────────
interface UserDetail {
  profile: {
    id:               string
    alias:            string | null
    initials:         string | null
    avatar_url:       string | null
    full_name:        string | null
    email:            string | null
    state:            string | null
    country:          string | null
    player_type:      string[] | null
    xp:               number | null
    streak:           number | null
    total_reviews:    number | null
    last_review_date: string | null
    created_at:       string | null
    last_sign_in_at:  string | null
    banned_at:        string | null
    banned_reason:    string | null
    banned_by_alias:  string | null
    admin_role:       AdminRole | null
  }
  counts:  { live: number; pending: number; removed: number }
  reviews: {
    id:                string
    rink_id:           string
    rink_name:         string | null
    category:          string
    comment:           string
    status:            'published' | 'pending' | 'rejected'
    deleted_at:        string | null
    review_date:       string
    moderation_reason: string | null
  }[]
  history: { action: string; target_type: string; note: string | null; at: string; by: string | null }[]
}

type ReviewFilter = 'all' | 'live' | 'pending' | 'removed'

const ACTION_LABEL: Record<string, string> = {
  approve: 'Approved a review',
  reject:  'Rejected a review',
  remove:  'Removed a review',
  restore: 'Restored a review',
  ban:     'Banned the account',
  unban:   'Unbanned the account',
}

const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString() : '—')

export default function AdminUserDetailPage() {
  return (
    <AdminShell title="User Lookup" allow={['super_admin', 'moderator']}>
      {(role) => <UserDetailView viewerRole={role} />}
    </AdminShell>
  )
}

function UserDetailView({ viewerRole }: { viewerRole: AdminRole }) {
  const params = useParams<{ id: string }>()
  const userId = decodeURIComponent(params.id)
  const { user: viewer } = useAuth()
  const reduceMotion = useReducedMotion()

  const [detail, setDetail] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [filter, setFilter] = useState<ReviewFilter>('all')

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    if (mode === 'initial') setLoading(true)
    else setRefreshing(true)
    const { data, error: rpcError } = await supabase.rpc('admin_get_user', { p_user_id: userId })
    if (rpcError) {
      console.error('admin_get_user failed:', rpcError)
      setError(rpcError.message?.includes('not found') ? 'User not found.' : 'Could not load this user.')
    } else {
      setError(null)
      setDetail(data as UserDetail)
      setRefreshKey((k) => k + 1)
    }
    setLoading(false)
    setRefreshing(false)
  }, [userId])

  useEffect(() => { load('initial') }, [load])

  if (loading) {
    return <p className="state" role="status">Pulling their file…<style jsx>{`.state{padding:32px 0;font-weight:800;color:var(--rr-navy);}`}</style></p>
  }
  if (error || !detail) {
    return (
      <div>
        <p role="alert" style={{ color: 'var(--rr-red)', fontWeight: 800 }}>{error}</p>
        <Link href="/admin/users">← Back to search</Link>
      </div>
    )
  }

  const p = detail.profile
  const xp = p.xp ?? 0
  const level = getLevelForXP(xp)
  const nextXP = getNextLevelXP(xp)
  const pct = Math.min(100, Math.max(0, Math.round(((xp - level.xpStart) / (nextXP - level.xpStart)) * 100)))
  const badges = badgesFor(p.total_reviews ?? 0, xp)
  const isSelf = viewer?.id === p.id
  const canBan = !isSelf && (!p.admin_role || viewerRole === 'super_admin')

  const filteredReviews = detail.reviews.filter((r) =>
    filter === 'all' ? true
    : filter === 'live' ? !r.deleted_at && r.status === 'published'
    : filter === 'pending' ? !r.deleted_at && r.status === 'pending'
    : !!r.deleted_at
  )

  return (
    <>
      <div className="top-row">
        <Link href="/admin/users" className="back-link">← All users</Link>
        <RefreshButton onClick={() => load('refresh')} refreshing={refreshing} label="Refresh user" />
      </div>

      {/* ── Identity ─────────────────────────────────────────────────────── */}
      <motion.section
        className={`clay-card identity ${p.banned_at ? 'identity-banned' : ''}`}
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        aria-labelledby="user-name"
      >
        <UserAvatar alias={p.alias} initials={p.initials} avatarUrl={p.avatar_url} size={64} />
        <div className="identity-text">
          <h2 id="user-name">
            {p.alias || 'No username'}
            {p.admin_role && <span className="chip chip-admin">{ROLE_LABELS[p.admin_role]}</span>}
            {p.banned_at && <span className="chip chip-banned">Banned</span>}
          </h2>
          {(p.full_name || p.email) && (
            <p className="identity-line">{[p.full_name, p.email].filter(Boolean).join(' · ')}</p>
          )}
          <p className="identity-line">
            Joined {fmtDate(p.created_at)} · Last signed in {fmtDate(p.last_sign_in_at)}
            {p.state ? ` · ${p.state}` : ''}
            {p.player_type?.length ? ` · ${p.player_type.join(', ')}` : ''}
          </p>
        </div>
      </motion.section>

      {/* ── Level + stats ────────────────────────────────────────────────── */}
      <div className="grid-two">
        <section className="clay-card level-card" aria-label="Level and XP">
          <div className="level-head">
            <span className="level-title">Level {level.level} · {level.title}</span>
            <span className="level-xp"><AnimatedNumber value={xp} /> XP</span>
          </div>
          <div className="xp-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Progress to next level">
            <motion.div
              key={refreshKey}
              className="xp-fill"
              initial={reduceMotion ? false : { width: '0%' }}
              animate={{ width: `${pct}%` }}
              transition={{ type: 'spring', stiffness: 90, damping: 18 }}
            />
          </div>
          <div className="level-foot">
            <span>{(nextXP - xp).toLocaleString()} XP to next level</span>
            <span>🔥 {p.streak ?? 0}-day streak</span>
          </div>
        </section>

        <section className="stat-tiles" aria-label="Review counts">
          {[
            { label: 'Live',    value: detail.counts.live,    tone: 'tone-live' },
            { label: 'Waiting', value: detail.counts.pending, tone: 'tone-wait' },
            { label: 'Removed', value: detail.counts.removed, tone: 'tone-removed' },
          ].map((t, i) => (
            <motion.div
              key={t.label}
              className={`clay-card tile ${t.tone}`}
              initial={reduceMotion ? false : { opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05 * i }}
            >
              <span className="tile-num"><AnimatedNumber value={t.value} /></span>
              <span className="tile-label">{t.label}</span>
            </motion.div>
          ))}
        </section>
      </div>

      {/* ── Badges ───────────────────────────────────────────────────────── */}
      <section className="clay-card badges" aria-labelledby="badges-heading">
        <h3 id="badges-heading">Badges</h3>
        <ul className="badge-row">
          {badges.map((b, i) => (
            <motion.li
              key={b.id}
              className={`badge ${b.earned ? 'badge-earned' : ''}`}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: b.earned ? 1 : 0.45, y: 0 }}
              transition={{ delay: 0.03 * i }}
              title={b.criteria}
            >
              <img src={b.icon} alt="" />
              <span>{b.label}</span>
              <span className="sr-only">{b.earned ? 'earned' : 'not earned'}</span>
            </motion.li>
          ))}
        </ul>
      </section>

      {/* ── Ban panel ────────────────────────────────────────────────────── */}
      <BanPanel
        userId={p.id}
        alias={p.alias}
        bannedAt={p.banned_at}
        bannedReason={p.banned_reason}
        bannedBy={p.banned_by_alias}
        canBan={canBan}
        isSelf={isSelf}
        liveOrWaiting={detail.counts.live + detail.counts.pending}
        onChanged={() => load('refresh')}
      />

      {/* ── Reviews ──────────────────────────────────────────────────────── */}
      <section className="clay-card reviews" aria-labelledby="reviews-heading">
        <div className="reviews-head">
          <h3 id="reviews-heading">Reviews</h3>
          <div className="filters" role="group" aria-label="Filter reviews">
            {(['all', 'live', 'pending', 'removed'] as ReviewFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                className={`filter ${filter === f ? 'filter-on' : ''}`}
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
              >
                {f === 'pending' ? 'Waiting' : f[0].toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {filteredReviews.length === 0 ? (
          <p className="muted">Nothing here.</p>
        ) : (
          <ul className="review-list">
            <AnimatePresence initial={false} mode="popLayout">
              {filteredReviews.map((r) => {
                const state = r.deleted_at ? 'removed' : r.status === 'published' ? 'live' : 'waiting'
                return (
                  <motion.li
                    key={r.id}
                    layout={!reduceMotion}
                    initial={reduceMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="review-row"
                  >
                    <div className="review-top">
                      <Link href={`/rink/${r.rink_id}`} target="_blank" rel="noopener noreferrer" className="rink-link">
                        {r.rink_name || r.rink_id}
                      </Link>
                      <span className={`status status-${state}`}>{state}</span>
                    </div>
                    <div className="review-meta">{r.category} · {fmtDate(r.review_date)}</div>
                    <p className="review-text">{r.comment}</p>
                    {r.moderation_reason && <p className="review-flag">🚩 {r.moderation_reason}</p>}
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>
        )}
      </section>

      {/* ── Moderation history ───────────────────────────────────────────── */}
      <section className="clay-card history" aria-labelledby="history-heading">
        <h3 id="history-heading">Moderation history</h3>
        {detail.history.length === 0 ? (
          <p className="muted">No moderator actions yet.</p>
        ) : (
          <ol className="timeline">
            {detail.history.map((h, i) => (
              <li key={`${h.at}-${i}`}>
                <span className={`dot dot-${h.action}`} aria-hidden="true" />
                <span className="tl-text">
                  <strong>{ACTION_LABEL[h.action] ?? h.action}</strong>
                  {h.note ? ` — “${h.note}”` : ''}
                  <span className="tl-meta"> · {h.by || 'an admin'} · {new Date(h.at).toLocaleString()}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <style jsx>{`
        .top-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .top-row :global(.back-link) {
          font-weight: 800;
          color: var(--rr-navy);
          min-height: 44px;
          display: inline-flex;
          align-items: center;
        }
        :global(.identity) {
          display: flex;
          gap: 16px;
          align-items: center;
          padding: 18px;
          margin-bottom: 16px;
        }
        :global(.identity-banned) {
          border-color: var(--rr-red) !important;
          background: #fff5f6 !important;
        }
        .identity-text { min-width: 0; }
        h2 {
          margin: 0 0 4px;
          font-weight: 900;
          color: var(--rr-navy);
          font-size: 1.4rem;
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .identity-line {
          margin: 2px 0 0;
          font-size: 0.88rem;
          color: rgba(13, 42, 74, 0.8);
          overflow-wrap: anywhere;
        }
        .chip {
          font-size: 0.7rem;
          font-weight: 900;
          padding: 3px 9px;
          border-radius: 999px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .chip-admin { background: var(--rr-navy); color: #fff; }
        .chip-banned { background: var(--rr-red); color: #fff; }
        .grid-two {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 16px;
          margin-bottom: 16px;
        }
        @media (max-width: 700px) {
          .grid-two { grid-template-columns: 1fr; }
        }
        .level-card { padding: 16px; }
        .level-head, .level-foot {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          flex-wrap: wrap;
        }
        .level-title { font-weight: 900; color: var(--rr-navy); }
        .level-xp { font-weight: 900; color: var(--rr-red); }
        .xp-track {
          height: 14px;
          border-radius: 999px;
          background: var(--rr-ice, #d6effa);
          margin: 10px 0 8px;
          overflow: hidden;
        }
        .xp-track :global(.xp-fill) {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, var(--rr-navy), #2a7ab8);
        }
        .level-foot {
          font-size: 0.82rem;
          font-weight: 700;
          color: rgba(13, 42, 74, 0.8);
        }
        .stat-tiles {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        .stat-tiles :global(.tile) {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 12px 6px;
        }
        .tile-num {
          font-family: var(--font-display, 'Nunito', sans-serif);
          font-weight: 900;
          font-size: 1.8rem;
          line-height: 1.1;
        }
        .tile-label {
          font-size: 0.78rem;
          font-weight: 800;
          color: rgba(13, 42, 74, 0.8);
        }
        .stat-tiles :global(.tone-live .tile-num) { color: var(--rr-navy); }
        .stat-tiles :global(.tone-wait .tile-num) { color: var(--rr-red); }
        .stat-tiles :global(.tone-removed .tile-num) { color: rgba(13, 42, 74, 0.75); }
        .badges, .reviews, .history {
          padding: 16px;
          margin-bottom: 16px;
        }
        h3 {
          margin: 0 0 10px;
          font-weight: 900;
          color: var(--rr-navy);
          font-size: 1.05rem;
        }
        .badge-row {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          gap: 10px;
          overflow-x: auto;
          padding-bottom: 4px;
        }
        .badge-row :global(.badge) {
          flex: 0 0 84px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          text-align: center;
          font-size: 0.75rem;
          font-weight: 800;
          color: var(--rr-navy);
        }
        .badge-row :global(.badge img) {
          width: 52px;
          height: 52px;
          object-fit: contain;
          border-radius: 10px;
          border: 2px solid rgba(13, 42, 74, 0.12);
          background: #fff;
        }
        .badge-row :global(.badge-earned img) {
          border-color: var(--rr-yellow);
          box-shadow: 0 0 0 3px rgba(255, 210, 63, 0.3);
        }
        .reviews-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 8px;
        }
        .reviews-head h3 { margin: 0; }
        .filters { display: flex; gap: 6px; flex-wrap: wrap; }
        .filter {
          min-height: 36px;
          min-width: 44px;
          padding: 0 12px;
          border-radius: 999px;
          border: 2px solid var(--rr-navy);
          background: #fff;
          color: var(--rr-navy);
          font-family: inherit;
          font-weight: 800;
          font-size: 0.82rem;
          cursor: pointer;
        }
        .filter-on { background: var(--rr-navy); color: #fff; }
        .filter:focus-visible { outline: 3px solid var(--rr-yellow); outline-offset: 2px; }
        .muted { color: rgba(13, 42, 74, 0.78); font-weight: 700; margin: 4px 0 0; }
        .review-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
        }
        .review-list :global(.review-row) {
          padding: 12px 0;
          border-top: 1px solid rgba(13, 42, 74, 0.1);
        }
        .review-top {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          align-items: center;
        }
        .review-top :global(.rink-link) {
          font-weight: 900;
          color: var(--rr-navy);
        }
        .status {
          font-size: 0.7rem;
          font-weight: 900;
          padding: 3px 9px;
          border-radius: 999px;
          text-transform: uppercase;
        }
        .status-live { background: var(--rr-green); color: var(--rr-navy); }
        .status-waiting { background: var(--rr-yellow); color: var(--rr-navy); }
        .status-removed { background: rgba(13, 42, 74, 0.12); color: var(--rr-navy); }
        .review-meta { font-size: 0.8rem; color: rgba(13, 42, 74, 0.78); margin-top: 2px; }
        .review-text {
          margin: 6px 0 0;
          color: var(--rr-navy);
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }
        .review-flag { margin: 6px 0 0; font-size: 0.85rem; color: var(--rr-navy); }
        .timeline {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .timeline li { display: flex; gap: 10px; align-items: flex-start; }
        .dot {
          flex-shrink: 0;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          margin-top: 4px;
          background: var(--rr-navy);
        }
        .dot-approve, .dot-restore, .dot-unban { background: var(--rr-green); }
        .dot-reject, .dot-remove, .dot-ban { background: var(--rr-red); }
        .tl-text { color: var(--rr-navy); font-size: 0.9rem; }
        .tl-meta { color: rgba(13, 42, 74, 0.78); }
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
      `}</style>
    </>
  )
}

// ─── Ban / unban ───────────────────────────────────────────────────────────────
function BanPanel({
  userId, alias, bannedAt, bannedReason, bannedBy, canBan, isSelf, liveOrWaiting, onChanged,
}: {
  userId:        string
  alias:         string | null
  bannedAt:      string | null
  bannedReason:  string | null
  bannedBy:      string | null
  canBan:        boolean
  isSelf:        boolean
  liveOrWaiting: number
  onChanged:     () => void
}) {
  const reduceMotion = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [removeReviews, setRemoveReviews] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const reasonRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { if (open) reasonRef.current?.focus() }, [open])

  const submit = async (ban: boolean) => {
    setWorking(true)
    setError(null)
    const { data, error: rpcError } = await supabase.rpc('admin_set_user_ban', {
      p_user_id:        userId,
      p_ban:            ban,
      p_reason:         ban ? reason.trim() || null : null,
      p_remove_reviews: ban && removeReviews,
    })
    setWorking(false)
    if (rpcError) {
      console.error('admin_set_user_ban failed:', rpcError)
      setError(rpcError.message || 'Something went wrong.')
      return
    }
    const removed = (data as { reviews_removed?: number })?.reviews_removed ?? 0
    setMessage(ban
      ? `${alias || 'User'} is banned${removed ? ` and ${removed} review${removed === 1 ? ' was' : 's were'} removed` : ''}.`
      : `${alias || 'User'} is unbanned.`)
    setOpen(false)
    setReason('')
    setRemoveReviews(false)
    onChanged()
  }

  return (
    <section className={`clay-card ban ${bannedAt ? 'ban-active' : ''}`} aria-labelledby="ban-heading">
      <h3 id="ban-heading">{bannedAt ? '⛔ Account banned' : 'Account access'}</h3>
      <div className="sr-only" role="status" aria-live="polite">{message}</div>

      {bannedAt ? (
        <>
          <p className="ban-line">
            Banned {new Date(bannedAt).toLocaleDateString()}{bannedBy ? ` by ${bannedBy}` : ''}
            {bannedReason ? ` — “${bannedReason}”` : ''}
          </p>
          <p className="ban-help">They can still sign in and delete their own reviews, but can’t post or edit.</p>
          {canBan && (
            <button type="button" className="clay-btn btn-outline" disabled={working} onClick={() => submit(false)}>
              {working ? 'Working…' : 'Unban'}
            </button>
          )}
        </>
      ) : isSelf ? (
        <p className="ban-help">This is your account.</p>
      ) : !canBan ? (
        <p className="ban-help">Only a super admin can ban another admin.</p>
      ) : (
        <>
          <p className="ban-help">Good standing. Banning stops them posting or editing reviews.</p>
          <AnimatePresence initial={false} mode="wait">
            {open ? (
              <motion.div
                key="form"
                className="ban-form"
                initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              >
                <label htmlFor="ban-reason">Reason (kept in the audit log)</label>
                <textarea
                  id="ban-reason"
                  ref={reasonRef}
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}
                  placeholder="e.g. repeated fake reviews"
                />
                {liveOrWaiting > 0 && (
                  <label className="check">
                    <input type="checkbox" checked={removeReviews} onChange={(e) => setRemoveReviews(e.target.checked)} />
                    Also remove their {liveOrWaiting} live and waiting review{liveOrWaiting === 1 ? '' : 's'} (restorable)
                  </label>
                )}
                {error && <p className="ban-error" role="alert">{error}</p>}
                <div className="ban-actions">
                  <button type="button" className="clay-btn btn-danger" disabled={working} onClick={() => submit(true)}>
                    {working ? 'Working…' : `Ban ${alias || 'user'}`}
                  </button>
                  <button type="button" className="clay-btn btn-outline" disabled={working} onClick={() => setOpen(false)}>
                    Cancel
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="btn" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <button type="button" className="clay-btn btn-outline-danger" onClick={() => setOpen(true)}>
                  Ban account…
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
      {error && !open && <p className="ban-error" role="alert">{error}</p>}

      <style jsx>{`
        .ban {
          padding: 16px;
          margin-bottom: 16px;
        }
        .ban-active {
          border-color: var(--rr-red) !important;
          background: #fff5f6 !important;
        }
        h3 {
          margin: 0 0 8px;
          font-weight: 900;
          color: var(--rr-navy);
          font-size: 1.05rem;
        }
        .ban-line { margin: 0 0 4px; font-weight: 800; color: var(--rr-navy); }
        .ban-help { margin: 0 0 12px; color: rgba(13, 42, 74, 0.8); font-size: 0.9rem; }
        :global(.ban-form) { overflow: hidden; }
        label {
          display: block;
          font-weight: 800;
          color: var(--rr-navy);
          margin: 4px 0;
          font-size: 0.85rem;
        }
        textarea {
          width: 100%;
          box-sizing: border-box;
          padding: 10px 12px;
          border-radius: 10px;
          border: 2px solid rgba(13, 42, 74, 0.3);
          font-family: inherit;
          font-size: 0.95rem;
        }
        textarea:focus {
          outline: 3px solid var(--rr-yellow);
          outline-offset: 1px;
          border-color: var(--rr-navy);
        }
        .check {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 44px;
          font-weight: 700;
          cursor: pointer;
        }
        .check input { width: 22px; height: 22px; accent-color: var(--rr-red); }
        .ban-error { color: var(--rr-red); font-weight: 800; margin: 8px 0 0; }
        .ban-actions { display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap; }
        .ban :global(.clay-btn) { min-height: 44px; min-width: 120px; }
        .ban :global(.btn-danger) { background: var(--rr-red) !important; color: #fff !important; }
        .ban :global(.btn-outline) {
          background: #fff !important;
          border: 2px solid var(--rr-navy) !important;
          color: var(--rr-navy) !important;
        }
        .ban :global(.btn-outline-danger) {
          background: #fff !important;
          border: 2px solid var(--rr-red) !important;
          color: var(--rr-red) !important;
        }
        .ban :global(.clay-btn:focus-visible) { outline: 3px solid var(--rr-yellow); outline-offset: 2px; }
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
      `}</style>
    </section>
  )
}
