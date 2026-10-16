'use client'

import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Youtube from '@tiptap/extension-youtube'
import { Placeholder } from '@tiptap/extensions'
import styles from '@/components/blog/blog.module.css'

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

type DialogKind = 'link' | 'image' | 'video' | null

interface RichTextEditorProps {
  initialHtml: string
  onChange:    (html: string) => void
  /** Uploads one image and returns its public URL. Throws on failure. */
  uploadImage: (file: File) => Promise<string>
  labelId:     string
}

/**
 * The post body editor: headings, bold/italic/underline, lists, quotes,
 * links, images (alt text required) and YouTube videos.
 * Writes plain HTML; the public page cleans it again before showing it.
 */
export function RichTextEditor({ initialHtml, onChange, uploadImage, labelId }: RichTextEditorProps) {
  const [dialog, setDialog] = useState<DialogKind>(null)

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading:   { levels: [2, 3] },
        codeBlock: false,
        link: {
          openOnClick:     false,
          autolink:        true,
          defaultProtocol: 'https',
          HTMLAttributes:  { rel: null, target: null },
        },
      }),
      Image.configure({ inline: false }),
      Youtube.configure({ nocookie: true, controls: true, width: 640, height: 360 }),
      Placeholder.configure({ placeholder: 'Start writing… Use H2 for section headings.' }),
    ],
    content: initialHtml || '<p></p>',
    editorProps: {
      attributes: {
        class: `${styles.prose} rte-content`,
        'aria-labelledby': labelId,
        'aria-multiline': 'true',
        role: 'textbox',
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  if (!editor) {
    return <div className="rte-loading" role="status">Loading editor…</div>
  }

  const closeDialog = () => {
    setDialog(null)
    editor.commands.focus()
  }

  return (
    <div className="rte">
      <Toolbar editor={editor} onOpen={setDialog} />

      {dialog === 'link' && <LinkDialog editor={editor} onClose={closeDialog} />}
      {dialog === 'image' && <ImageDialog editor={editor} uploadImage={uploadImage} onClose={closeDialog} />}
      {dialog === 'video' && <VideoDialog editor={editor} onClose={closeDialog} />}

      <EditorContent editor={editor} />

      <style jsx>{`
        .rte {
          border: 2px solid rgba(13, 42, 74, 0.3);
          border-radius: 12px;
          background: #fff;
          position: relative;
        }
        .rte:focus-within { border-color: var(--rr-navy); }
        .rte-loading { padding: 20px; font-weight: 700; color: var(--rr-navy); }
        .rte :global(.rte-content) {
          min-height: 360px;
          padding: 16px 18px;
          outline: none;
        }
        .rte :global(.rte-content:focus-visible) {
          box-shadow: inset 0 0 0 3px var(--rr-yellow);
          border-radius: 0 0 10px 10px;
        }
        .rte :global(.rte-content p.is-editor-empty:first-child::before) {
          content: attr(data-placeholder);
          color: rgba(13, 42, 74, 0.5);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .rte :global(.rte-content img.ProseMirror-selectednode),
        .rte :global(.rte-content div[data-youtube-video].ProseMirror-selectednode) {
          outline: 3px solid var(--rr-yellow);
          outline-offset: 2px;
        }
        .rte :global(.rte-content img:not([alt])),
        .rte :global(.rte-content img[alt='']) {
          outline: 3px dashed var(--rr-red);
        }
      `}</style>
    </div>
  )
}

// ─── Toolbar ──────────────────────────────────────────────────────────────────

function Toolbar({ editor, onOpen }: { editor: Editor; onOpen: (d: DialogKind) => void }) {
  const chain = () => editor.chain().focus()

  const buttons: { label: string; text: string; active?: boolean; run: () => void; disabled?: boolean }[] = [
    { label: 'Heading',          text: 'H2', active: editor.isActive('heading', { level: 2 }), run: () => chain().toggleHeading({ level: 2 }).run() },
    { label: 'Subheading',       text: 'H3', active: editor.isActive('heading', { level: 3 }), run: () => chain().toggleHeading({ level: 3 }).run() },
    { label: 'Bold',             text: 'B',  active: editor.isActive('bold'),        run: () => chain().toggleBold().run() },
    { label: 'Italic',           text: 'I',  active: editor.isActive('italic'),      run: () => chain().toggleItalic().run() },
    { label: 'Underline',        text: 'U',  active: editor.isActive('underline'),   run: () => chain().toggleUnderline().run() },
    { label: 'Bulleted list',    text: '•',  active: editor.isActive('bulletList'),  run: () => chain().toggleBulletList().run() },
    { label: 'Numbered list',    text: '1.', active: editor.isActive('orderedList'), run: () => chain().toggleOrderedList().run() },
    { label: 'Quote',            text: '❝',  active: editor.isActive('blockquote'),  run: () => chain().toggleBlockquote().run() },
    { label: 'Link',             text: '🔗', active: editor.isActive('link'),        run: () => onOpen('link') },
    { label: 'Insert image',     text: '🖼️', run: () => onOpen('image') },
    { label: 'Insert YouTube video', text: '▶', run: () => onOpen('video') },
    { label: 'Divider line',     text: '―',  run: () => chain().setHorizontalRule().run() },
    { label: 'Undo',             text: '↶',  run: () => chain().undo().run(), disabled: !editor.can().undo() },
    { label: 'Redo',             text: '↷',  run: () => chain().redo().run(), disabled: !editor.can().redo() },
  ]

  return (
    <div className="toolbar" role="toolbar" aria-label="Formatting">
      {buttons.map((b) => (
        <button
          key={b.label}
          type="button"
          className={`tb ${b.active ? 'tb-on' : ''}`}
          aria-label={b.label}
          title={b.label}
          aria-pressed={b.active === undefined ? undefined : b.active}
          disabled={b.disabled}
          onMouseDown={(e) => e.preventDefault()} // keep the text selection
          onClick={b.run}
        >
          <span aria-hidden="true">{b.text}</span>
        </button>
      ))}

      <style jsx>{`
        .toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          padding: 8px;
          border-bottom: 2px solid rgba(13, 42, 74, 0.15);
          background: var(--rr-warm);
          border-radius: 10px 10px 0 0;
          position: sticky;
          top: 100px;
          z-index: 2;
        }
        .tb {
          min-width: 44px;
          height: 44px;
          padding: 0 8px;
          border-radius: 8px;
          border: 2px solid transparent;
          background: transparent;
          color: var(--rr-navy);
          font-family: inherit;
          font-weight: 900;
          font-size: 0.95rem;
          cursor: pointer;
        }
        .tb:hover:not(:disabled) { background: var(--rr-ice); }
        .tb-on { background: var(--rr-navy) !important; color: #fff; }
        .tb:disabled { opacity: 0.35; cursor: default; }
        .tb:focus-visible { outline: 3px solid var(--rr-yellow); outline-offset: 1px; }
      `}</style>
    </div>
  )
}

// ─── Small dialogs (link, image, video) ──────────────────────────────────────

function DialogFrame({
  title, onClose, children,
}: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('input, button')?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="dlg" role="dialog" aria-modal="false" aria-label={title} ref={ref}>
      <strong className="dlg-title">{title}</strong>
      {children}
      <style jsx>{`
        .dlg {
          margin: 10px;
          padding: 14px;
          border: 2px solid var(--rr-navy);
          border-radius: 12px;
          background: var(--rr-ice);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .dlg-title { color: var(--rr-navy); font-weight: 900; }
        .dlg :global(label) { font-weight: 800; color: var(--rr-navy); font-size: 0.85rem; }
        .dlg :global(input[type='url']),
        .dlg :global(input[type='text']) {
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
        .dlg :global(input:focus) { outline: 3px solid var(--rr-yellow); border-color: var(--rr-navy); }
        .dlg :global(.dlg-hint) { margin: 0; font-size: 0.78rem; color: rgba(13, 42, 74, 0.85); }
        .dlg :global(.dlg-err) { margin: 0; font-weight: 800; color: var(--rr-red); }
        .dlg :global(.dlg-actions) { display: flex; gap: 8px; flex-wrap: wrap; }
        .dlg :global(.dlg-btn) {
          min-height: 44px;
          padding: 0 16px;
          border-radius: 10px;
          border: 2px solid var(--rr-navy);
          background: #fff;
          color: var(--rr-navy);
          font-family: inherit;
          font-weight: 800;
          cursor: pointer;
        }
        .dlg :global(.dlg-btn-primary) { background: var(--rr-navy); color: #fff; }
        .dlg :global(.dlg-btn:disabled) { opacity: 0.5; cursor: default; }
        .dlg :global(.dlg-btn:focus-visible) { outline: 3px solid var(--rr-yellow); outline-offset: 2px; }
        .dlg :global(.dlg-preview) {
          max-width: 220px;
          max-height: 140px;
          object-fit: contain;
          border-radius: 8px;
          border: 1.5px solid var(--rr-navy);
          background: #fff;
        }
      `}</style>
    </div>
  )
}

function LinkDialog({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const existing = (editor.getAttributes('link').href as string | undefined) ?? ''
  const [url, setUrl] = useState(existing)
  const [error, setError] = useState<string | null>(null)
  const hasSelection = !editor.state.selection.empty

  const apply = () => {
    let href = url.trim()
    if (!href) { setError('Paste a link first.'); return }
    if (!/^(https?:\/\/|\/|mailto:)/i.test(href)) href = `https://${href}`
    if (hasSelection || editor.isActive('link')) {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
    } else {
      // Nothing selected — insert the link text itself.
      editor.chain().focus().insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }).run()
    }
    onClose()
  }

  const remove = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    onClose()
  }

  return (
    <DialogFrame title={existing ? 'Edit link' : 'Add link'} onClose={onClose}>
      <label htmlFor="rte-link">Web address</label>
      <input
        id="rte-link"
        type="url"
        inputMode="url"
        placeholder="https://  or  /rink/some-rink-id"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); apply() } }}
      />
      <p className="dlg-hint">
        {hasSelection ? 'The selected words will become the link.' : 'Tip: select some words first to turn them into the link.'}
        {' '}Links to Rink Rater pages can start with “/”, e.g. /rink/…
      </p>
      {error && <p className="dlg-err" role="alert">{error}</p>}
      <div className="dlg-actions">
        <button type="button" className="dlg-btn dlg-btn-primary" onClick={apply}>Apply</button>
        {existing && <button type="button" className="dlg-btn" onClick={remove}>Remove link</button>}
        <button type="button" className="dlg-btn" onClick={onClose}>Cancel</button>
      </div>
    </DialogFrame>
  )
}

function ImageDialog({
  editor, uploadImage, onClose,
}: { editor: Editor; uploadImage: (file: File) => Promise<string>; onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [alt, setAlt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  const choose = (f: File) => {
    setError(null)
    if (!IMAGE_TYPES.includes(f.type)) { setError('Images must be PNG, JPG, WebP or GIF.'); return }
    if (f.size > MAX_IMAGE_BYTES) { setError('Images must be under 5 MB.'); return }
    setFile(f)
    setPreviewUrl(URL.createObjectURL(f))
  }

  const insert = async () => {
    if (!file) { setError('Choose an image first.'); return }
    if (!alt.trim()) { setError('Describe the image — this is what screen readers and Google read.'); return }
    setBusy(true)
    setError(null)
    try {
      const src = await uploadImage(file)
      editor.chain().focus().setImage({ src, alt: alt.trim() }).run()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.')
      setBusy(false)
    }
  }

  return (
    <DialogFrame title="Insert image" onClose={onClose}>
      <input
        ref={fileRef}
        id="rte-image-file"
        type="file"
        accept={IMAGE_TYPES.join(',')}
        className="rte-sr-only"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) choose(f); e.target.value = '' }}
      />
      <div className="dlg-actions">
        <button type="button" className="dlg-btn" onClick={() => fileRef.current?.click()} disabled={busy}>
          {file ? 'Choose a different image' : 'Choose image'}
        </button>
      </div>
      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="" className="dlg-preview" />
      )}
      <label htmlFor="rte-image-alt">Describe the image (required)</label>
      <input
        id="rte-image-alt"
        type="text"
        maxLength={200}
        placeholder="e.g. Parents watching a youth game from the warm room at Bolt Arena"
        value={alt}
        onChange={(e) => setAlt(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); insert() } }}
      />
      <p className="dlg-hint">PNG, JPG, WebP or GIF, under 5 MB.</p>
      {error && <p className="dlg-err" role="alert">{error}</p>}
      <div className="dlg-actions">
        <button type="button" className="dlg-btn dlg-btn-primary" onClick={insert} disabled={busy}>
          {busy ? 'Uploading…' : 'Insert image'}
        </button>
        <button type="button" className="dlg-btn" onClick={onClose} disabled={busy}>Cancel</button>
      </div>
      <style jsx>{`
        :global(.rte-sr-only) {
          position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
        }
      `}</style>
    </DialogFrame>
  )
}

function VideoDialog({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  const insert = () => {
    const src = url.trim()
    if (!/^(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(src)) {
      setError('Paste a YouTube link (youtube.com or youtu.be).')
      return
    }
    const ok = editor.chain().focus().setYoutubeVideo({ src }).run()
    if (!ok) { setError('That YouTube link didn’t work — try the Share link from the video.'); return }
    onClose()
  }

  return (
    <DialogFrame title="Insert YouTube video" onClose={onClose}>
      <label htmlFor="rte-video">YouTube link</label>
      <input
        id="rte-video"
        type="url"
        inputMode="url"
        placeholder="https://youtu.be/…"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); insert() } }}
      />
      {error && <p className="dlg-err" role="alert">{error}</p>}
      <div className="dlg-actions">
        <button type="button" className="dlg-btn dlg-btn-primary" onClick={insert}>Insert video</button>
        <button type="button" className="dlg-btn" onClick={onClose}>Cancel</button>
      </div>
    </DialogFrame>
  )
}
