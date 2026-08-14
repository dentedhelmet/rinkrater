'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { slugify } from '@/lib/slugify'

// Matches your single-admin RLS check today (auth.users.email).
// When role-based admin access lands, swap this for a role lookup instead.
const ADMIN_EMAIL = 'senan@rinkrater.com'

interface RinkSuggestionRow {
  id: string
  suggestion_type: 'new_rink' | 'edit'
  rink_id: string | null
  submitted_by: string
  payload: Record<string, any>
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  submitter_alias?: string | null
}

export default function AdminRinkSuggestionsPage() {
  const { user, loading: authLoading } = useAuth()

  const [suggestions, setSuggestions] = useState<RinkSuggestionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Per-row transient UI state
  const [rinkIdDrafts, setRinkIdDrafts] = useState<Record<string, string>>({})
  const [notesDrafts, setNotesDrafts] = useState<Record<string, string>>({})
  const [actionError, setActionError] = useState<Record<string, string>>({})
  const [actionPending, setActionPending] = useState<Record<string, boolean>>({})

  const isAdmin = !!user?.email && user.email === ADMIN_EMAIL

  const loadSuggestions = useCallback(async () => {
    setLoading(true)
    setLoadError(null)

    const { data, error } = await supabase
      .from('rink_suggestions')
      .select('id, suggestion_type, rink_id, submitted_by, payload, status, created_at, profiles:submitted_by(alias)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Failed to load rink suggestions:', error)
      setLoadError('Could not load suggestions. Check console for details.')
      setLoading(false)
      return
    }

    const rows: RinkSuggestionRow[] = (data || []).map((row: any) => ({
      ...row,
      submitter_alias: row.profiles?.alias ?? null,
    }))

    setSuggestions(rows)

    // Pre-fill rink ID drafts for new_rink suggestions
    const drafts: Record<string, string> = {}
    rows.forEach((row) => {
      if (row.suggestion_type === 'new_rink') {
        drafts[row.id] = slugify(row.payload.name || '', row.payload.city || '')
      }
    })
    setRinkIdDrafts((prev) => ({ ...drafts, ...prev }))
    setLoading(false)
  }, [])

  useEffect(() => {
    if (isAdmin) loadSuggestions()
  }, [isAdmin, loadSuggestions])

  const setPending = (id: string, val: boolean) =>
    setActionPending((prev) => ({ ...prev, [id]: val }))

  const setError = (id: string, msg: string | null) =>
    setActionError((prev) => ({ ...prev, [id]: msg || '' }))

  const handleApproveNewRink = async (row: RinkSuggestionRow) => {
    const finalId = (rinkIdDrafts[row.id] || '').trim()
    if (!finalId) {
      setError(row.id, 'Enter a rink ID before approving.')
      return
    }

    setPending(row.id, true)
    setError(row.id, null)

    const { error } = await supabase.rpc('approve_new_rink_suggestion', {
      p_suggestion_id: row.id,
      p_rink_id: finalId,
      p_admin_notes: notesDrafts[row.id] || null,
    })

    setPending(row.id, false)

    if (error) {
      console.error('approve_new_rink_suggestion failed:', error)
      setError(row.id, error.message || 'Approval failed.')
      return
    }

    setSuggestions((prev) => prev.filter((s) => s.id !== row.id))
  }

  const handleApproveEdit = async (row: RinkSuggestionRow) => {
    setPending(row.id, true)
    setError(row.id, null)

    const { error } = await supabase.rpc('approve_rink_edit_suggestion', {
      p_suggestion_id: row.id,
      p_admin_notes: notesDrafts[row.id] || null,
    })

    setPending(row.id, false)

    if (error) {
      console.error('approve_rink_edit_suggestion failed:', error)
      setError(row.id, error.message || 'Approval failed.')
      return
    }

    setSuggestions((prev) => prev.filter((s) => s.id !== row.id))
  }

  const handleReject = async (row: RinkSuggestionRow) => {
    setPending(row.id, true)
    setError(row.id, null)

    const { error } = await supabase.rpc('reject_rink_suggestion', {
      p_suggestion_id: row.id,
      p_admin_notes: notesDrafts[row.id] || null,
    })

    setPending(row.id, false)

    if (error) {
      console.error('reject_rink_suggestion failed:', error)
      setError(row.id, error.message || 'Rejection failed.')
      return
    }

    setSuggestions((prev) => prev.filter((s) => s.id !== row.id))
  }

  if (authLoading) {
    return <div className="admin-page-state">Loading…</div>
  }

  if (!isAdmin) {
    return (
      <div className="admin-page-state">
        <h1>Not authorized</h1>
        <p>This page is only available to Rink Rater admins.</p>
      </div>
    )
  }

  return (
    <div className="admin-suggestions-page">
      <h1>Rink Suggestions</h1>
      <p className="subtitle">
        Review new-rink and edit suggestions submitted by users. Approving a
        new rink publishes it live immediately.
      </p>

      {loading && <p>Loading suggestions…</p>}
      {loadError && <p className="load-error">{loadError}</p>}
      {!loading && !loadError && suggestions.length === 0 && (
        <p className="empty-state">No pending suggestions. 🎉</p>
      )}

      <div className="suggestions-list">
        {suggestions.map((row) => (
          <div key={row.id} className="clay-card suggestion-card">
            <div className="card-header">
              <span className={`tier-chip type-${row.suggestion_type}`}>
                {row.suggestion_type === 'new_rink' ? 'New Rink' : 'Edit'}
              </span>
              <span className="submitted-meta">
                {row.submitter_alias || 'Unknown user'} ·{' '}
                {new Date(row.created_at).toLocaleDateString()}
              </span>
            </div>

            {row.suggestion_type === 'new_rink' ? (
              <div className="payload-block">
                <p><strong>{row.payload.name}</strong></p>
                <p>{row.payload.city}, {row.payload.state}</p>
                {row.payload.address && <p>{row.payload.address}</p>}
                {row.payload.rink_type && <p>Type: {row.payload.rink_type}</p>}
                {row.payload.notes && (
                  <p className="user-notes">Note: {row.payload.notes}</p>
                )}

                <label htmlFor={`rink-id-${row.id}`}>Final Rink ID (slug)</label>
                <input
                  id={`rink-id-${row.id}`}
                  type="text"
                  value={rinkIdDrafts[row.id] || ''}
                  onChange={(e) =>
                    setRinkIdDrafts((prev) => ({ ...prev, [row.id]: e.target.value }))
                  }
                />
              </div>
            ) : (
              <div className="payload-block">
                <p className="rink-ref">Rink ID: {row.rink_id}</p>
                <table className="diff-table">
                  <tbody>
                    {Object.entries(row.payload).map(([field, change]: [string, any]) => (
                      <tr key={field}>
                        <td className="diff-field">{field}</td>
                        <td className="diff-old">{change.old || '—'}</td>
                        <td className="diff-arrow">→</td>
                        <td className="diff-new">{change.new || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <label htmlFor={`notes-${row.id}`}>Admin notes (optional)</label>
            <textarea
              id={`notes-${row.id}`}
              rows={2}
              value={notesDrafts[row.id] || ''}
              onChange={(e) =>
                setNotesDrafts((prev) => ({ ...prev, [row.id]: e.target.value }))
              }
              placeholder="Shown back to the user if rejected"
            />

            {actionError[row.id] && (
              <p className="action-error" role="alert">{actionError[row.id]}</p>
            )}

            <div className="action-row">
              <button
                type="button"
                className="clay-btn approve-btn"
                disabled={!!actionPending[row.id]}
                onClick={() =>
                  row.suggestion_type === 'new_rink'
                    ? handleApproveNewRink(row)
                    : handleApproveEdit(row)
                }
              >
                {actionPending[row.id] ? 'Working…' : 'Approve'}
              </button>
              <button
                type="button"
                className="clay-btn reject-btn"
                disabled={!!actionPending[row.id]}
                onClick={() => handleReject(row)}
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .admin-page-state {
          padding: 48px 24px;
          text-align: center;
          color: var(--rr-navy);
        }
        .admin-suggestions-page {
          max-width: 720px;
          margin: 0 auto;
          padding: 32px 16px 80px;
        }
        h1 {
          font-family: 'Nunito', sans-serif;
          color: var(--rr-navy);
          margin-bottom: 4px;
        }
        .subtitle {
          color: rgba(13, 42, 74, 0.75);
          margin-bottom: 24px;
        }
        .load-error {
          color: var(--rr-red);
          font-weight: 700;
        }
        .empty-state {
          color: rgba(13, 42, 74, 0.7);
          font-size: 1.1rem;
        }
        .suggestions-list {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .suggestion-card {
          padding: 20px;
        }
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 12px;
        }
        .tier-chip {
          font-weight: 700;
          font-size: 0.8rem;
          padding: 4px 12px;
          border-radius: 999px;
        }
        .type-new_rink {
          background: var(--rr-green);
          color: white;
        }
        .type-edit {
          background: var(--rr-yellow);
          color: var(--rr-navy);
        }
        .submitted-meta {
          font-size: 0.85rem;
          color: rgba(13, 42, 74, 0.6);
        }
        .payload-block p {
          margin: 4px 0;
          color: var(--rr-navy);
        }
        .user-notes {
          font-style: italic;
          color: rgba(13, 42, 74, 0.75);
        }
        .rink-ref {
          font-size: 0.85rem;
          color: rgba(13, 42, 74, 0.6);
          margin-bottom: 8px;
        }
        .diff-table {
          width: 100%;
          border-collapse: collapse;
          margin: 8px 0;
        }
        .diff-table td {
          padding: 6px 4px;
          font-size: 0.9rem;
          border-bottom: 1px solid rgba(13, 42, 74, 0.08);
        }
        .diff-field {
          font-weight: 700;
          color: var(--rr-navy);
          text-transform: capitalize;
          width: 90px;
        }
        .diff-old {
          color: var(--rr-red);
          text-decoration: line-through;
        }
        .diff-arrow {
          color: rgba(13, 42, 74, 0.4);
          width: 20px;
          text-align: center;
        }
        .diff-new {
          color: var(--rr-green);
          font-weight: 700;
        }
        label {
          display: block;
          font-weight: 700;
          color: var(--rr-navy);
          margin: 12px 0 4px;
          font-size: 0.85rem;
        }
        input,
        textarea {
          width: 100%;
          padding: 10px 12px;
          border-radius: 10px;
          border: 2px solid rgba(13, 42, 74, 0.15);
          font-family: inherit;
          font-size: 0.95rem;
          box-sizing: border-box;
        }
        input:focus,
        textarea:focus {
          outline: 3px solid var(--rr-yellow);
          outline-offset: 1px;
          border-color: var(--rr-navy);
        }
        .action-error {
          color: var(--rr-red);
          font-weight: 700;
          margin: 10px 0 0;
        }
        .action-row {
          display: flex;
          gap: 12px;
          margin-top: 16px;
        }
        .approve-btn,
        .reject-btn {
          flex: 1;
          min-height: 44px;
        }
        .reject-btn {
          background: transparent;
          border: 2px solid var(--rr-red);
          color: var(--rr-red);
        }
      `}</style>
    </div>
  )
}
