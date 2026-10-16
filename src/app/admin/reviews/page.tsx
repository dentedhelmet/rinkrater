'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { AdminShell } from '@/components/admin/AdminShell'
import { AnimatedNumber } from '@/components/admin/AnimatedNumber'
import { RefreshButton } from '@/components/admin/RefreshButton'

// ─── Types ─────────────────────────────────────────────────────────────────────
type Tab = 'pending' | 'published' | 'removed'
type Action = 'approve' | 'reject' | 'remove' | 'restore'

interface ReviewRow {
  id:          string
  rink_id:     string
  rink_name:   string | null
  rink_city:   string | null
  rink_state:  string | null
  category:    string
  comment:     string
  user_id:     string | null
  user_alias:  string | null
  review_date: string
  status:      'published' | 'pending' | 'rejected'
  deleted_at:  string | null
  moderation_reason: string | null
  reviewer_published_count: number
  last_action: { action: Action; note: string | null; at: string } | null
}

const PAGE_SIZE = 25

const TABS: { id: Tab; label: string; empty: string }[] = [
  { id: 'pending',   label: 'Waiting',  empty: 'Clean sheet — nothing waiting for review. 🥅' },
  { id: 'published', label: 'Live',     empty: 'No live reviews yet.' },
  { id: 'removed',   label: 'Removed',  empty: 'Nothing has been removed.' },
]

// Which way a card flies off when it leaves the list, by action.
const EXIT_X: Record<Action, number> = { approve: 120, restore: 120, reject: -120, remove: -120 }

const ACTION_DONE: Record<Action, string> = {
  approve: 'Approved — it’s live now.',
  reject:  'Rejected and hidden. You can restore it from Removed.',
  remove:  'Removed from the site. You can restore it from Removed.',
  restore: 'Restored. Blocked reviews go to Waiting for your decision.',
}

export default function AdminReviewsPage() {
  return (
    <AdminShell
      title="Review Moderation"
      subtitle="Approve, reject, remove or restore. Review text can never be edited."
      allow={['super_admin', 'moderator']}
    >
      {() => <ModerationQueue />}
    </AdminShell>
  )
}

// ─── Queue ─────────────────────────────────────────────────────────────────────
function ModerationQueue() {
  const reduceMotion = useReducedMotion()
  const [tab, setTab] = useState<Tab>('pending')
  const [rows, setRows] = useState<ReviewRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [exitAction, setExitAction] = useState<Record<string, Action>>({})
  const requestId = useRef(0)

  const fetchPage = useCallback(async (which: Tab, offset: number) => {
    const { data, error } = await supabase.rpc('admin_list_reviews', {
      p_status: which,
      p_limit:  PAGE_SIZE,
      p_offset: offset,
    })
    if (error) throw error
    return data as { total: number; rows: ReviewRow[] }
  }, [])

  const load = useCallback(async (which: Tab, mode: 'initial' | 'refresh') => {
    const id = ++requestId.current
    if (mode === 'initial') setLoading(true)
    else setRefreshing(true)
    setLoadError(null)
    try {
      const page = await fetchPage(which, 0)
      if (id !== requestId.current) return // a newer tab switch won
      setRows(page.rows)
      setTotal(page.total)
    } catch (err) {
      console.error('admin_list_reviews failed:', err)
      if (id === requestId.current) setLoadError('Could not load reviews. Try refreshing.')
    } finally {
      if (id === requestId.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [fetchPage])

  useEffect(() => {
    load(tab, 'initial')
  }, [tab, load])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const page = await fetchPage(tab, rows.length)
      setRows((prev) => [...prev, ...page.rows.filter((r) => !prev.some((p) => p.id === r.id))])
      setTotal(page.total)
    } catch (err) {
      console.error('admin_list_reviews (more) failed:', err)
      setAnnouncement('Could not load more reviews.')
    } finally {
      setLoadingMore(false)
    }
  }

  const runAction = async (row: ReviewRow, action: Action, note?: string) => {
    const { error } = await supabase.rpc('admin_moderate_review', {
      p_review_id: row.id,
      p_action:    action,
      p_note:      note?.trim() || null,
    })
    if (error) {
      console.error('admin_moderate_review failed:', error)
      return error.message || 'Something went wrong.'
    }
    setExitAction((prev) => ({ ...prev, [row.id]: action }))
    setRows((prev) => prev.filter((r) => r.id !== row.id))
    setTotal((t) => Math.max(0, t - 1))
    setAnnouncement(ACTION_DONE[action])
    return null
  }

  const switchTab = (next: Tab) => {
    if (next === tab) return
    setRows([])
    setTab(next)
  }

  // Arrow-key navigation between tabs (WAI-ARIA tabs pattern).
  const onTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const nextIndex = (index + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length
    switchTab(TABS[nextIndex].id)
    document.getElementById(`tab-${TABS[nextIndex].id}`)?.focus()
  }

  const activeTab = TABS.find((t) => t.id === tab)!

  return (
    <>
      <div className="queue-toolbar">
        <div className="tabs" role="tablist" aria-label="Review status">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              id={`tab-${t.id}`}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              aria-controls="review-panel"
              tabIndex={tab === t.id ? 0 : -1}
              className={`tab ${tab === t.id ? 'tab-active' : ''}`}
              onClick={() => switchTab(t.id)}
              onKeyDown={(e) => onTabKeyDown(e, i)}
            >
              {tab === t.id && (
                <motion.span
                  layoutId="tab-pill"
                  className="tab-pill"
                  transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <span className="tab-text">
                {t.label}
                {tab === t.id && !loading && (
                  <span className="tab-count"> · <AnimatedNumber value={total} duration={0.5} /></span>
                )}
              </span>
            </button>
          ))}
        </div>
        <RefreshButton onClick={() => load(tab, 'refresh')} refreshing={refreshing || loading} label="Refresh list" />
      </div>

      <div className="sr-only" role="status" aria-live="polite">{announcement}</div>

      <div id="review-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {loading && <SkeletonCards reduceMotion={!!reduceMotion} />}
        {loadError && <p className="load-error" role="alert">{loadError}</p>}

        {!loading && !loadError && rows.length === 0 && (
          <motion.p
            className="empty-state"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            {activeTab.empty}
          </motion.p>
        )}

        {!loading && (
          <ul className="review-list">
            <AnimatePresence initial={false}>
              {rows.map((row, i) => (
                <motion.li
                  key={row.id}
                  layout={!reduceMotion}
                  initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 8) * 0.04 } }}
                  exit={
                    reduceMotion
                      ? { opacity: 0 }
                      : { opacity: 0, x: EXIT_X[exitAction[row.id] ?? 'approve'], transition: { duration: 0.28 } }
                  }
                >
                  <ReviewCard row={row} tab={tab} onAction={runAction} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}

        {!loading && rows.length < total && (
          <div className="more-row">
            <button type="button" className="clay-btn clay-btn-secondary more-btn" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Loading…' : `Load more (${total - rows.length} left)`}
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        .queue-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }
        .tabs {
          display: inline-flex;
          background: var(--rr-ice, #eaf4fb);
          border-radius: 999px;
          padding: 4px;
          gap: 2px;
        }
        .tab {
          position: relative;
          min-height: 44px;
          padding: 0 16px;
          border: none;
          background: transparent;
          border-radius: 999px;
          font-family: inherit;
          font-weight: 800;
          font-size: 0.95rem;
          color: var(--rr-navy);
          cursor: pointer;
        }
        .tab:focus-visible {
          outline: 3px solid var(--rr-yellow);
          outline-offset: 2px;
        }
        .tab :global(.tab-pill) {
          position: absolute;
          inset: 0;
          background: var(--rr-navy);
          border-radius: 999px;
          z-index: 0;
        }
        .tab-text {
          position: relative;
          z-index: 1;
        }
        .tab-active .tab-text {
          color: #fff;
        }
        .tab-count {
          font-weight: 700;
        }
        .load-error {
          color: var(--rr-red);
          font-weight: 800;
        }
        :global(.empty-state) {
          text-align: center;
          padding: 40px 16px;
          font-size: 1.1rem;
          font-weight: 800;
          color: rgba(13, 42, 74, 0.8);
        }
        .review-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .more-row {
          display: flex;
          justify-content: center;
          margin-top: 20px;
        }
        .more-btn {
          min-height: 44px;
        }
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
        @media (max-width: 480px) {
          .tab { padding: 0 12px; font-size: 0.88rem; }
        }
      `}</style>
    </>
  )
}

// ─── One review ────────────────────────────────────────────────────────────────
function ReviewCard({
  row,
  tab,
  onAction,
}: {
  row: ReviewRow
  tab: Tab
  onAction: (row: ReviewRow, action: Action, note?: string) => Promise<string | null>
}) {
  const reduceMotion = useReducedMotion()
  const [confirming, setConfirming] = useState<'reject' | 'remove' | null>(null)
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const noteRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (confirming) noteRef.current?.focus()
  }, [confirming])

  const act = async (action: Action, withNote?: string) => {
    setPending(true)
    setError(null)
    const err = await onAction(row, action, withNote)
    if (err) {
      setError(err)
      setPending(false)
    }
    // On success the card animates out, so no need to reset state.
  }

  const location = [row.rink_city, row.rink_state].filter(Boolean).join(', ')
  const reviewed = new Date(`${String(row.review_date).slice(0, 10)}T12:00:00`).toLocaleDateString()
  const removedBy =
    row.last_action?.action === 'reject' ? 'Rejected by a moderator'
    : row.last_action?.action === 'remove' ? 'Removed by a moderator'
    : row.status === 'rejected' ? 'Blocked automatically when saved'
    : 'Deleted by the reviewer'

  // The automatic check's reason, shown on Waiting cards and on blocked ones.
  const showReason =
    !!row.moderation_reason && (tab === 'pending' || (tab === 'removed' && !row.last_action))

  return (
    <article className="clay-card review-card" aria-labelledby={`rink-${row.id}`}>
      <header className="card-head">
        <div>
          <Link id={`rink-${row.id}`} href={`/rink/${row.rink_id}`} className="rink-link" target="_blank" rel="noopener noreferrer">
            {row.rink_name || row.rink_id}
          </Link>
          {location && <div className="meta">{location}</div>}
        </div>
        <span className="category-chip">{row.category}</span>
      </header>

      {showReason && (
        <p className="flag-reason">
          <span aria-hidden="true">🚩 </span>
          <span className="flag-label">{tab === 'pending' ? 'Held because: ' : 'Blocked because: '}</span>
          {row.moderation_reason}
        </p>
      )}

      <blockquote className="comment">{row.comment}</blockquote>

      <div className="meta byline">
        {row.user_alias || 'Unknown reviewer'} · {reviewed} ·{' '}
        {row.reviewer_published_count} live review{row.reviewer_published_count === 1 ? '' : 's'}
      </div>

      {tab === 'removed' && (
        <div className="removed-note">
          <strong>{removedBy}</strong>
          {row.last_action?.note && <> — “{row.last_action.note}”</>}
        </div>
      )}

      {error && <p className="action-error" role="alert">{error}</p>}

      <AnimatePresence mode="wait" initial={false}>
        {confirming ? (
          <motion.div
            key="confirm"
            className="confirm-box"
            initial={reduceMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
          >
            <label htmlFor={`note-${row.id}`}>
              Reason (optional, kept in the audit log)
            </label>
            <textarea
              id={`note-${row.id}`}
              ref={noteRef}
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') setConfirming(null) }}
              placeholder={confirming === 'reject' ? 'e.g. off-topic, spam' : 'e.g. reported as fake'}
            />
            <div className="action-row">
              <button type="button" className="clay-btn btn-danger" disabled={pending} onClick={() => act(confirming, note)}>
                {pending ? 'Working…' : confirming === 'reject' ? 'Confirm reject' : 'Confirm remove'}
              </button>
              <button type="button" className="clay-btn btn-ghost" disabled={pending} onClick={() => setConfirming(null)}>
                Cancel
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="actions"
            className="action-row"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {tab === 'pending' && (
              <>
                <motion.button
                  type="button"
                  className="clay-btn btn-approve"
                  disabled={pending}
                  onClick={() => act('approve')}
                  whileTap={reduceMotion ? undefined : { scale: 0.95 }}
                >
                  {pending ? 'Working…' : 'Approve'}
                </motion.button>
                <button type="button" className="clay-btn btn-ghost-danger" disabled={pending} onClick={() => setConfirming('reject')}>
                  Reject
                </button>
              </>
            )}
            {tab === 'published' && (
              <button type="button" className="clay-btn btn-ghost-danger" disabled={pending} onClick={() => setConfirming('remove')}>
                Remove
              </button>
            )}
            {tab === 'removed' && (
              <motion.button
                type="button"
                className="clay-btn btn-ghost"
                disabled={pending}
                onClick={() => act('restore')}
                whileTap={reduceMotion ? undefined : { scale: 0.95 }}
              >
                {pending ? 'Working…' : 'Restore'}
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .review-card {
          padding: 16px;
        }
        .card-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 10px;
        }
        .card-head :global(.rink-link) {
          font-weight: 900;
          color: var(--rr-navy);
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .card-head :global(.rink-link:focus-visible) {
          outline: 3px solid var(--rr-yellow);
          outline-offset: 2px;
          border-radius: 4px;
        }
        .meta {
          font-size: 0.85rem;
          color: rgba(13, 42, 74, 0.78);
        }
        .category-chip {
          font-size: 0.78rem;
          font-weight: 800;
          padding: 4px 10px;
          border-radius: 999px;
          background: var(--rr-ice, #eaf4fb);
          color: var(--rr-navy);
          white-space: nowrap;
        }
        .flag-reason {
          margin: 0 0 10px;
          padding: 8px 12px;
          border-radius: 8px;
          background: #fff4d1;
          border: 1px solid var(--rr-yellow);
          color: var(--rr-navy);
          font-size: 0.9rem;
        }
        .flag-label {
          font-weight: 800;
        }
        .comment {
          margin: 0 0 10px;
          padding: 10px 12px;
          border-left: 4px solid var(--rr-navy);
          background: rgba(13, 42, 74, 0.04);
          border-radius: 0 8px 8px 0;
          color: var(--rr-navy);
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }
        .byline {
          margin-bottom: 4px;
        }
        .removed-note {
          font-size: 0.85rem;
          color: var(--rr-navy);
          margin-top: 6px;
        }
        .action-error {
          color: var(--rr-red);
          font-weight: 800;
          margin: 10px 0 0;
        }
        :global(.confirm-box) {
          overflow: hidden;
        }
        label {
          display: block;
          font-weight: 800;
          color: var(--rr-navy);
          margin: 12px 0 4px;
          font-size: 0.85rem;
        }
        textarea {
          width: 100%;
          padding: 10px 12px;
          border-radius: 10px;
          border: 2px solid rgba(13, 42, 74, 0.3);
          font-family: inherit;
          font-size: 0.95rem;
          box-sizing: border-box;
        }
        textarea:focus {
          outline: 3px solid var(--rr-yellow);
          outline-offset: 1px;
          border-color: var(--rr-navy);
        }
        :global(.action-row) {
          display: flex;
          gap: 10px;
          margin-top: 12px;
          flex-wrap: wrap;
        }
        :global(.action-row) :global(.clay-btn) {
          min-height: 44px;
          min-width: 110px;
          flex: 1;
        }
        :global(.btn-approve) {
          background: var(--rr-green) !important;
          color: var(--rr-navy) !important; /* navy on green passes WCAG AA; white does not */
        }
        :global(.btn-danger) {
          background: var(--rr-red) !important;
          color: #fff !important;
        }
        :global(.btn-ghost) {
          background: #fff !important;
          border: 2px solid var(--rr-navy) !important;
          color: var(--rr-navy) !important;
        }
        :global(.btn-ghost-danger) {
          background: #fff !important;
          border: 2px solid var(--rr-red) !important;
          color: var(--rr-red) !important;
        }
        :global(.action-row .clay-btn:focus-visible) {
          outline: 3px solid var(--rr-yellow);
          outline-offset: 2px;
        }
      `}</style>
    </article>
  )
}

// ─── Loading skeleton ──────────────────────────────────────────────────────────
function SkeletonCards({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <div className="skeletons" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="clay-card skeleton"
          animate={reduceMotion ? undefined : { opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15 }}
        >
          <div className="sk-line sk-title" />
          <div className="sk-line" />
          <div className="sk-line sk-short" />
        </motion.div>
      ))}
      <style jsx>{`
        .skeletons {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .skeletons :global(.skeleton) {
          padding: 16px;
        }
        .sk-line {
          height: 12px;
          border-radius: 6px;
          background: rgba(13, 42, 74, 0.1);
          margin-bottom: 10px;
        }
        .sk-title {
          width: 45%;
          height: 16px;
        }
        .sk-short {
          width: 30%;
          margin-bottom: 0;
        }
      `}</style>
    </div>
  )
}
