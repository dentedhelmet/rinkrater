'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface TaggedRink {
  id:    string
  name:  string
  city:  string
  state: string
}

interface SearchRow {
  rink_id?:   string
  id?:        string
  rink_name?: string
  name?:      string
  city?:      string
  state?:     string
}

/**
 * Pick the rinks a post talks about. Tagged rinks get a "Rinks in this post"
 * card on the article, and the article shows up under "In the news" on each
 * rink's page. Uses the same search as the home page.
 */
export function RinkTagger({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const inputId = useId()
  const listId = useId()
  const [tagged, setTagged] = useState<TaggedRink[]>([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TaggedRink[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load names for rinks already on the post.
  useEffect(() => {
    const missing = value.filter((id) => !tagged.some((t) => t.id === id))
    if (missing.length === 0) return
    supabase
      .from('rinks')
      .select('id, name, city, state')
      .in('id', missing)
      .then(({ data }) => {
        if (!data) return
        setTagged((prev) => {
          const byId = new Map([...prev, ...(data as TaggedRink[])].map((r) => [r.id, r]))
          return value.map((id) => byId.get(id) ?? { id, name: id, city: '', state: '' })
        })
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    const q = query.trim()
    if (q.length < 2) { setResults([]); setSearching(false); return }
    setSearching(true)
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/rinks/search?q=${encodeURIComponent(q)}`)
        const json = await res.json()
        const rows: TaggedRink[] = ((json.rinks ?? []) as SearchRow[]).map((r) => ({
          id:    String(r.rink_id ?? r.id ?? ''),
          name:  String(r.rink_name ?? r.name ?? ''),
          city:  r.city ?? '',
          state: r.state ?? '',
        })).filter((r) => r.id)
        setResults(rows)
        setActive(-1)
        setOpen(true)
      } catch {
        setResults([])
      }
      setSearching(false)
    }, 250)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [query])

  const add = (rink: TaggedRink) => {
    if (!value.includes(rink.id)) {
      setTagged((prev) => [...prev, rink])
      onChange([...value, rink.id])
    }
    setQuery('')
    setResults([])
    setOpen(false)
  }

  const remove = (id: string) => {
    setTagged((prev) => prev.filter((t) => t.id !== id))
    onChange(value.filter((v) => v !== id))
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); add(results[active]) }
    else if (e.key === 'Escape') { setOpen(false) }
  }

  const place = (r: TaggedRink) => [r.city, r.state].filter(Boolean).join(', ')

  return (
    <div className="tagger">
      {tagged.length > 0 && (
        <ul className="chips" aria-label="Tagged rinks">
          {value.map((id) => {
            const r = tagged.find((t) => t.id === id) ?? { id, name: id, city: '', state: '' }
            return (
              <li key={id} className="chip">
                <span>{r.name}{place(r) ? <span className="chip-place"> · {place(r)}</span> : null}</span>
                <button type="button" aria-label={`Remove ${r.name}`} onClick={() => remove(id)}>✕</button>
              </li>
            )
          })}
        </ul>
      )}

      <label htmlFor={inputId}>Add a rink</label>
      <div className="combo">
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          placeholder="Search by rink name, city or state"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          autoComplete="off"
        />
        {searching && <span className="spin" role="status">Searching…</span>}
        {open && results.length > 0 && (
          <ul className="results" id={listId} role="listbox">
            {results.map((r, i) => {
              const already = value.includes(r.id)
              return (
                <li
                  key={r.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  aria-disabled={already}
                  className={`opt ${i === active ? 'opt-active' : ''} ${already ? 'opt-done' : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); if (!already) add(r) }}
                >
                  <strong>{r.name}</strong>
                  <span>{place(r)}{already ? ' · already tagged' : ''}</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <style jsx>{`
        .tagger { display: flex; flex-direction: column; }
        .chips { list-style: none; margin: 0 0 8px; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
        .chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 4px 2px 12px;
          border-radius: 999px;
          background: var(--rr-ice);
          border: 1.5px solid var(--rr-navy);
          font-weight: 800;
          font-size: 0.85rem;
          color: var(--rr-navy);
        }
        .chip-place { font-weight: 600; }
        .chip button {
          width: 36px;
          height: 36px;
          border-radius: 999px;
          border: none;
          background: transparent;
          color: var(--rr-navy);
          cursor: pointer;
          font-weight: 900;
        }
        .chip button:focus-visible { outline: 3px solid var(--rr-yellow); }
        label { display: block; font-weight: 800; color: var(--rr-navy); margin: 4px 0; font-size: 0.85rem; }
        .combo { position: relative; }
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
        .spin { position: absolute; right: 12px; top: 12px; font-size: 0.78rem; font-weight: 700; color: rgba(13, 42, 74, 0.8); }
        .results {
          position: absolute;
          left: 0;
          right: 0;
          top: calc(100% + 4px);
          z-index: 5;
          list-style: none;
          margin: 0;
          padding: 4px;
          background: #fff;
          border: 2px solid var(--rr-navy);
          border-radius: 10px;
          box-shadow: var(--rr-shadow);
          max-height: 280px;
          overflow-y: auto;
        }
        .opt {
          display: flex;
          flex-direction: column;
          padding: 8px 10px;
          min-height: 44px;
          justify-content: center;
          border-radius: 8px;
          cursor: pointer;
          color: var(--rr-navy);
        }
        .opt span { font-size: 0.8rem; color: rgba(13, 42, 74, 0.8); }
        .opt-active, .opt:hover { background: var(--rr-ice); }
        .opt-done { opacity: 0.55; cursor: default; }
      `}</style>
    </div>
  )
}
