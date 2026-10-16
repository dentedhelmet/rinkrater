'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  POST_COLUMNS, SLUG_PATTERN, formatPostDate, htmlToText, postState,
  readingMinutes, slugifyTitle, type Post,
} from '@/lib/blog'
import { RichTextEditor } from './RichTextEditor'
import { RinkTagger } from './RinkTagger'
import styles from '@/components/blog/blog.module.css'

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const EXCERPT_MAX = 160

type PublishMode = 'draft' | 'now' | 'schedule'

/** ISO → value for <input type="datetime-local"> in the browser's time zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Next Monday at 8:00 AM local — a sensible default for scheduling. */
function nextMondayMorning(): string {
  const d = new Date()
  const add = ((8 - d.getDay()) % 7) || 7
  d.setDate(d.getDate() + add)
  d.setHours(8, 0, 0, 0)
  return toLocalInput(d.toISOString())
}

/** Images in the body that are missing a description. */
function imagesMissingAlt(html: string): number {
  if (typeof window === 'undefined') return 0
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return Array.from(doc.querySelectorAll('img')).filter((img) => !(img.getAttribute('alt') ?? '').trim()).length
}

async function uploadBlogImage(file: File, slugHint: string): Promise<string> {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error('Images must be PNG, JPG, WebP or GIF.')
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Images must be under 5 MB.')
  const now = new Date()
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${slugHint || 'post'}-${now.getTime()}.${ext}`
  const { error } = await supabase.storage.from('blog-images').upload(path, file, {
    cacheControl: '31536000',
    upsert: false,
    contentType: file.type,
  })
  if (error) {
    console.error('blog image upload failed:', error)
    throw new Error('Upload failed — check the v6 SQL migration has been run.')
  }
  return supabase.storage.from('blog-images').getPublicUrl(path).data.publicUrl
}

export function PostEditor({
  post,
  canPublish,
  onCancel,
  onSaved,
}: {
  post: Post | null
  /** Super Admins publish, schedule and remove; Moderators write drafts only. */
  canPublish: boolean
  onCancel: () => void
  onSaved: (message: string, saved: Post) => void
}) {
  const state = post ? postState(post) : 'draft'

  const [title, setTitle] = useState(post?.title ?? '')
  const [slug, setSlug] = useState(post?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(!!post)
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? '')
  const [body, setBody] = useState(post?.body_html ?? '')
  const [coverUrl, setCoverUrl] = useState(post?.cover_image_url ?? '')
  const [coverAlt, setCoverAlt] = useState(post?.cover_image_alt ?? '')
  const [rinkIds, setRinkIds] = useState<string[]>(post?.rink_ids ?? [])
  const [instagram, setInstagram] = useState(post?.instagram_permalink ?? '')
  const [mode, setMode] = useState<PublishMode>(
    !canPublish ? 'draft' : state === 'live' ? 'now' : state === 'scheduled' ? 'schedule' : 'draft'
  )
  const [scheduleAt, setScheduleAt] = useState(state === 'scheduled' ? toLocalInput(post!.published_at) : nextMondayMorning())
  const [tab, setTab] = useState<'write' | 'preview'>('write')
  const [saving, setSaving] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [dirty, setDirty] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const coverRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (!post) titleRef.current?.focus() }, [post])

  // Warn before closing the tab with unsaved work.
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const touch = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setDirty(true) }

  const onTitle = (v: string) => {
    setTitle(v)
    setDirty(true)
    if (!slugTouched) setSlug(slugifyTitle(v))
  }

  const onBody = useCallback((html: string) => { setBody(html); setDirty(true) }, [])
  const uploadForBody = useCallback((file: File) => uploadBlogImage(file, slug), [slug])

  const uploadCover = async (file: File) => {
    setError(null)
    setUploadingCover(true)
    try {
      setCoverUrl(await uploadBlogImage(file, slug))
      setDirty(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.')
    }
    setUploadingCover(false)
  }

  const descriptionForGoogle = excerpt.trim() || htmlToText(body).slice(0, EXCERPT_MAX)
  const minutes = useMemo(() => readingMinutes(body), [body])

  const save = async () => {
    setError(null)
    const cleanTitle = title.trim()
    const cleanSlug = slug.trim()
    const publishing = mode !== 'draft'

    if (!cleanTitle) return setError('Give the post a title.')
    if (!SLUG_PATTERN.test(cleanSlug)) return setError('The web address can only use lowercase letters, numbers and dashes.')
    if (coverUrl && !coverAlt.trim()) return setError('Describe the cover image — screen readers and Google read this.')
    const missing = imagesMissingAlt(body)
    if (missing > 0) return setError(`${missing} image${missing > 1 ? 's are' : ' is'} missing a description. Images without one have a red dashed outline — delete and re-insert them.`)
    if (instagram.trim() && !/^https:\/\/(www\.)?instagram\.com\//i.test(instagram.trim())) {
      return setError('The Instagram link should start with https://www.instagram.com/')
    }

    let publishedAt: string | null = null
    if (publishing) {
      if (!htmlToText(body)) return setError('Write something before publishing.')
      if (!excerpt.trim()) return setError('Add a short summary before publishing — it shows in Google and on the blog page.')
      if (mode === 'now') {
        const keepDate = state === 'live' && post?.published_at
        publishedAt = keepDate ? post!.published_at : new Date().toISOString()
      } else {
        const when = new Date(scheduleAt)
        if (!scheduleAt || Number.isNaN(when.getTime())) return setError('Pick a date and time to publish.')
        if (when.getTime() <= Date.now()) return setError('That time has already passed — pick a future time, or choose “Publish now”.')
        publishedAt = when.toISOString()
      }
    }

    const row = {
      title:               cleanTitle,
      slug:                cleanSlug,
      excerpt:             excerpt.trim(),
      body_html:           body,
      cover_image_url:     coverUrl,
      cover_image_alt:     coverUrl ? coverAlt.trim() : '',
      rink_ids:            rinkIds,
      instagram_permalink: instagram.trim(),
      status:              publishing ? 'published' : 'draft',
      published_at:        publishedAt,
    }

    setSaving(true)
    const result = post
      ? await supabase.from('posts').update(row).eq('id', post.id).select(POST_COLUMNS).single()
      : await supabase.from('posts').insert(row).select(POST_COLUMNS).single()
    setSaving(false)

    if (result.error) {
      console.error('post save failed:', result.error)
      if (result.error.code === '23505') return setError('Another post already uses that web address — change it a little.')
      if (/relation|does not exist/i.test(result.error.message)) return setError('The posts table doesn’t exist yet — run the v6 SQL migration first.')
      return setError(result.error.message || 'Could not save.')
    }

    setDirty(false)
    const saved = result.data as Post
    const label =
      mode === 'draft' ? 'Draft saved.' :
      mode === 'now' ? (state === 'live' ? 'Changes are live.' : 'Published — it’s live on the blog.') :
      `Scheduled for ${new Date(saved.published_at!).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.`
    onSaved(`“${cleanTitle}” — ${label}`, saved)
  }

  const removePost = async () => {
    if (!post) return
    setSaving(true)
    const { data, error: rmError } = await supabase
      .from('posts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', post.id)
      .select(POST_COLUMNS)
      .single()
    setSaving(false)
    if (rmError) return setError(rmError.message || 'Could not remove.')
    setDirty(false)
    onSaved(`“${post.title}” removed. You can restore it from the Removed tab.`, data as Post)
  }

  const cancel = () => {
    if (dirty && !window.confirm('Discard your unsaved changes?')) return
    onCancel()
  }

  const saveLabel =
    saving ? 'Saving…' :
    mode === 'draft' ? 'Save draft' :
    mode === 'schedule' ? 'Schedule post' :
    state === 'live' ? 'Update live post' : 'Publish now'

  return (
    <section className="clay-card editor" aria-label={post ? `Edit ${post.title}` : 'New post'}>
      <div className="tabs" role="tablist" aria-label="Editor view">
        <button type="button" role="tab" aria-selected={tab === 'write'} className={`tab ${tab === 'write' ? 'tab-on' : ''}`} onClick={() => setTab('write')}>Write</button>
        <button type="button" role="tab" aria-selected={tab === 'preview'} className={`tab ${tab === 'preview' ? 'tab-on' : ''}`} onClick={() => setTab('preview')}>Preview</button>
        {post && state === 'live' && (
          <a className="view-live" href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer">View live post ↗</a>
        )}
      </div>

      {/* Write view stays mounted (just hidden) so undo history survives a peek at Preview. */}
      <div hidden={tab !== 'write'} className="write-grid">
        <div className="main-col">
          <label htmlFor="post-title">Title</label>
          <input id="post-title" ref={titleRef} className="title-input" value={title} maxLength={140} onChange={(e) => onTitle(e.target.value)} placeholder="e.g. 7 Rinks With the Warmest Bleachers in New England" />

          <span className="label" id="post-body-label">Post</span>
          <RichTextEditor initialHtml={post?.body_html ?? ''} onChange={onBody} uploadImage={uploadForBody} labelId="post-body-label" />
          <p className="hint">{minutes} min read</p>
        </div>

        <aside className="side-col" aria-label="Post settings">
          {/* ── Publishing ─────────────────────────────── */}
          {!canPublish ? (
            <fieldset className="panel">
              <legend>Publishing</legend>
              <p className="draft-note">
                You’re writing a <strong>draft</strong>. When it’s ready, let a Super Admin know — they’ll review it and publish or schedule it.
              </p>
            </fieldset>
          ) : (
          <fieldset className="panel">
            <legend>Publishing</legend>
            <label className="radio">
              <input type="radio" name="mode" checked={mode === 'draft'} onChange={() => { setMode('draft'); setDirty(true) }} />
              Draft (only admins can see it)
            </label>
            <label className="radio">
              <input type="radio" name="mode" checked={mode === 'now'} onChange={() => { setMode('now'); setDirty(true) }} />
              {state === 'live' ? `Live (since ${formatPostDate(post!.published_at)})` : 'Publish now'}
            </label>
            <label className="radio">
              <input type="radio" name="mode" checked={mode === 'schedule'} onChange={() => { setMode('schedule'); setDirty(true) }} />
              Schedule for later
            </label>
            {mode === 'schedule' && (
              <>
                <label htmlFor="post-when" className="sub">Publish on</label>
                <input id="post-when" type="datetime-local" value={scheduleAt} onChange={(e) => touch(setScheduleAt)(e.target.value)} />
                <p className="hint">Your local time. It goes live automatically within a few minutes of this time.</p>
              </>
            )}
          </fieldset>
          )}

          {/* ── Cover image ────────────────────────────── */}
          <fieldset className="panel">
            <legend>Cover image</legend>
            {coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverUrl} alt="" className="cover-thumb" />
            ) : (
              <div className="cover-empty" aria-hidden="true">🏒</div>
            )}
            <input
              ref={coverRef}
              type="file"
              accept={IMAGE_TYPES.join(',')}
              className="sr-only"
              aria-label="Choose cover image"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCover(f); e.target.value = '' }}
            />
            <div className="row">
              <button type="button" className="clay-btn btn-outline" onClick={() => coverRef.current?.click()} disabled={uploadingCover}>
                {uploadingCover ? 'Uploading…' : coverUrl ? 'Replace' : 'Upload cover'}
              </button>
              {coverUrl && (
                <button type="button" className="link-btn" onClick={() => { setCoverUrl(''); setCoverAlt(''); setDirty(true) }}>Remove</button>
              )}
            </div>
            {coverUrl && (
              <>
                <label htmlFor="post-cover-alt" className="sub">Describe the cover image (required)</label>
                <input id="post-cover-alt" value={coverAlt} maxLength={200} onChange={(e) => touch(setCoverAlt)(e.target.value)} />
              </>
            )}
            <p className="hint">Shown on the blog page and when the post is shared. Wide images (16:9) look best.</p>
          </fieldset>

          {/* ── Rinks ──────────────────────────────────── */}
          <fieldset className="panel">
            <legend>Rinks in this post</legend>
            <RinkTagger value={rinkIds} onChange={touch(setRinkIds)} />
            <p className="hint">Each tagged rink shows this post under “In the news” on its rink page.</p>
          </fieldset>

          {/* ── Search & sharing ───────────────────────── */}
          <fieldset className="panel">
            <legend>Search &amp; sharing</legend>
            <label htmlFor="post-slug" className="sub">Web address</label>
            <div className="slug-row">
              <span className="slug-prefix" aria-hidden="true">/blog/</span>
              <input
                id="post-slug"
                value={slug}
                maxLength={120}
                onChange={(e) => { setSlugTouched(true); setDirty(true); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')) }}
                aria-describedby="slug-hint"
              />
            </div>
            <p className="hint" id="slug-hint">
              {state === 'live' ? 'Changing this on a live post breaks links people have already shared.' : 'Filled in from the title — edit if you like.'}
            </p>

            <label htmlFor="post-excerpt" className="sub">
              Short summary <span className="count">{excerpt.length}/{EXCERPT_MAX}</span>
            </label>
            <textarea id="post-excerpt" rows={3} maxLength={EXCERPT_MAX + 40} value={excerpt} onChange={(e) => touch(setExcerpt)(e.target.value)} placeholder="One or two sentences a hockey parent would want to click on." />
            {excerpt.length > EXCERPT_MAX && <p className="hint warn">Google usually cuts this off around {EXCERPT_MAX} characters.</p>}

            <div className="serp" aria-label="How this might look in Google">
              <span className="serp-url">rinkrater.com › blog › {slug || '…'}</span>
              <span className="serp-title">{(title || 'Post title').slice(0, 60)}{title.length > 60 ? '…' : ''} — Rink Rater</span>
              <span className="serp-desc">{descriptionForGoogle.slice(0, EXCERPT_MAX) || 'Your short summary appears here.'}{descriptionForGoogle.length > EXCERPT_MAX ? '…' : ''}</span>
            </div>

            <label htmlFor="post-ig" className="sub">Instagram post link (optional)</label>
            <input id="post-ig" type="url" inputMode="url" placeholder="https://www.instagram.com/p/…" value={instagram} onChange={(e) => touch(setInstagram)(e.target.value)} />
            <p className="hint">Adds a “See it on Instagram” link at the end of the post.</p>
          </fieldset>
        </aside>
      </div>

      {tab === 'preview' && (
        <div className="preview">
          <article className={styles.page}>
            <h1 className={styles.title}>{title || 'Post title'}</h1>
            <p className={styles.byline}>
              {mode === 'schedule' && scheduleAt ? formatPostDate(new Date(scheduleAt).toISOString()) : formatPostDate(post?.published_at ?? new Date().toISOString())}
              {' · '}{minutes} min read
            </p>
            {coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverUrl} alt={coverAlt} className={styles.cover} />
            )}
            <div className={styles.prose} dangerouslySetInnerHTML={{ __html: body || '<p><em>Nothing written yet.</em></p>' }} />
            {rinkIds.length > 0 && (
              <p className="hint">+ “Rinks in this post” card with {rinkIds.length} rink{rinkIds.length > 1 ? 's' : ''} and their review counts.</p>
            )}
          </article>
        </div>
      )}

      {error && <p className="err" role="alert">{error}</p>}

      <div className="actions">
        <button type="button" className="clay-btn btn-primary" onClick={save} disabled={saving || uploadingCover}>{saveLabel}</button>
        <button type="button" className="clay-btn btn-outline" onClick={cancel} disabled={saving}>Close</button>
        {dirty && <span className="unsaved" role="status">Unsaved changes</span>}
        {canPublish && post && !post.deleted_at && (
          confirmRemove ? (
            <span className="confirm">
              Take this post off the blog?
              <button type="button" className="clay-btn btn-danger" onClick={removePost} disabled={saving}>Yes, remove</button>
              <button type="button" className="clay-btn btn-outline" onClick={() => setConfirmRemove(false)}>No</button>
            </span>
          ) : (
            <button type="button" className="link-btn danger" onClick={() => setConfirmRemove(true)}>Remove post</button>
          )
        )}
      </div>

      <style jsx>{`
        .editor { padding: 18px; }
        .tabs { display: flex; align-items: center; gap: 6px; margin-bottom: 14px; flex-wrap: wrap; }
        .tab {
          min-height: 44px;
          padding: 0 18px;
          border-radius: 999px;
          border: 2px solid var(--rr-navy);
          background: #fff;
          color: var(--rr-navy);
          font-family: inherit;
          font-weight: 900;
          cursor: pointer;
        }
        .tab-on { background: var(--rr-navy); color: #fff; }
        .tab:focus-visible { outline: 3px solid var(--rr-yellow); outline-offset: 2px; }
        .view-live { margin-left: auto; font-weight: 800; color: var(--rr-navy); min-height: 44px; display: inline-flex; align-items: center; }
        .write-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 320px;
          gap: 20px;
          align-items: start;
        }
        .write-grid[hidden] { display: none; }
        @media (max-width: 960px) { .write-grid { grid-template-columns: 1fr; } }
        label, .label {
          display: block;
          font-weight: 800;
          color: var(--rr-navy);
          margin: 0 0 6px;
          font-size: 0.85rem;
        }
        .label { margin-top: 16px; }
        .sub { margin-top: 12px; }
        .count { font-weight: 700; color: rgba(13, 42, 74, 0.75); }
        input:not([type='checkbox']):not([type='radio']):not([type='file']), textarea {
          width: 100%;
          box-sizing: border-box;
          min-height: 44px;
          padding: 10px 12px;
          border-radius: 10px;
          border: 2px solid rgba(13, 42, 74, 0.3);
          font-family: inherit;
          font-size: 0.95rem;
          color: var(--rr-navy);
          background: #fff;
        }
        .title-input { font-size: 1.35rem !important; font-weight: 900; }
        input:focus, textarea:focus { outline: 3px solid var(--rr-yellow); outline-offset: 1px; border-color: var(--rr-navy); }
        .hint { margin: 6px 0 0; font-size: 0.78rem; color: rgba(13, 42, 74, 0.85); }
        .hint.warn { color: var(--rr-red); font-weight: 800; }
        .draft-note { margin: 4px 0 0; font-size: 0.85rem; line-height: 1.5; color: var(--rr-navy); }
        .side-col { display: flex; flex-direction: column; gap: 14px; }
        .panel {
          margin: 0;
          border: 2px solid rgba(13, 42, 74, 0.2);
          border-radius: 12px;
          padding: 12px 14px 14px;
          background: #fff;
          min-width: 0;
        }
        legend { font-weight: 900; color: var(--rr-navy); padding: 0 6px; }
        .radio { display: flex; align-items: center; gap: 10px; min-height: 44px; margin: 0; font-weight: 700; cursor: pointer; }
        .radio input { width: 22px; height: 22px; accent-color: var(--rr-navy); flex-shrink: 0; }
        .cover-thumb, .cover-empty {
          width: 100%;
          aspect-ratio: 16 / 9;
          object-fit: cover;
          border-radius: 10px;
          border: 1.5px solid var(--rr-navy);
          background: var(--rr-ice);
          display: block;
          margin-bottom: 8px;
        }
        .cover-empty { display: flex; align-items: center; justify-content: center; font-size: 40px; }
        .row { display: flex; align-items: center; gap: 12px; }
        .slug-row { display: flex; align-items: center; gap: 4px; }
        .slug-prefix { font-weight: 800; color: rgba(13, 42, 74, 0.8); font-size: 0.85rem; }
        .serp {
          margin-top: 12px;
          padding: 10px 12px;
          border-radius: 10px;
          background: var(--rr-warm);
          border: 1.5px dashed rgba(13, 42, 74, 0.35);
          display: flex;
          flex-direction: column;
          gap: 2px;
          font-family: Arial, sans-serif;
        }
        .serp-url { font-size: 0.75rem; color: #202124; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .serp-title { font-size: 1rem; color: #1a0dab; line-height: 1.3; }
        .serp-desc { font-size: 0.8rem; color: #4d5156; line-height: 1.4; }
        .preview {
          background: #fff;
          border: 2px solid rgba(13, 42, 74, 0.2);
          border-radius: 12px;
        }
        .err { color: var(--rr-red); font-weight: 800; margin: 14px 0 0; }
        .actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 16px; }
        .unsaved { font-size: 0.8rem; font-weight: 800; color: rgba(13, 42, 74, 0.8); }
        .confirm { display: flex; align-items: center; gap: 8px; font-weight: 800; color: var(--rr-red); margin-left: auto; flex-wrap: wrap; }
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
          position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
        }
      `}</style>
    </section>
  )
}

