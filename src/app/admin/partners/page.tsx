'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { PARTNER_SELECT, type Partner } from '@/lib/partners'
import { AdminShell } from '@/components/admin/AdminShell'
import { RefreshButton } from '@/components/admin/RefreshButton'

type Draft = Omit<Partner, 'id' | 'sort_order'> & { id: string | null; sort_order: number }

const MAX_LOGO_BYTES = 2 * 1024 * 1024
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
const MAX_FACTS = 4

const blankDraft = (sortOrder: number): Draft => ({
  id: null,
  name: '',
  logo_url: '',
  blurb: '',
  facts: [],
  href: '',
  sort_order: sortOrder,
  is_active: true,
  is_featured: true,
})

const slug = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'partner'

export default function AdminPartnersPage() {
  return (
    <AdminShell
      title="Partners"
      subtitle="What families see on the Partners page and the home page's Featured Partners."
      allow={['super_admin', 'partner_manager']}
    >
      {() => <PartnersManager />}
    </AdminShell>
  )
}

function PartnersManager() {
  const reduceMotion = useReducedMotion()
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [moving, setMoving] = useState<string | null>(null)

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    if (mode === 'initial') setLoading(true)
    else setRefreshing(true)
    const { data, error: loadError } = await supabase
      .from('partners')
      .select(PARTNER_SELECT)
      .order('sort_order', { ascending: true })
    if (loadError) {
      console.error('partners load failed:', loadError)
      setError(/relation|does not exist/i.test(loadError.message)
        ? 'The partners table doesn’t exist yet — run the v5 SQL migration first.'
        : 'Could not load partners.')
    } else {
      setError(null)
      setPartners((data as Partner[]) ?? [])
    }
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { load('initial') }, [load])

  // Swap display order with the neighbour above/below.
  const move = async (index: number, dir: -1 | 1) => {
    const a = partners[index]
    const b = partners[index + dir]
    if (!a || !b) return
    setMoving(a.id)
    const next = [...partners]
    next[index] = { ...b, sort_order: a.sort_order }
    next[index + dir] = { ...a, sort_order: b.sort_order }
    // Keep orders distinct even if two rows started with the same number.
    if (next[index].sort_order === next[index + dir].sort_order) {
      next.forEach((p, i) => { p.sort_order = i + 1 })
    }
    setPartners(next)
    const results = await Promise.all(
      next.map((p) => supabase.from('partners').update({ sort_order: p.sort_order }).eq('id', p.id))
    )
    setMoving(null)
    if (results.some((r) => r.error)) {
      setAnnouncement('Could not save the new order.')
      load('refresh')
    } else {
      setAnnouncement(`${a.name} moved ${dir < 0 ? 'up' : 'down'}.`)
    }
  }

  const onSaved = (message: string) => {
    setDraft(null)
    setAnnouncement(message)
    load('refresh')
  }

  return (
    <>
      <div className="toolbar">
        <motion.button
          type="button"
          className="clay-btn add-btn"
          onClick={() => setDraft(blankDraft((partners[partners.length - 1]?.sort_order ?? 0) + 1))}
          whileTap={reduceMotion ? undefined : { scale: 0.96 }}
          disabled={!!draft && draft.id === null}
        >
          + Add partner
        </motion.button>
        <RefreshButton onClick={() => load('refresh')} refreshing={refreshing} label="Refresh partners" />
      </div>

      <div className="sr-only" role="status" aria-live="polite">{announcement}</div>
      {error && <p className="error" role="alert">{error}</p>}
      {loading && <p className="muted" role="status">Loading partners…</p>}

      <AnimatePresence initial={false}>
        {draft && draft.id === null && (
          <motion.div
            key="new"
            initial={reduceMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <PartnerEditor draft={draft} onCancel={() => setDraft(null)} onSaved={onSaved} />
          </motion.div>
        )}
      </AnimatePresence>

      {!loading && !error && partners.length === 0 && !draft && (
        <p className="muted">No partners yet. Add your first one.</p>
      )}

      <ul className="partner-list">
        {partners.map((p, i) => {
          const editing = draft?.id === p.id
          return (
            <motion.li key={p.id} layout={!reduceMotion} transition={{ type: 'spring', stiffness: 400, damping: 34 }}>
              {editing ? (
                <PartnerEditor draft={draft!} onCancel={() => setDraft(null)} onSaved={onSaved} />
              ) : (
                <div className={`clay-card partner-row ${!p.is_active ? 'row-hidden' : ''}`}>
                  <div className="order-btns">
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Move ${p.name} up`}
                      disabled={i === 0 || !!moving}
                      onClick={() => move(i, -1)}
                    >▲</button>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Move ${p.name} down`}
                      disabled={i === partners.length - 1 || !!moving}
                      onClick={() => move(i, 1)}
                    >▼</button>
                  </div>
                  <span className="logo-box">
                    {p.logo_url ? <img src={p.logo_url} alt="" /> : <span aria-hidden="true">🤝</span>}
                  </span>
                  <span className="row-main">
                    <span className="row-name">{p.name}</span>
                    <span className="row-chips">
                      {p.is_active ? <span className="chip chip-live">Live</span> : <span className="chip chip-hidden">Hidden</span>}
                      {p.is_featured && p.is_active && <span className="chip chip-featured">★ Home page</span>}
                      {p.href && <span className="row-url">{p.href.replace(/^https?:\/\//, '')}</span>}
                    </span>
                  </span>
                  <button type="button" className="clay-btn edit-btn" onClick={() => setDraft({ ...p })}>
                    Edit
                  </button>
                </div>
              )}
            </motion.li>
          )
        })}
      </ul>

      <style jsx>{`
        .toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .toolbar :global(.add-btn) {
          min-height: 44px;
          background: var(--rr-red) !important;
          color: #fff !important;
        }
        .toolbar :global(.add-btn:focus-visible) { outline: 3px solid var(--rr-yellow); outline-offset: 2px; }
        .error { color: var(--rr-red); font-weight: 800; }
        .muted { color: rgba(13, 42, 74, 0.8); font-weight: 700; }
        .partner-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .partner-list :global(.partner-row) {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
        }
        .partner-list :global(.row-hidden) { opacity: 0.65; }
        .order-btns {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .icon-btn {
          width: 44px;
          height: 28px;
          border-radius: 8px;
          border: 2px solid var(--rr-navy);
          background: #fff;
          color: var(--rr-navy);
          font-size: 0.7rem;
          cursor: pointer;
        }
        .icon-btn:disabled { opacity: 0.3; cursor: default; }
        .icon-btn:focus-visible { outline: 3px solid var(--rr-yellow); outline-offset: 2px; }
        .logo-box {
          width: 56px;
          height: 56px;
          flex-shrink: 0;
          border-radius: 10px;
          background: var(--rr-ice, #d6effa);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          font-size: 26px;
        }
        .logo-box img { width: 100%; height: 100%; object-fit: contain; }
        .row-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
        .row-name { font-weight: 900; color: var(--rr-navy); }
        .row-chips { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .row-url {
          font-size: 0.8rem;
          color: rgba(13, 42, 74, 0.78);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 220px;
        }
        .chip {
          font-size: 0.68rem;
          font-weight: 900;
          padding: 2px 8px;
          border-radius: 999px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .chip-live { background: var(--rr-green); color: var(--rr-navy); }
        .chip-hidden { background: rgba(13, 42, 74, 0.12); color: var(--rr-navy); }
        .chip-featured { background: var(--rr-yellow); color: var(--rr-navy); }
        .partner-list :global(.edit-btn) {
          min-height: 44px;
          min-width: 80px;
          background: #fff !important;
          border: 2px solid var(--rr-navy) !important;
          color: var(--rr-navy) !important;
        }
        .partner-list :global(.edit-btn:focus-visible) { outline: 3px solid var(--rr-yellow); outline-offset: 2px; }
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

// ─── Editor with live preview ──────────────────────────────────────────────────
function PartnerEditor({
  draft: initial,
  onCancel,
  onSaved,
}: {
  draft: Draft
  onCancel: () => void
  onSaved: (message: string) => void
}) {
  const reduceMotion = useReducedMotion()
  const [d, setD] = useState<Draft>(initial)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { nameRef.current?.focus() }, [])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setD((prev) => ({ ...prev, [key]: value }))

  const uploadLogo = async (file: File) => {
    setError(null)
    if (!LOGO_TYPES.includes(file.type)) {
      setError('Logo must be a PNG, JPG, WebP or SVG.')
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError('Logo must be under 2 MB.')
      return
    }
    setUploading(true)
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const path = `${slug(d.name)}-${Date.now()}.${ext}`
    const { error: upError } = await supabase.storage.from('partner-logos').upload(path, file, {
      cacheControl: '31536000',
      upsert: false,
      contentType: file.type,
    })
    setUploading(false)
    if (upError) {
      console.error('logo upload failed:', upError)
      setError('Upload failed — check the v5 SQL migration has been run.')
      return
    }
    const { data } = supabase.storage.from('partner-logos').getPublicUrl(path)
    set('logo_url', data.publicUrl)
  }

  const save = async () => {
    setError(null)
    const name = d.name.trim()
    const href = d.href.trim()
    if (!name) { setError('Give the partner a name.'); return }
    if (href && !/^https?:\/\//i.test(href)) { setError('Website should start with https://'); return }

    const row = {
      name,
      href,
      logo_url:    d.logo_url.trim(),
      blurb:       d.blurb.trim(),
      facts:       d.facts.map((f) => f.trim()).filter(Boolean).slice(0, MAX_FACTS),
      sort_order:  d.sort_order,
      is_active:   d.is_active,
      is_featured: d.is_featured,
    }

    setSaving(true)
    const { error: saveError } = d.id
      ? await supabase.from('partners').update(row).eq('id', d.id)
      : await supabase.from('partners').insert(row)
    setSaving(false)

    if (saveError) {
      console.error('partner save failed:', saveError)
      setError(saveError.message || 'Could not save.')
      return
    }
    onSaved(d.id ? `${name} saved.` : `${name} added.`)
  }

  const remove = async () => {
    if (!d.id) return
    setSaving(true)
    const { error: delError } = await supabase.from('partners').delete().eq('id', d.id)
    setSaving(false)
    if (delError) {
      setError(delError.message || 'Could not delete.')
      return
    }
    onSaved(`${d.name} deleted.`)
  }

  const facts = d.facts.length ? d.facts : ['']

  return (
    <section className="clay-card editor" aria-label={d.id ? `Edit ${initial.name}` : 'New partner'}>
      <div className="editor-grid">
        {/* ── Form ─────────────────────────────────────────────────────── */}
        <div className="form">
          <label htmlFor="p-name">Name</label>
          <input id="p-name" ref={nameRef} value={d.name} onChange={(e) => set('name', e.target.value)} maxLength={80} />

          <label htmlFor="p-href">Website</label>
          <input id="p-href" type="url" inputMode="url" placeholder="https://" value={d.href} onChange={(e) => set('href', e.target.value)} />

          <span className="label">Logo</span>
          <div className="logo-row">
            <span className="logo-preview">
              {d.logo_url ? <img src={d.logo_url} alt="Current logo" /> : <span aria-hidden="true">🤝</span>}
            </span>
            <input
              ref={fileRef}
              type="file"
              accept={LOGO_TYPES.join(',')}
              className="sr-only"
              id="p-logo"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) uploadLogo(file)
                e.target.value = ''
              }}
            />
            <button type="button" className="clay-btn btn-outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? 'Uploading…' : d.logo_url ? 'Replace logo' : 'Upload logo'}
            </button>
          </div>
          <p className="hint">PNG, JPG, WebP or SVG, under 2 MB. Square-ish logos look best.</p>

          <label htmlFor="p-blurb">
            About <span className="count">{d.blurb.length}/600</span>
          </label>
          <textarea id="p-blurb" rows={5} maxLength={600} value={d.blurb} onChange={(e) => set('blurb', e.target.value)} />

          <span className="label">Quick facts <span className="count">(up to {MAX_FACTS})</span></span>
          {facts.map((f, i) => (
            <div className="fact-row" key={i}>
              <input
                aria-label={`Fact ${i + 1}`}
                value={f}
                maxLength={40}
                placeholder="e.g. Since 2003"
                onChange={(e) => {
                  const next = [...facts]
                  next[i] = e.target.value
                  set('facts', next)
                }}
              />
              <button
                type="button"
                className="icon-btn"
                aria-label={`Remove fact ${i + 1}`}
                onClick={() => set('facts', facts.filter((_, j) => j !== i))}
              >✕</button>
            </div>
          ))}
          {facts.length < MAX_FACTS && (
            <button type="button" className="link-btn" onClick={() => set('facts', [...facts, ''])}>+ Add a fact</button>
          )}

          <div className="toggles">
            <label className="toggle">
              <input type="checkbox" checked={d.is_active} onChange={(e) => set('is_active', e.target.checked)} />
              Show on the Partners page
            </label>
            <label className="toggle">
              <input type="checkbox" checked={d.is_featured} onChange={(e) => set('is_featured', e.target.checked)} disabled={!d.is_active} />
              Feature on the home page
            </label>
          </div>
        </div>

        {/* ── Live preview ─────────────────────────────────────────────── */}
        <div className="preview" aria-hidden="true">
          <span className="preview-label">Preview</span>
          <div className="pv-button">
            <span className="pv-logo">{d.logo_url ? <img src={d.logo_url} alt="" /> : '🤝'}</span>
            <span className="pv-name">{d.name || 'Partner name'}</span>
          </div>
          <div className="pv-modal">
            <span className="pv-modal-logo">{d.logo_url ? <img src={d.logo_url} alt="" /> : '🤝'}</span>
            <strong className="pv-title">{d.name || 'Partner name'}</strong>
            <AnimatePresence initial={false}>
              {d.facts.filter((f) => f.trim()).length > 0 && (
                <motion.div className="pv-facts" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {d.facts.filter((f) => f.trim()).map((f, i) => <span key={i} className="pv-fact">{f}</span>)}
                </motion.div>
              )}
            </AnimatePresence>
            <p className="pv-blurb">{d.blurb || 'A short description of the partner appears here.'}</p>
            {d.href && <span className="pv-cta">Visit website →</span>}
          </div>
        </div>
      </div>

      {error && <p className="err" role="alert">{error}</p>}

      <div className="actions">
        <button type="button" className="clay-btn btn-primary" onClick={save} disabled={saving || uploading}>
          {saving ? 'Saving…' : d.id ? 'Save changes' : 'Add partner'}
        </button>
        <button type="button" className="clay-btn btn-outline" onClick={onCancel} disabled={saving}>Cancel</button>
        {d.id && (
          confirmDelete ? (
            <span className="confirm">
              Delete for good?
              <button type="button" className="clay-btn btn-danger" onClick={remove} disabled={saving}>Yes, delete</button>
              <button type="button" className="clay-btn btn-outline" onClick={() => setConfirmDelete(false)}>No</button>
            </span>
          ) : (
            <button type="button" className="link-btn danger" onClick={() => setConfirmDelete(true)}>Delete partner</button>
          )
        )}
      </div>

      <style jsx>{`
        .editor { padding: 18px; margin-bottom: 4px; }
        .editor-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
          gap: 20px;
        }
        @media (max-width: 760px) { .editor-grid { grid-template-columns: 1fr; } }
        label, .label {
          display: block;
          font-weight: 800;
          color: var(--rr-navy);
          margin: 12px 0 4px;
          font-size: 0.85rem;
        }
        .count { font-weight: 700; color: rgba(13, 42, 74, 0.7); }
        input:not([type='checkbox']):not([type='file']), textarea {
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
        input:focus, textarea:focus {
          outline: 3px solid var(--rr-yellow);
          outline-offset: 1px;
          border-color: var(--rr-navy);
        }
        .logo-row { display: flex; align-items: center; gap: 12px; }
        .logo-preview {
          width: 64px;
          height: 64px;
          border-radius: 12px;
          background: var(--rr-ice, #d6effa);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          font-size: 28px;
          flex-shrink: 0;
        }
        .logo-preview img { width: 100%; height: 100%; object-fit: contain; }
        .hint { margin: 4px 0 0; font-size: 0.78rem; color: rgba(13, 42, 74, 0.75); }
        .fact-row { display: flex; gap: 8px; margin-bottom: 6px; }
        .icon-btn {
          flex-shrink: 0;
          width: 44px;
          height: 44px;
          border-radius: 10px;
          border: 2px solid rgba(13, 42, 74, 0.3);
          background: #fff;
          color: var(--rr-navy);
          cursor: pointer;
        }
        .icon-btn:focus-visible { outline: 3px solid var(--rr-yellow); outline-offset: 2px; }
        .link-btn {
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
        .link-btn.danger { color: var(--rr-red); margin-left: auto; }
        .link-btn:focus-visible { outline: 3px solid var(--rr-yellow); outline-offset: 2px; border-radius: 4px; }
        .toggles { margin-top: 12px; display: flex; flex-direction: column; }
        .toggle {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 44px;
          margin: 0;
          font-weight: 700;
          cursor: pointer;
        }
        .toggle input { width: 22px; height: 22px; accent-color: var(--rr-navy); }
        .preview {
          background: var(--rr-ice, #d6effa);
          border-radius: 14px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .preview-label {
          font-size: 0.72rem;
          font-weight: 900;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: rgba(13, 42, 74, 0.75);
        }
        .pv-button, .pv-modal {
          background: #fff;
          border: 2px solid var(--rr-navy);
          border-radius: 10px;
        }
        .pv-button { display: flex; align-items: center; gap: 12px; padding: 10px 12px; }
        .pv-logo, .pv-modal-logo {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          flex-shrink: 0;
        }
        .pv-logo img, .pv-modal-logo img { width: 100%; height: 100%; object-fit: contain; }
        .pv-name { font-weight: 800; color: var(--rr-navy); font-size: 0.9rem; }
        .pv-modal { padding: 14px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; }
        .pv-modal-logo { width: 72px; height: 72px; font-size: 36px; }
        .pv-title { color: var(--rr-navy); font-size: 1rem; }
        .pv-facts { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
        .pv-fact {
          font-size: 0.72rem;
          font-weight: 800;
          padding: 3px 9px;
          border-radius: 999px;
          background: var(--rr-ice, #d6effa);
          color: var(--rr-navy);
        }
        .pv-blurb {
          margin: 0;
          font-size: 0.8rem;
          line-height: 1.5;
          color: rgba(13, 42, 74, 0.85);
          display: -webkit-box;
          -webkit-line-clamp: 6;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .pv-cta { font-size: 0.8rem; font-weight: 900; color: var(--rr-red); }
        .err { color: var(--rr-red); font-weight: 800; margin: 12px 0 0; }
        .actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 16px; }
        .confirm { display: flex; align-items: center; gap: 8px; font-weight: 800; color: var(--rr-red); margin-left: auto; flex-wrap: wrap; }
        .editor :global(.clay-btn) { min-height: 44px; min-width: 100px; }
        .editor :global(.btn-primary) { background: var(--rr-navy) !important; color: #fff !important; }
        .editor :global(.btn-danger) { background: var(--rr-red) !important; color: #fff !important; }
        .editor :global(.btn-outline) {
          background: #fff !important;
          border: 2px solid var(--rr-navy) !important;
          color: var(--rr-navy) !important;
        }
        .editor :global(.clay-btn:focus-visible) { outline: 3px solid var(--rr-yellow); outline-offset: 2px; }
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
