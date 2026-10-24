'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/context/AuthContext'
import { AuthModal } from '@/components/auth/AuthModal'
import {
  INSTAGRAM_HANDLE_RE,
  TIP_CATEGORIES,
  TIP_LIMITS,
  cleanInstagramHandle,
  type TipCategory,
} from '@/lib/parentTips'

interface ShareTipModalProps {
  isOpen:           boolean
  onClose:          () => void
  initialCategory?: TipCategory
}

export default function ShareTipModal({ isOpen, onClose, initialCategory }: ShareTipModalProps) {
  const { user, session } = useAuth()

  const [category, setCategory] = useState<TipCategory | ''>(initialCategory ?? '')
  const [title, setTitle] = useState('')
  const [tip, setTip] = useState('')
  const [instagramOk, setInstagramOk] = useState(false)
  const [handle, setHandle] = useState('')
  const [website, setWebsite] = useState('') // honeypot, kept empty by real users
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [mounted, setMounted] = useState(false)

  const dialogRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => { setMounted(true) }, [])

  // Pick up a new starting category each time the modal opens.
  useEffect(() => {
    if (isOpen && initialCategory) setCategory(initialCategory)
  }, [isOpen, initialCategory])

  // Focus in on open, back to the trigger on close; Escape closes; lock scroll.
  useEffect(() => {
    if (!isOpen) return
    returnFocusRef.current = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = window.setTimeout(() => headingRef.current?.focus(), 0)
    return () => {
      window.clearTimeout(t)
      document.body.style.overflow = prevOverflow
      returnFocusRef.current?.focus?.()
    }
  }, [isOpen])

  if (!isOpen || !mounted) return null

  const reset = () => {
    setCategory(initialCategory ?? '')
    setTitle('')
    setTip('')
    setInstagramOk(false)
    setHandle('')
    setError(null)
    setSuccess(false)
  }

  const close = () => {
    if (submitting) return
    reset()
    onClose()
  }

  // Keep Tab inside the dialog.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (showAuth) return
    if (e.key === 'Escape') {
      e.stopPropagation()
      close()
      return
    }
    if (e.key !== 'Tab' || !dialogRef.current) return
    const focusables = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]), [href], [tabindex="0"]'
      )
    )
    if (focusables.length === 0) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!user || !session) {
      setShowAuth(true)
      return
    }
    if (!category) {
      setError('Pick a category for your tip.')
      return
    }
    const t = title.trim()
    const b = tip.trim()
    if (t.length < TIP_LIMITS.titleMin) {
      setError('Give your tip a short title.')
      return
    }
    if (b.length < TIP_LIMITS.bodyMin) {
      setError(`Tell us a little more. Tips need at least ${TIP_LIMITS.bodyMin} characters.`)
      return
    }
    const cleanHandle = cleanInstagramHandle(handle)
    if (instagramOk && cleanHandle && !INSTAGRAM_HANDLE_RE.test(cleanHandle)) {
      setError('That Instagram username doesn’t look right. Use letters, numbers, periods or underscores.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/parent-tips', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          category,
          title: t,
          tip: b,
          instagram_ok: instagramOk,
          instagram_handle: instagramOk ? cleanHandle : '',
          website,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Something went wrong. Please try again.')
      }
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const modal = (
    <div className="tip-overlay" onClick={close}>
      <div
        ref={dialogRef}
        className="clay-card tip-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-tip-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <button type="button" className="close-btn" onClick={close} aria-label="Close">
          &times;
        </button>

        {success ? (
          <div className="success-state">
            <h2 id="share-tip-title" ref={headingRef} tabIndex={-1}>
              Thanks for helping another hockey family! 🏒
            </h2>
            <p>
              Your tip is in. Every tip gets a quick look before it goes live. You&apos;ll earn
              <strong> 10 XP</strong> once it&apos;s approved.
            </p>
            <div className="success-actions">
              <button type="button" className="clay-btn clay-btn-primary" onClick={reset}>
                Share another tip
              </button>
              <button type="button" className="clay-btn clay-btn-secondary" onClick={close}>
                Done
              </button>
            </div>
          </div>
        ) : !user ? (
          <div className="success-state">
            <h2 id="share-tip-title" ref={headingRef} tabIndex={-1}>
              Share a tip with other hockey parents
            </h2>
            <p>
              Sign in or create a free account to share what&apos;s worked for your family. Tips are signed
              with your Rink Rater name.
            </p>
            <div className="success-actions">
              <button type="button" className="clay-btn clay-btn-primary" onClick={() => setShowAuth(true)}>
                Sign in to share
              </button>
              <button type="button" className="clay-btn clay-btn-secondary" onClick={close}>
                Not now
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <h2 id="share-tip-title" ref={headingRef} tabIndex={-1}>
              Share a tip
            </h2>
            <p className="subtitle">What do you wish someone had told you? Pass it on.</p>

            {/* Honeypot: hidden from real people, bots tend to fill every field */}
            <input
              type="text"
              name="website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="honeypot-field"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
            />

            <fieldset className="cat-fieldset">
              <legend>Category<span aria-hidden="true"> *</span></legend>
              <div className="cat-grid">
                {TIP_CATEGORIES.map((c) => (
                  <label key={c.id} className={`cat-option ${category === c.id ? 'cat-selected' : ''}`}>
                    <input
                      type="radio"
                      name="tip-category"
                      value={c.id}
                      checked={category === c.id}
                      onChange={() => setCategory(c.id)}
                    />
                    <span aria-hidden="true" className="cat-icon">{c.icon}</span>
                    <span>{c.label}</span>
                  </label>
                ))}
              </div>
              {category && (
                <p className="cat-prompt">
                  Ideas: {TIP_CATEGORIES.find((c) => c.id === category)?.prompt}
                </p>
              )}
            </fieldset>

            <label htmlFor="tip-title">
              Title<span aria-hidden="true"> *</span>
            </label>
            <input
              id="tip-title"
              type="text"
              value={title}
              maxLength={TIP_LIMITS.titleMax}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Freeze a water bottle the night before"
              aria-describedby="tip-title-count"
            />
            <p id="tip-title-count" className="counter">
              {title.length}/{TIP_LIMITS.titleMax}
            </p>

            <label htmlFor="tip-body">
              Your tip<span aria-hidden="true"> *</span>
            </label>
            <textarea
              id="tip-body"
              rows={5}
              value={tip}
              maxLength={TIP_LIMITS.bodyMax}
              onChange={(e) => setTip(e.target.value)}
              placeholder="Share what worked for your family, and why."
              aria-describedby="tip-body-count tip-rules"
            />
            <p id="tip-body-count" className="counter">
              {tip.length}/{TIP_LIMITS.bodyMax}
            </p>

            <div id="tip-rules" className="house-rules">
              <p className="rules-title">TJ&apos;s Mom&apos;s house rules</p>
              <ul>
                <li>Share what worked for your family.</li>
                <li>No kids&apos; full names, schools or schedules.</li>
                <li>No supplements, medications, diets or weight-loss advice.</li>
                <li>Keep it kind. No calling out teams, coaches or families.</li>
                <li>No ads or links to things you sell.</li>
              </ul>
            </div>

            <label className="check-row">
              <input
                type="checkbox"
                checked={instagramOk}
                onChange={(e) => setInstagramOk(e.target.checked)}
              />
              <span>
                Rink Rater may feature this tip on its Instagram, with credit to me.
              </span>
            </label>

            {instagramOk && (
              <>
                <label htmlFor="tip-ig">Your Instagram username (optional)</label>
                <div className="ig-row">
                  <span aria-hidden="true">@</span>
                  <input
                    id="tip-ig"
                    type="text"
                    value={handle}
                    maxLength={31}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    onChange={(e) => setHandle(e.target.value)}
                    placeholder="yourname"
                    aria-describedby="tip-ig-help"
                  />
                </div>
                <p id="tip-ig-help" className="help">
                  We&apos;ll tag you. Leave it blank and we&apos;ll credit your Rink Rater name.
                </p>
              </>
            )}

            {error && <p className="form-error" role="alert">{error}</p>}

            <button type="submit" className="clay-btn clay-btn-primary submit-btn" disabled={submitting}>
              {submitting ? 'Sending…' : 'Share my tip'}
            </button>
          </form>
        )}
      </div>

      {showAuth && (
        <AuthModal onClose={() => setShowAuth(false)} prompt="Sign in to share a tip with other hockey parents" />
      )}

      <style jsx>{`
        .tip-overlay {
          position: fixed;
          inset: 0;
          background: rgba(13, 42, 74, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          z-index: 1000;
        }
        .tip-modal {
          position: relative;
          width: 100%;
          max-width: 540px;
          max-height: 92vh;
          overflow-y: auto;
          padding: 28px;
          box-sizing: border-box;
        }
        .close-btn {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 44px;
          height: 44px;
          border: none;
          background: transparent;
          font-size: 26px;
          line-height: 1;
          color: var(--rr-navy);
          cursor: pointer;
          border-radius: 50%;
        }
        h2 {
          font-family: var(--font-display);
          color: var(--rr-navy);
          margin: 0 44px 6px 0;
          font-size: 1.4rem;
          line-height: 1.25;
        }
        h2:focus {
          outline: none;
        }
        .subtitle {
          color: rgba(13, 42, 74, 0.8);
          margin: 0 0 18px;
          font-size: 0.95rem;
        }
        label,
        legend {
          display: block;
          font-weight: 800;
          color: var(--rr-navy);
          font-size: 0.9rem;
        }
        label {
          margin: 16px 0 6px;
        }
        .cat-fieldset {
          border: none;
          margin: 0;
          padding: 0;
        }
        legend {
          margin-bottom: 8px;
          padding: 0;
        }
        .cat-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }
        .cat-option {
          position: relative;
          display: flex;
          align-items: center;
          gap: 6px;
          min-height: 44px;
          margin: 0;
          padding: 8px 10px;
          border: var(--rr-outline-sm);
          border-radius: var(--rr-radius-sm);
          background: #fff;
          font-size: 0.88rem;
          cursor: pointer;
        }
        .cat-option input {
          position: absolute;
          opacity: 0;
          width: 1px;
          height: 1px;
        }
        .cat-option:focus-within {
          outline: 3px solid var(--rr-yellow);
          outline-offset: 1px;
        }
        .cat-selected {
          background: var(--rr-navy);
          color: #fff;
        }
        .cat-icon {
          font-size: 1.1rem;
        }
        .cat-prompt {
          margin: 8px 0 0;
          font-size: 0.85rem;
          color: rgba(13, 42, 74, 0.85);
        }
        input[type='text'],
        textarea {
          width: 100%;
          padding: 12px 14px;
          border-radius: 12px;
          border: 2px solid rgba(13, 42, 74, 0.3);
          font-size: 1rem;
          font-family: inherit;
          box-sizing: border-box;
          color: var(--rr-navy);
          background: #fff;
        }
        input[type='text']:focus,
        textarea:focus {
          outline: 3px solid var(--rr-yellow);
          outline-offset: 1px;
          border-color: var(--rr-navy);
        }
        .counter {
          margin: 4px 0 0;
          text-align: right;
          font-size: 0.78rem;
          color: rgba(13, 42, 74, 0.75);
        }
        .house-rules {
          margin-top: 14px;
          padding: 12px 14px;
          border-radius: var(--rr-radius-sm);
          background: #fff4d1;
          border: 1.5px solid var(--rr-yellow);
          color: var(--rr-navy);
          font-size: 0.86rem;
        }
        .rules-title {
          margin: 0 0 4px;
          font-weight: 900;
        }
        .house-rules ul {
          margin: 0;
          padding-left: 18px;
          line-height: 1.5;
        }
        .check-row {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          min-height: 44px;
          font-weight: 700;
          cursor: pointer;
        }
        .check-row input {
          width: 22px;
          height: 22px;
          margin: 0;
          flex: 0 0 auto;
          accent-color: var(--rr-red);
        }
        .ig-row {
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 900;
          color: var(--rr-navy);
        }
        .help {
          margin: 6px 0 0;
          font-size: 0.82rem;
          color: rgba(13, 42, 74, 0.8);
        }
        .honeypot-field {
          position: absolute;
          left: -9999px;
          width: 1px;
          height: 1px;
          overflow: hidden;
        }
        .form-error {
          color: var(--rr-red);
          font-weight: 800;
          margin: 16px 0 0;
        }
        .submit-btn {
          margin-top: 20px;
          width: 100%;
          min-height: 48px;
          font-size: 15px;
        }
        .success-state {
          padding: 8px 0;
        }
        .success-state p {
          color: rgba(13, 42, 74, 0.85);
          margin: 8px 0 20px;
          line-height: 1.55;
        }
        .success-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .success-actions :global(.clay-btn) {
          min-height: 44px;
          flex: 1;
        }
        @media (max-width: 480px) {
          .tip-modal {
            padding: 22px 18px;
          }
          .cat-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  )

  return createPortal(modal, document.body)
}
