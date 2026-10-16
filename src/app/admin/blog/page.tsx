'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { POST_COLUMNS, formatPostDate, postState, type Post, type PostState } from '@/lib/blog'
import type { AdminRole } from '@/lib/useAdminRole'
import { AdminShell } from '@/components/admin/AdminShell'
import { RefreshButton } from '@/components/admin/RefreshButton'
import { PostEditor } from '@/components/admin/blog/PostEditor'

type Filter = 'active' | 'removed'

const STATE_LABEL: Record<PostState, string> = {
  draft:     'Draft',
  scheduled: 'Scheduled',
  live:      'Live',
  removed:   'Removed',
}

export default function AdminBlogPage() {
  return (
    <AdminShell
      title="Blog"
      subtitle="Write, schedule and publish posts for rinkrater.com/blog."
      allow={['super_admin', 'moderator']}
    >
      {(role) => <BlogManager role={role} />}
    </AdminShell>
  )
}

function BlogManager({ role }: { role: AdminRole }) {
  // Super Admins publish, schedule and remove. Moderators write drafts only —
  // the database enforces the same rule, this just keeps the screen honest.
  const canPublish = role === 'super_admin'
  const reduceMotion = useReducedMotion()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('active')
  // null = list view, 'new' = blank editor, otherwise the post being edited
  const [editing, setEditing] = useState<Post | 'new' | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    if (mode === 'initial') setLoading(true)
    else setRefreshing(true)
    const { data, error: loadError } = await supabase
      .from('posts')
      .select(POST_COLUMNS)
      .order('updated_at', { ascending: false })
      .limit(500)
    if (loadError) {
      console.error('posts load failed:', loadError)
      setError(/relation|does not exist/i.test(loadError.message)
        ? 'The posts table doesn’t exist yet — run the v6 SQL migration first.'
        : 'Could not load posts.')
    } else {
      setError(null)
      setPosts((data as Post[]) ?? [])
    }
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { load('initial') }, [load])

  const counts = useMemo(() => {
    const c: Record<PostState, number> = { draft: 0, scheduled: 0, live: 0, removed: 0 }
    posts.forEach((p) => { c[postState(p)]++ })
    return c
  }, [posts])

  // Active list: scheduled first (soonest on top), then drafts, then live (newest on top).
  const visible = useMemo(() => {
    const rank: Record<PostState, number> = { scheduled: 0, draft: 1, live: 2, removed: 3 }
    return posts
      .filter((p) => (filter === 'removed' ? p.deleted_at : !p.deleted_at))
      .sort((a, b) => {
        const sa = postState(a), sb = postState(b)
        if (sa !== sb) return rank[sa] - rank[sb]
        if (sa === 'scheduled') return a.published_at!.localeCompare(b.published_at!)
        if (sa === 'live') return b.published_at!.localeCompare(a.published_at!)
        return b.updated_at.localeCompare(a.updated_at)
      })
  }, [posts, filter])

  const restore = async (p: Post) => {
    setBusyId(p.id)
    const { error: rsError } = await supabase.from('posts').update({ deleted_at: null }).eq('id', p.id)
    setBusyId(null)
    if (rsError) {
      setAnnouncement('Could not restore that post.')
      return
    }
    setAnnouncement(`“${p.title}” restored.`)
    load('refresh')
  }

  const onSaved = (message: string, saved: Post) => {
    setAnnouncement(message)
    setPosts((prev) => {
      const others = prev.filter((p) => p.id !== saved.id)
      return [saved, ...others]
    })
    setEditing(saved.deleted_at ? null : saved)
    if (saved.deleted_at) setFilter('active')
  }

  if (editing) {
    return (
      <>
        <div className="sr-only" role="status" aria-live="polite">{announcement}</div>
        {announcement && <p className="toast" aria-hidden="true">{announcement}</p>}
        <PostEditor
          key={editing === 'new' ? 'new' : editing.id + editing.updated_at}
          post={editing === 'new' ? null : editing}
          canPublish={canPublish}
          onCancel={() => { setEditing(null); setAnnouncement('') }}
          onSaved={onSaved}
        />
        <style jsx>{sharedStyles}</style>
      </>
    )
  }

  return (
    <>
      <div className="toolbar">
        <motion.button
          type="button"
          className="clay-btn add-btn"
          onClick={() => { setAnnouncement(''); setEditing('new') }}
          whileTap={reduceMotion ? undefined : { scale: 0.96 }}
        >
          + New post
        </motion.button>
        <RefreshButton onClick={() => load('refresh')} refreshing={refreshing} label="Refresh posts" />
      </div>

      <div className="filters" role="tablist" aria-label="Which posts">
        <button type="button" role="tab" aria-selected={filter === 'active'} className={`filter ${filter === 'active' ? 'filter-on' : ''}`} onClick={() => setFilter('active')}>
          Posts <span className="filter-count">{counts.draft + counts.scheduled + counts.live}</span>
        </button>
        <button type="button" role="tab" aria-selected={filter === 'removed'} className={`filter ${filter === 'removed' ? 'filter-on' : ''}`} onClick={() => setFilter('removed')}>
          Removed <span className="filter-count">{counts.removed}</span>
        </button>
        {filter === 'active' && posts.length > 0 && (
          <span className="summary">
            {counts.live} live · {counts.scheduled} scheduled · {counts.draft} draft{counts.draft === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <div className="sr-only" role="status" aria-live="polite">{announcement}</div>
      {announcement && <p className="toast" aria-hidden="true">{announcement}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {loading && <p className="muted" role="status">Loading posts…</p>}

      {!loading && !error && visible.length === 0 && (
        <p className="muted">
          {filter === 'removed' ? 'Nothing removed.' : 'No posts yet. Write your first one!'}
        </p>
      )}

      <ul className="post-list">
        <AnimatePresence initial={false}>
          {visible.map((p) => {
            const s = postState(p)
            return (
              <motion.li
                key={p.id}
                layout={!reduceMotion}
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className={`clay-card post-row ${s === 'removed' ? 'row-removed' : ''}`}>
                  <span className="thumb">
                    {p.cover_image_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={p.cover_image_url} alt="" />
                      : <span aria-hidden="true">📝</span>}
                  </span>
                  <span className="row-main">
                    <span className="row-title">{p.title}</span>
                    <span className="row-meta">
                      <span className={`chip chip-${s}`}>{STATE_LABEL[s]}</span>
                      <span>
                        {s === 'live' && `Published ${formatPostDate(p.published_at)}`}
                        {s === 'scheduled' && `Goes live ${new Date(p.published_at!).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`}
                        {s === 'draft' && `Edited ${formatPostDate(p.updated_at)}`}
                        {s === 'removed' && `Removed ${formatPostDate(p.deleted_at)}`}
                      </span>
                      {p.rink_ids.length > 0 && <span>· {p.rink_ids.length} rink{p.rink_ids.length > 1 ? 's' : ''}</span>}
                    </span>
                  </span>
                  {s === 'removed' ? (
                    canPublish ? (
                      <button type="button" className="clay-btn edit-btn" onClick={() => restore(p)} disabled={busyId === p.id}>
                        {busyId === p.id ? 'Restoring…' : 'Restore'}
                      </button>
                    ) : null
                  ) : !canPublish && s === 'live' ? (
                    <a className="clay-btn edit-btn" href={`/blog/${p.slug}`} target="_blank" rel="noopener noreferrer" aria-label={`View ${p.title} on the blog`}>
                      View
                    </a>
                  ) : !canPublish && s === 'scheduled' ? (
                    <span className="locked">Locked</span>
                  ) : (
                    <button type="button" className="clay-btn edit-btn" onClick={() => { setAnnouncement(''); setEditing(p) }} aria-label={`Edit ${p.title}`}>
                      Edit
                    </button>
                  )}
                </div>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ul>

      <style jsx>{sharedStyles}</style>
      <style jsx>{`
        .toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
        }
        .toolbar :global(.add-btn) {
          min-height: 44px;
          background: var(--rr-red) !important;
          color: #fff !important;
        }
        .toolbar :global(.add-btn:focus-visible) { outline: 3px solid var(--rr-yellow); outline-offset: 2px; }
        .filters { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
        .filter {
          min-height: 44px;
          padding: 0 16px;
          border-radius: 999px;
          border: 2px solid var(--rr-navy);
          background: #fff;
          color: var(--rr-navy);
          font-family: inherit;
          font-weight: 900;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .filter-on { background: var(--rr-navy); color: #fff; }
        .filter:focus-visible { outline: 3px solid var(--rr-yellow); outline-offset: 2px; }
        .filter-count {
          font-size: 0.75rem;
          padding: 1px 8px;
          border-radius: 999px;
          background: var(--rr-yellow);
          color: var(--rr-navy);
        }
        .summary { margin-left: auto; font-size: 0.85rem; font-weight: 700; color: rgba(13, 42, 74, 0.85); }
        .error { color: var(--rr-red); font-weight: 800; }
        .muted { color: rgba(13, 42, 74, 0.8); font-weight: 700; }
        .post-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
        .post-list :global(.post-row) { display: flex; align-items: center; gap: 12px; padding: 12px 14px; }
        .post-list :global(.row-removed) { opacity: 0.7; }
        .thumb {
          width: 88px;
          height: 50px;
          flex-shrink: 0;
          border-radius: 8px;
          background: var(--rr-ice, #d6effa);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          font-size: 22px;
        }
        .thumb img { width: 100%; height: 100%; object-fit: cover; }
        .row-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
        .row-title { font-weight: 900; color: var(--rr-navy); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .row-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 0.8rem; color: rgba(13, 42, 74, 0.85); font-weight: 600; }
        .chip {
          font-size: 0.68rem;
          font-weight: 900;
          padding: 2px 8px;
          border-radius: 999px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          color: var(--rr-navy);
        }
        .chip-live { background: var(--rr-green); }
        .chip-scheduled { background: var(--rr-yellow); }
        .chip-draft { background: rgba(13, 42, 74, 0.12); }
        .chip-removed { background: var(--rr-tier-single); }
        .post-list :global(.edit-btn) {
          min-height: 44px;
          min-width: 90px;
          background: #fff !important;
          border: 2px solid var(--rr-navy) !important;
          color: var(--rr-navy) !important;
        }
        .post-list :global(a.edit-btn) { display: inline-flex; align-items: center; justify-content: center; text-decoration: none; }
        .locked { font-size: 0.8rem; font-weight: 800; color: rgba(13, 42, 74, 0.75); min-width: 90px; text-align: center; }
        .post-list :global(.edit-btn:focus-visible) { outline: 3px solid var(--rr-yellow); outline-offset: 2px; }
        @media (max-width: 520px) { .thumb { display: none; } }
      `}</style>
    </>
  )
}

const sharedStyles = `
  .toast {
    background: var(--rr-green);
    color: var(--rr-navy);
    font-weight: 800;
    padding: 10px 14px;
    border-radius: 10px;
    border: 2px solid var(--rr-navy);
    margin: 0 0 14px;
  }
  .sr-only {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
  }
`
