'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { AdminRole } from '@/lib/useAdminRole'
import { AdminShell } from '@/components/admin/AdminShell'
import { RefreshButton } from '@/components/admin/RefreshButton'
import { UserAvatar } from '@/components/admin/UserAvatar'
import { ADMIN_SECTIONS, ROLE_LABELS } from '@/components/admin/adminSections'

interface AdminRow {
  user_id:         string
  role:            AdminRole
  created_at:      string
  email:           string | null
  alias:           string | null
  initials:        string | null
  avatar_url:      string | null
  last_sign_in_at: string | null
  granted_by:      string | null
}

const ROLES: AdminRole[] = ['super_admin', 'moderator', 'partner_manager']

// What each role can open, read straight from the dashboard's section list so
// it always matches reality.
const accessFor = (role: AdminRole) =>
  ADMIN_SECTIONS.filter((s) => s.roles.includes(role) && s.status === 'live').map((s) => s.title)

const fmt = (v: string | null) => (v ? new Date(v).toLocaleDateString() : 'never')

export default function AdminTeamPage() {
  return (
    <AdminShell title="Admin Team" subtitle="Who can get into Rink Rater HQ, and what they can do there." allow={['super_admin']}>
      {() => <TeamManager />}
    </AdminShell>
  )
}

function TeamManager() {
  const reduceMotion = useReducedMotion()
  const { user } = useAuth()
  const [admins, setAdmins] = useState<AdminRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')

  // Add form
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<AdminRole>('moderator')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Row actions
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [rowError, setRowError] = useState<Record<string, string>>({})

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    if (mode === 'initial') setLoading(true)
    else setRefreshing(true)
    const { data, error: rpcError } = await supabase.rpc('admin_list_admins')
    if (rpcError) {
      console.error('admin_list_admins failed:', rpcError)
      setError(/function .* does not exist|Could not find/i.test(rpcError.message)
        ? 'Run the v5 SQL migration to turn on Admin Team.'
        : 'Could not load the admin team.')
    } else {
      setError(null)
      setAdmins((data as AdminRow[]) ?? [])
    }
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { load('initial') }, [load])

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddError(null)
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setAddError('Enter their email address.')
      return
    }
    setAdding(true)
    const { data, error: rpcError } = await supabase.rpc('admin_grant_role', { p_email: email.trim(), p_role: role })
    setAdding(false)
    if (rpcError) {
      setAddError(rpcError.message || 'Could not add them.')
      return
    }
    const previous = (data as { previous_role?: AdminRole | null })?.previous_role
    setAnnouncement(previous
      ? `${email.trim()} changed from ${ROLE_LABELS[previous]} to ${ROLE_LABELS[role]}.`
      : `${email.trim()} added as ${ROLE_LABELS[role]}.`)
    setEmail('')
    load('refresh')
  }

  const changeRole = async (row: AdminRow, next: AdminRole) => {
    if (!row.email || next === row.role) return
    setBusy(row.user_id)
    setRowError((p) => ({ ...p, [row.user_id]: '' }))
    const { error: rpcError } = await supabase.rpc('admin_grant_role', { p_email: row.email, p_role: next })
    setBusy(null)
    if (rpcError) {
      setRowError((p) => ({ ...p, [row.user_id]: rpcError.message }))
      return
    }
    setAnnouncement(`${row.alias || row.email} is now ${ROLE_LABELS[next]}.`)
    load('refresh')
  }

  const remove = async (row: AdminRow) => {
    setBusy(row.user_id)
    const { error: rpcError } = await supabase.rpc('admin_revoke_role', { p_user_id: row.user_id })
    setBusy(null)
    setConfirmRemove(null)
    if (rpcError) {
      setRowError((p) => ({ ...p, [row.user_id]: rpcError.message }))
      return
    }
    setAdmins((prev) => prev.filter((a) => a.user_id !== row.user_id))
    setAnnouncement(`${row.alias || row.email} no longer has admin access.`)
  }

  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">{announcement}</div>

      {/* ── Add ──────────────────────────────────────────────────────────── */}
      <form className="clay-card add-card" onSubmit={add} aria-labelledby="add-h">
        <h2 id="add-h">Add someone</h2>
        <p className="help">They need a Rink Rater account first. Once added, Rink Rater HQ appears on their Profile page.</p>
        <div className="add-row">
          <div className="field grow">
            <label htmlFor="add-email">Email</label>
            <input id="add-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
          </div>
          <div className="field">
            <label htmlFor="add-role">Role</label>
            <select id="add-role" value={role} onChange={(e) => setRole(e.target.value as AdminRole)}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          <motion.button
            type="submit"
            className="clay-btn add-btn"
            disabled={adding}
            whileTap={reduceMotion ? undefined : { scale: 0.96 }}
          >
            {adding ? 'Adding…' : 'Add'}
          </motion.button>
        </div>
        <p className="role-access">
          <strong>{ROLE_LABELS[role]}</strong> can open: {accessFor(role).join(', ') || 'the hub only'}.
        </p>
        {addError && <p className="err" role="alert">{addError}</p>}
      </form>

      {/* ── Team ─────────────────────────────────────────────────────────── */}
      <div className="list-head">
        <h2>Current team</h2>
        <RefreshButton onClick={() => load('refresh')} refreshing={refreshing} label="Refresh team" />
      </div>

      {error && <p className="err" role="alert">{error}</p>}
      {loading && <p className="muted" role="status">Loading…</p>}

      <ul className="team">
        <AnimatePresence initial={false}>
          {admins.map((a, i) => {
            const isMe = a.user_id === user?.id
            return (
              <motion.li
                key={a.user_id}
                layout={!reduceMotion}
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 8) * 0.04 } }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -80, transition: { duration: 0.25 } }}
              >
                <div className="clay-card member">
                  <UserAvatar alias={a.alias} initials={a.initials} avatarUrl={a.avatar_url} size={48} />
                  <div className="member-main">
                    <span className="member-name">
                      <Link href={`/admin/users/${a.user_id}`} className="member-link">{a.alias || a.email}</Link>
                      {isMe && <span className="chip chip-me">You</span>}
                    </span>
                    <span className="member-meta">
                      {a.email} · added {fmt(a.created_at)}{a.granted_by ? ` by ${a.granted_by}` : ''} · last signed in {fmt(a.last_sign_in_at)}
                    </span>
                    {rowError[a.user_id] && <span className="err small" role="alert">{rowError[a.user_id]}</span>}
                  </div>

                  <div className="member-actions">
                    {isMe ? (
                      <span className={`chip role-${a.role}`}>{ROLE_LABELS[a.role]}</span>
                    ) : (
                      <>
                        <label className="sr-only" htmlFor={`role-${a.user_id}`}>Role for {a.alias || a.email}</label>
                        <select
                          id={`role-${a.user_id}`}
                          value={a.role}
                          disabled={busy === a.user_id}
                          onChange={(e) => changeRole(a, e.target.value as AdminRole)}
                        >
                          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                        </select>
                        {confirmRemove === a.user_id ? (
                          <span className="confirm">
                            <button type="button" className="clay-btn btn-danger" disabled={busy === a.user_id} onClick={() => remove(a)}>Remove</button>
                            <button type="button" className="clay-btn btn-outline" onClick={() => setConfirmRemove(null)}>Keep</button>
                          </span>
                        ) : (
                          <button type="button" className="clay-btn btn-outline-danger" onClick={() => setConfirmRemove(a.user_id)} aria-label={`Remove admin access for ${a.alias || a.email}`}>
                            Remove
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ul>

      <section className="clay-card roles" aria-labelledby="roles-h">
        <h2 id="roles-h">What each role can do</h2>
        <dl>
          {ROLES.map((r) => (
            <div key={r} className="role-def">
              <dt><span className={`chip role-${r}`}>{ROLE_LABELS[r]}</span></dt>
              <dd>{accessFor(r).join(', ') || 'The hub only'}{r === 'super_admin' ? ' — plus managing this team.' : '.'}</dd>
            </div>
          ))}
        </dl>
        <p className="help">Removing someone only takes away admin access. Their regular Rink Rater account keeps working.</p>
      </section>

      <style jsx>{`
        h2 { margin: 0 0 6px; font-weight: 900; color: var(--rr-navy); font-size: 1.1rem; }
        .help { margin: 0 0 12px; color: rgba(13, 42, 74, 0.8); font-size: 0.88rem; }
        :global(.add-card) { padding: 18px; margin-bottom: 22px; }
        .add-row { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; }
        .field { display: flex; flex-direction: column; gap: 4px; }
        .field.grow { flex: 1; min-width: 220px; }
        label { font-weight: 800; color: var(--rr-navy); font-size: 0.85rem; }
        input, select {
          min-height: 44px;
          padding: 8px 12px;
          border-radius: 10px;
          border: 2px solid rgba(13, 42, 74, 0.3);
          font-family: inherit;
          font-size: 0.95rem;
          color: var(--rr-navy);
          background: #fff;
          box-sizing: border-box;
        }
        input { width: 100%; }
        input:focus, select:focus { outline: 3px solid var(--rr-yellow); outline-offset: 1px; border-color: var(--rr-navy); }
        .add-card :global(.add-btn) { min-height: 44px; min-width: 90px; background: var(--rr-red) !important; color: #fff !important; }
        .role-access { margin: 10px 0 0; font-size: 0.85rem; color: rgba(13, 42, 74, 0.85); }
        .err { color: var(--rr-red); font-weight: 800; margin: 8px 0 0; }
        .err.small { font-size: 0.82rem; margin: 2px 0 0; }
        .muted { color: rgba(13, 42, 74, 0.8); font-weight: 700; }
        .list-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .list-head h2 { margin: 0; }
        .team { list-style: none; margin: 0 0 22px; padding: 0; display: flex; flex-direction: column; gap: 10px; }
        .team :global(.member) { display: flex; align-items: center; gap: 12px; padding: 12px 14px; flex-wrap: wrap; }
        .member-main { flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 2px; }
        .member-name { display: flex; align-items: center; gap: 8px; font-weight: 900; color: var(--rr-navy); }
        .member-name :global(.member-link) { color: var(--rr-navy); }
        .member-name :global(.member-link:focus-visible) { outline: 3px solid var(--rr-yellow); outline-offset: 2px; border-radius: 4px; }
        .member-meta { font-size: 0.8rem; color: rgba(13, 42, 74, 0.78); overflow-wrap: anywhere; }
        .member-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .confirm { display: flex; gap: 6px; }
        .chip {
          font-size: 0.7rem; font-weight: 900; padding: 3px 10px; border-radius: 999px;
          text-transform: uppercase; letter-spacing: 0.03em; white-space: nowrap;
        }
        .chip-me { background: var(--rr-yellow); color: var(--rr-navy); }
        .role-super_admin { background: var(--rr-navy); color: #fff; }
        .role-moderator { background: var(--rr-red); color: #fff; }
        .role-partner_manager { background: #2a7ab8; color: #fff; }
        :global(.roles) { padding: 18px; }
        dl { margin: 6px 0 12px; display: flex; flex-direction: column; gap: 10px; }
        .role-def { display: flex; gap: 12px; align-items: baseline; flex-wrap: wrap; }
        dt { min-width: 150px; }
        dd { margin: 0; color: var(--rr-navy); font-size: 0.9rem; flex: 1; }
        .team :global(.clay-btn), .add-card :global(.clay-btn) { min-height: 44px; }
        .team :global(.btn-danger) { background: var(--rr-red) !important; color: #fff !important; }
        .team :global(.btn-outline) { background: #fff !important; border: 2px solid var(--rr-navy) !important; color: var(--rr-navy) !important; }
        .team :global(.btn-outline-danger) { background: #fff !important; border: 2px solid var(--rr-red) !important; color: var(--rr-red) !important; }
        .team :global(.clay-btn:focus-visible), .add-card :global(.clay-btn:focus-visible) { outline: 3px solid var(--rr-yellow); outline-offset: 2px; }
        .sr-only {
          position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
        }
      `}</style>
    </>
  )
}
