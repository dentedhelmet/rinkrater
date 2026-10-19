'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface ConnectionStatus {
  connected:       boolean
  username?:       string
  expires_at?:     string | null
  days_left?:      number | null
  last_import_at?: string | null
}

interface ImportResult {
  imported:   { title: string; slug: string }[]
  skipped:    number
  problems:   string[]
  connection: ConnectionStatus
}

async function call(method: 'GET' | 'POST', body?: unknown) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const res = await fetch('/api/admin/instagram', {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`)
  return json
}

const when = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : 'never'

/**
 * HQ → Blog: connect the Rink Rater Instagram account and pull new posts in
 * as drafts. Super Admins only. Calls onImported so the post list refreshes.
 */
export function InstagramPanel({ onImported }: { onImported: (message: string) => void }) {
  const [status, setStatus] = useState<ConnectionStatus | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'import' | 'connect' | null>(null)
  const [showConnect, setShowConnect] = useState(false)
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  const load = useCallback(async () => {
    try {
      const s = await call('GET')
      setStatus(s)
      setLoadError(null)
      if (!s.connected) setShowConnect(true)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load the Instagram connection.')
    }
  }, [])

  useEffect(() => { load() }, [load])

  const connect = async () => {
    setError(null)
    setBusy('connect')
    try {
      const s = await call('POST', { action: 'connect', token })
      setStatus(s)
      setToken('')
      setShowConnect(false)
      onImported(`Connected to @${s.username}.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect.')
    }
    setBusy(null)
  }

  const runImport = async () => {
    setError(null)
    setResult(null)
    setBusy('import')
    try {
      const r: ImportResult = await call('POST', { action: 'import' })
      setResult(r)
      setStatus(r.connection)
      const n = r.imported.length
      onImported(n === 0 ? 'No new Instagram posts to import.' : `Imported ${n} Instagram post${n === 1 ? '' : 's'} as draft${n === 1 ? '' : 's'}.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.')
    }
    setBusy(null)
  }

  const expiringSoon = status?.connected && status.days_left != null && status.days_left <= 10

  return (
    <section className="clay-card ig" aria-labelledby="ig-heading">
      <div className="ig-head">
        <h2 id="ig-heading">
          <span aria-hidden="true">📸</span> Instagram
        </h2>
        {status?.connected && (
          <span className="ig-who">
            @{status.username} · last import {when(status.last_import_at)}
          </span>
        )}
      </div>

      {loadError && <p className="ig-err" role="alert">{loadError}</p>}

      {status?.connected && (
        <>
          <p className="ig-text">
            Pulls your newest Instagram posts in as <strong>drafts</strong>: caption, photo and a link back to the
            original. Posts already imported are skipped.
          </p>
          {expiringSoon && (
            <p className="ig-warn" role="status">
              The Instagram connection expires in {status.days_left} day{status.days_left === 1 ? '' : 's'}. Running an
              import renews it.
            </p>
          )}
          <div className="ig-actions">
            <button type="button" className="clay-btn ig-primary" onClick={runImport} disabled={!!busy}>
              {busy === 'import' ? 'Importing…' : 'Import new posts'}
            </button>
            <button type="button" className="ig-link" onClick={() => setShowConnect((v) => !v)} aria-expanded={showConnect}>
              {showConnect ? 'Cancel' : 'Replace token'}
            </button>
          </div>
        </>
      )}

      {showConnect && (
        <div className="ig-connect">
          {!status?.connected && (
            <p className="ig-text">
              Connect the Rink Rater Instagram account once. In your Meta app, go to <strong>Instagram → API setup
              with Instagram business login</strong>, click <strong>Generate token</strong> next to the account, and
              paste it here.
            </p>
          )}
          <label htmlFor="ig-token">Access token</label>
          <input
            id="ig-token"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && token.trim()) connect() }}
            placeholder="IGAA…"
          />
          <div className="ig-actions">
            <button type="button" className="clay-btn ig-primary" onClick={connect} disabled={!!busy || !token.trim()}>
              {busy === 'connect' ? 'Connecting…' : status?.connected ? 'Save new token' : 'Connect Instagram'}
            </button>
          </div>
        </div>
      )}

      {error && <p className="ig-err" role="alert">{error}</p>}

      {result && (result.imported.length > 0 || result.problems.length > 0) && (
        <div className="ig-result">
          {result.imported.length > 0 && (
            <>
              <strong>New drafts:</strong>
              <ul>{result.imported.map((p) => <li key={p.slug}>{p.title}</li>)}</ul>
            </>
          )}
          {result.problems.length > 0 && (
            <>
              <strong>Needs a look:</strong>
              <ul>{result.problems.map((p, i) => <li key={i}>{p}</li>)}</ul>
            </>
          )}
        </div>
      )}

      <style jsx>{`
        .ig { padding: 14px 16px; margin-bottom: 16px; }
        .ig-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
        h2 { margin: 0; font-size: 1.05rem; font-weight: 900; color: var(--rr-navy); }
        .ig-who { font-size: 0.8rem; font-weight: 700; color: rgba(13, 42, 74, 0.85); }
        .ig-text { margin: 8px 0 0; font-size: 0.88rem; line-height: 1.5; color: var(--rr-navy); }
        .ig-warn {
          margin: 10px 0 0;
          padding: 8px 12px;
          border-radius: 10px;
          background: var(--rr-yellow);
          color: var(--rr-navy);
          font-weight: 800;
          font-size: 0.85rem;
        }
        .ig-err { margin: 10px 0 0; color: var(--rr-red); font-weight: 800; }
        .ig-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 12px; }
        .ig :global(.ig-primary) {
          min-height: 44px;
          background: var(--rr-navy) !important;
          color: #fff !important;
        }
        .ig :global(.ig-primary:focus-visible) { outline: 3px solid var(--rr-yellow); outline-offset: 2px; }
        .ig-link {
          background: none;
          border: none;
          padding: 0;
          min-height: 44px;
          font-family: inherit;
          font-weight: 800;
          color: var(--rr-navy);
          text-decoration: underline;
          cursor: pointer;
        }
        .ig-link:focus-visible { outline: 3px solid var(--rr-yellow); outline-offset: 2px; border-radius: 4px; }
        .ig-connect { margin-top: 12px; }
        label { display: block; font-weight: 800; color: var(--rr-navy); margin: 10px 0 4px; font-size: 0.85rem; }
        input {
          width: 100%;
          box-sizing: border-box;
          min-height: 44px;
          padding: 10px 12px;
          border-radius: 10px;
          border: 2px solid rgba(13, 42, 74, 0.3);
          font-family: inherit;
          font-size: 0.95rem;
          color: var(--rr-navy);
        }
        input:focus { outline: 3px solid var(--rr-yellow); outline-offset: 1px; border-color: var(--rr-navy); }
        .ig-result {
          margin-top: 12px;
          padding: 10px 14px;
          border-radius: 10px;
          background: var(--rr-ice);
          color: var(--rr-navy);
          font-size: 0.88rem;
        }
        .ig-result ul { margin: 4px 0 8px; padding-left: 1.2em; }
      `}</style>
    </section>
  )
}
