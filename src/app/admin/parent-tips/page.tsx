'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { AdminShell } from '@/components/admin/AdminShell'
import { AnimatedNumber } from '@/components/admin/AnimatedNumber'
import { RefreshButton } from '@/components/admin/RefreshButton'
import { TIP_CATEGORY_MAP, type TipCategory } from '@/lib/parentTips'

// ─── Types ─────────────────────────────────────────────────────────────────────
type Tab = 'pending' | 'published' | 'removed'
type Action = 'approve' | 'reject' | 'remove' | 'restore' | 'feature' | 'unfeature'

interface TipRow {
  id:               string
  category:         TipCategory
  title:            string
  body:             string
  user_id:          string | null
  author:           string | null
  instagram_ok:     boolean
  instagram_handle: string | null
  status:           'pending' | 'published'
  created_at:       string
  published_at:     string | null
  featured_at:      string | null
  deleted_at:       string | null
  author_live_tips: number
  last_action:      { action: Action; note: string | null; at: string } | null
}

const PAGE_SIZE = 25

const TABS: { id: Tab; label: string; empty: string }[] = [
  { id: 'pending',   label: 'Waiting', empty: 'Clean sheet — no tips waiting. 🥅' },
  { id: 'published', label: 'Live',    empty: 'No live tips yet.' },
  { id: 'removed',   label: 'Removed', empty: 'Nothing has been removed.' },
]

// Actions that take the card out of the current list.
const LEAVES_LIST: Action[] = ['approve', 'reject', 'remove', 'restore']
const EXIT_X: Record<Action, number> = { approve: 120, restore: 120, reject: -120, remove: -120, feature: 0, unfeature: 0 }

const ACTION_DONE: Record<Action, string> = {
  approve:   'Approved — it’s live on the tips board.',
  reject:    'Rejected and hidden. You can restore it from Removed.',
  remove:    'Removed from the site. You can restore it from Removed.',
  restore:   'Restored to where it was before.',
  feature:   'Marked as featured on Instagram.',
  unfeature: 'Featured mark cleared.',
}

/** Ready-to-paste Instagram caption that credits the parent. */
function buildCaption(row: TipRow): string {
  const cat = TIP_CATEGORY_MAP[row.category]
  const credit = row.instagram_handle ? `@${row.instagram_handle}` : row.author || 'a Rink Rater hockey parent'
  return [
    `${cat?.icon ?? '🏒'} Parent Tip: ${cat?.label ?? ''}`.trim(),
    '',
    row.title,
    '',
    row.body,
    '',
    `Tip from ${credit} in the Rink Rater parent community. 🙌`,
    'Got one of your own? Share it at rinkrater.com/tips',
    '',
    '#hockeymom #hockeydad #hockeyparents #youthhockey #rinkrater',
  ].join('\n')
}

export default function AdminParentTipsPage() {
  return (
    <AdminShell
      title="Parent Tips"
      subtitle="Approve, reject, remove or restore. Tip text can never be edited."
      allow={['super_admin', 'moderator']}
    >
      {() => <TipsQueue />}
    </AdminShell>
  )
}

// ─── Queue ─────────────────────────────────────────────────────────────────────
function TipsQueue() {
  const reduceMotion = useReducedMotion()
  const [tab, setTab] = useState<Tab>('pending')
  const [instagramOnly, setInstagramOnly] = useState(false)
  const [rows, setRows] = useState<TipRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [exitAction, setExitAction] = useState<Record<string, Action>>({})
  const requestId = useRef(0)

  const fetchPage = useCallback(async (which: Tab, igOnly: boolean, offset: number) => {
    const { data, error } = await supabase.rpc('admin_list_parent_tips', {
      p_status:         which,
      p_instagram_only: igOnly,
      p_limit:          PAGE_SIZE,
      p_offset:         offset,
    })
    if (error) throw error
    return data as { total: number; rows: TipRow[] }
  }, [])

  const load = useCallback(async (which: Tab, igOnly: boolean, mode: 'initial' | 'refresh') => {
    const id = ++requestId.current
    if (mode === 'initial') setLoading(true)
    else setRefreshing(true)
    setLoadError(null)
    try {
      const page = await fetchPage(which, igOnly, 0)
      if (id !== requestId.current) return
      setRows(page.rows)
      setTotal(page.total)
    } catch (err) {
      console.error('admin_list_parent_tips failed:', err)
      if (id === requestId.current) setLoadError('Could not load tips. Try refreshing.')
    } finally {
      if (id === requestId.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [fetchPage])

  useEffect(() => {
    load(tab, instagramOnly, 'initial')
  }, [tab, instagramOnly, load])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const page = await fetchPage(tab, instagramOnly, rows.length)
      setRows((prev) => [...prev, ...page.rows.filter((r) => !prev.some((p) => p.id === r.id))])
      setTotal(page.total)
    } catch (err) {
      console.error('admin_list_parent_tips (more) failed:', err)
      setAnnouncement('Could not load more tips.')
    } finally {
      setLoadingMore(false)
    }
  }

  const runAction = async (row: TipRow, action: Action, note?: string) => {
    const { data, error } = await supabase.rpc('admin_moderate_parent_tip', {
      p_tip_id: row.id,
      p_action: action,
      p_note:   note?.trim() || null,
    })
    if (error) {
      console.error('admin_moderate_parent_tip failed:', error)
      return error.message || 'Something went wrong.'
    }

    if (LEAVES_LIST.includes(action)) {
      setExitAction((prev) => ({ ...prev, [row.id]: action }))
      setRows((prev) => prev.filter((r) => r.id !== row.id))
      setTotal((t) => Math.max(0, t - 1))
    } else {
      const featuredAt = action === 'feature' ? new Date().toISOString() : null
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, featured_at: featuredAt } : r)))
    }

    const xp = (data as { xp_awarded?: number } | null)?.xp_awarded ?? 0
    setAnnouncement(xp > 0 ? `${ACTION_DONE[action]} ${row.author || 'The parent'} earned ${xp} XP.` : ACTION_DONE[action])
    return null
  }

  const switchTab = (next: Tab) => {
    if (next === tab) return
    setRows([])
    setTab(next)
  }

  const onTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const nextIndex = (index + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length
    switchTab(TABS[nextIndex].id)
    document.getElementById(`tiptab-${TABS[nextIndex].id}`)?.focus()
  }

  const activeTab = TABS.find((t) => t.id === tab)!

  return (
    <>
      <div className="queue-toolbar">
        <div className="tabs" role="tablist" aria-label="Tip status">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              id={`tiptab-${t.id}`}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              aria-controls="tip-panel"
              tabIndex={tab === t.id ? 0 : -1}
              className={`tab ${tab === t.id ? 'tab-active' : ''}`}
              onClick={() => switchTab(t.id)}
              onKeyDown={(e) => onTabKeyDown(e, i)}
            >
              {tab === t.id && (
                <motion.span
                  layoutId="tip-tab-pill"
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
        <RefreshButton onClick={() => load(tab, instagramOnly, 'refresh')} refreshing={refreshing || loading} label="Refresh list" />
      </div>

      <label className="ig-filter">
        <input
          type="checkbox"
          checked={instagramOnly}
          onChange={(e) => {
            setRows([])
            setInstagramOnly(e.target.checked)
          }}
        />
        <span>📸 Only tips the parent said are OK to feature on Instagram</span>
      </label>

      <div className="sr-only" role="status" aria-live="polite">{announcement}</div>

      <div id="tip-panel" role="tabpanel" aria-labelledby={`tiptab-${tab}`}>
        {loading && <p className="loading-note">Loading tips…</p>}
        {loadError && <p className="load-error" role="alert">{loadError}</p>}

        {!loading && !loadError && rows.length === 0 && (
          <motion.p
            className="empty-state"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            {instagramOnly ? 'No tips here are cleared for Instagram.' : activeTab.empty}
          </motion.p>
        )}

        {!loading && (
          <ul className="tip-list">
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
                  <TipModerationCard row={row} tab={tab} onAction={runAction} onAnnounce={setAnnouncement} />
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
          margin-bottom: 12px;
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
        .ig-filter {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          min-height: 44px;
          margin-bottom: 12px;
          font-weight: 700;
          color: var(--rr-navy);
          cursor: pointer;
        }
        .ig-filter input {
          width: 20px;
          height: 20px;
          accent-color: var(--rr-red);
        }
        .loading-note {
          color: var(--rr-navy);
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
        .tip-list {
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

// ─── One tip ───────────────────────────────────────────────────────────────────
function TipModerationCard({
  row,
  tab,
  onAction,
  onAnnounce,
}: {
  row: TipRow
  tab: Tab
  onAction: (row: TipRow, action: Action, note?: string) => Promise<string | null>
  onAnnounce: (msg: string) => void
}) {
  const reduceMotion = useReducedMotion()
  const [confirming, setConfirming] = useState<'reject' | 'remove' | null>(null)
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const noteRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (confirming) noteRef.current?.focus()
  }, [confirming])

  const act = async (action: Action, withNote?: string) => {
    setPending(true)
    setError(null)
    const err = await onAction(row, action, withNote)
    if (err) setError(err)
    // Cards that leave the list animate out; cards that stay need resetting.
    if (err || !LEAVES_LIST.includes(action)) setPending(false)
  }

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(buildCaption(row))
      setCopied(true)
      onAnnounce('Instagram caption copied.')
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      setError('Could not copy. Your browser may have blocked clipboard access.')
    }
  }

  const cat = TIP_CATEGORY_MAP[row.category]
  const sent = new Date(row.created_at).toLocaleDateString()
  const removedBy =
    row.last_action?.action === 'reject' ? 'Rejected by a moderator'
    : row.last_action?.action === 'remove' ? 'Removed by a moderator'
    : 'Removed'

  return (
    <article className="clay-card tip-card" aria-labelledby={`tip-title-${row.id}`}>
      <header className="card-head">
        <span className="category-chip">
          <span aria-hidden="true">{cat?.icon}</span> {cat?.label ?? row.category}
        </span>
        {row.instagram_ok ? (
          <span className="ig-chip ig-yes">
            📸 OK to feature{row.instagram_handle ? ` · @${row.instagram_handle}` : ''}
          </span>
        ) : (
          <span className="ig-chip ig-no">Not for Instagram</span>
        )}
        {row.featured_at && (
          <span className="ig-chip ig-featured">
            ★ Featured {new Date(row.featured_at).toLocaleDateString()}
          </span>
        )}
      </header>

      <h3 id={`tip-title-${row.id}`} className="tip-title">{row.title}</h3>
      <blockquote className="tip-body">{row.body}</blockquote>

      <div className="meta byline">
        {row.user_id ? (
          <Link href={`/admin/users/${row.user_id}`} className="author-link">
            {row.author || 'Unknown parent'}
          </Link>
        ) : (
          row.author || 'Unknown parent'
        )}{' '}· sent {sent} · {row.author_live_tips} live tip{row.author_live_tips === 1 ? '' : 's'}
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
            <label htmlFor={`tipnote-${row.id}`}>Reason (optional, kept in the audit log)</label>
            <textarea
              id={`tipnote-${row.id}`}
              ref={noteRef}
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') setConfirming(null) }}
              placeholder={confirming === 'reject' ? 'e.g. supplement advice, names a child' : 'e.g. reported as unsafe'}
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
              <>
                {row.instagram_ok && (
                  <>
                    <button type="button" className="clay-btn btn-ghost" disabled={pending} onClick={copyCaption}>
                      {copied ? 'Copied ✓' : 'Copy Instagram caption'}
                    </button>
                    {row.featured_at ? (
                      <button type="button" className="clay-btn btn-ghost" disabled={pending} onClick={() => act('unfeature')}>
                        Clear featured mark
                      </button>
                    ) : (
                      <button type="button" className="clay-btn btn-feature" disabled={pending} onClick={() => act('feature')}>
                        Mark as featured
                      </button>
                    )}
                  </>
                )}
                <button type="button" className="clay-btn btn-ghost-danger" disabled={pending} onClick={() => setConfirming('remove')}>
                  Remove
                </button>
              </>
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
        .tip-card {
          padding: 16px;
        }
        .card-head {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 10px;
        }
        .category-chip,
        .ig-chip {
          font-size: 0.78rem;
          font-weight: 800;
          padding: 4px 10px;
          border-radius: 999px;
          white-space: nowrap;
          color: var(--rr-navy);
        }
        .category-chip {
          background: var(--rr-ice, #eaf4fb);
        }
        .ig-yes {
          background: #fff4d1;
          border: 1px solid var(--rr-yellow);
        }
        .ig-no {
          background: rgba(13, 42, 74, 0.06);
        }
        .ig-featured {
          background: var(--rr-navy);
          color: #fff;
        }
        .tip-title {
          margin: 0 0 8px;
          font-size: 1.05rem;
          font-weight: 900;
          color: var(--rr-navy);
          overflow-wrap: anywhere;
        }
        .tip-body {
          margin: 0 0 10px;
          padding: 10px 12px;
          border-left: 4px solid var(--rr-navy);
          background: rgba(13, 42, 74, 0.04);
          border-radius: 0 8px 8px 0;
          color: var(--rr-navy);
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }
        .meta {
          font-size: 0.85rem;
          color: rgba(13, 42, 74, 0.78);
        }
        .byline :global(.author-link) {
          font-weight: 800;
          color: var(--rr-navy);
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .byline :global(.author-link:focus-visible) {
          outline: 3px solid var(--rr-yellow);
          outline-offset: 2px;
          border-radius: 4px;
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
          color: var(--rr-navy) !important;
        }
        :global(.btn-feature) {
          background: var(--rr-yellow) !important;
          color: var(--rr-navy) !important;
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
