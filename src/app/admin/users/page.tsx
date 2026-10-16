'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { getLevelForXP } from '@/lib/levels'
import { AdminShell } from '@/components/admin/AdminShell'
import { UserAvatar } from '@/components/admin/UserAvatar'

interface UserRow {
  id:            string
  alias:         string | null
  initials:      string | null
  avatar_url:    string | null
  xp:            number | null
  total_reviews: number | null
  created_at:    string | null
  banned_at:     string | null
  email:         string | null
  is_admin:      boolean
}

export default function AdminUsersPage() {
  return (
    <AdminShell
      title="User Lookup"
      subtitle="Find any reviewer to see their reviews, XP and badges, or ban an account."
      allow={['super_admin', 'moderator']}
    >
      {(role) => <UserSearch canSearchEmail={role === 'super_admin'} />}
    </AdminShell>
  )
}

function UserSearch({ canSearchEmail }: { canSearchEmail: boolean }) {
  const reduceMotion = useReducedMotion()
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  // Debounced search: waits 300ms after typing stops.
  useEffect(() => {
    const id = ++requestId.current
    const timer = window.setTimeout(async () => {
      setLoading(true)
      const { data, error: rpcError } = await supabase.rpc('admin_search_users', {
        p_query: query,
        p_limit: 25,
      })
      if (id !== requestId.current) return
      if (rpcError) {
        console.error('admin_search_users failed:', rpcError)
        setError('Search failed. Try again.')
        setRows([])
      } else {
        setError(null)
        setRows((data as UserRow[]) ?? [])
      }
      setLoading(false)
    }, query ? 300 : 0)
    return () => window.clearTimeout(timer)
  }, [query])

  return (
    <>
      <div className="search-wrap">
        <label htmlFor="user-search" className="sr-only">Search users</label>
        <span className="search-icon" aria-hidden="true">🔎</span>
        <input
          id="user-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={canSearchEmail ? 'Search by username, email or name' : 'Search by username'}
          autoComplete="off"
        />
        {loading && (
          <motion.span
            className="search-spinner"
            aria-hidden="true"
            animate={reduceMotion ? undefined : { rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
          />
        )}
      </div>

      <p className="result-label" role="status" aria-live="polite">
        {loading ? 'Searching…'
          : error ? ''
          : query ? `${rows.length} ${rows.length === 1 ? 'match' : 'matches'}${rows.length === 25 ? ' (showing first 25)' : ''}`
          : 'Newest sign-ups'}
      </p>

      {error && <p className="error" role="alert">{error}</p>}

      {!loading && !error && rows.length === 0 && (
        <p className="empty">No one by that name in the locker room.</p>
      )}

      <ul className="user-list">
        <AnimatePresence initial={false} mode="popLayout">
          {rows.map((u, i) => {
            const level = getLevelForXP(u.xp ?? 0)
            return (
              <motion.li
                key={u.id}
                layout={!reduceMotion}
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 10) * 0.03 } }}
                exit={{ opacity: 0 }}
              >
                <Link href={`/admin/users/${u.id}`} className="user-link">
                  <motion.div
                    className={`clay-card user-card ${u.banned_at ? 'is-banned' : ''}`}
                    whileHover={reduceMotion ? undefined : { y: -2 }}
                  >
                    <UserAvatar alias={u.alias} initials={u.initials} avatarUrl={u.avatar_url} size={44} />
                    <span className="user-main">
                      <span className="user-alias">
                        {u.alias || 'No username'}
                        {u.is_admin && <span className="chip chip-admin">Admin</span>}
                        {u.banned_at && <span className="chip chip-banned">Banned</span>}
                      </span>
                      <span className="user-meta">
                        {u.email ? `${u.email} · ` : ''}
                        Joined {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                      </span>
                    </span>
                    <span className="user-stats">
                      <span className="stat"><strong>{u.total_reviews ?? 0}</strong> reviews</span>
                      <span className="stat"><strong>{(u.xp ?? 0).toLocaleString()}</strong> XP · {level.title}</span>
                    </span>
                    <span className="chevron" aria-hidden="true">›</span>
                  </motion.div>
                </Link>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ul>

      <style jsx>{`
        .search-wrap {
          position: relative;
          margin-bottom: 8px;
        }
        .search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 1.1rem;
        }
        input {
          width: 100%;
          box-sizing: border-box;
          min-height: 52px;
          padding: 12px 48px 12px 44px;
          border-radius: 14px;
          border: 2px solid rgba(13, 42, 74, 0.3);
          font-family: inherit;
          font-size: 1rem;
          color: var(--rr-navy);
          background: #fff;
        }
        input:focus {
          outline: 3px solid var(--rr-yellow);
          outline-offset: 1px;
          border-color: var(--rr-navy);
        }
        .search-wrap :global(.search-spinner) {
          position: absolute;
          right: 16px;
          top: 50%;
          margin-top: -10px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 3px solid rgba(13, 42, 74, 0.15);
          border-top-color: var(--rr-navy);
        }
        .result-label {
          font-size: 0.85rem;
          font-weight: 800;
          color: rgba(13, 42, 74, 0.78);
          margin: 0 0 10px;
          min-height: 1.2em;
        }
        .error {
          color: var(--rr-red);
          font-weight: 800;
        }
        .empty {
          text-align: center;
          padding: 32px 16px;
          font-weight: 800;
          color: rgba(13, 42, 74, 0.8);
        }
        .user-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .user-list :global(.user-link) {
          text-decoration: none;
          display: block;
          border-radius: 16px;
        }
        .user-list :global(.user-link:focus-visible) {
          outline: 3px solid var(--rr-yellow);
          outline-offset: 3px;
        }
        .user-list :global(.user-card) {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          min-height: 68px;
        }
        .user-list :global(.is-banned) {
          border-color: var(--rr-red) !important;
        }
        .user-list :global(.user-main) {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
          min-width: 0;
        }
        .user-list :global(.user-alias) {
          font-weight: 900;
          color: var(--rr-navy);
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .user-list :global(.user-meta) {
          font-size: 0.82rem;
          color: rgba(13, 42, 74, 0.78);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .user-list :global(.user-stats) {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
          font-size: 0.8rem;
          color: rgba(13, 42, 74, 0.8);
          white-space: nowrap;
        }
        .user-list :global(.stat strong) {
          color: var(--rr-navy);
        }
        .user-list :global(.chevron) {
          font-size: 1.4rem;
          font-weight: 800;
          color: rgba(13, 42, 74, 0.45);
        }
        .user-list :global(.chip) {
          font-size: 0.68rem;
          font-weight: 900;
          padding: 2px 8px;
          border-radius: 999px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .user-list :global(.chip-admin) {
          background: var(--rr-navy);
          color: #fff;
        }
        .user-list :global(.chip-banned) {
          background: var(--rr-red);
          color: #fff;
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
        @media (max-width: 520px) {
          .user-list :global(.user-stats) { display: none; }
        }
      `}</style>
    </>
  )
}
