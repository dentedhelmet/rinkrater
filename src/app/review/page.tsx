'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { TJ } from '@/components/tj/TJ'
import { useAuth } from '@/context/AuthContext'
import { AuthModal } from '@/components/auth/AuthModal'

interface ReviewMessage {
  role: 'tj' | 'user'
  text: string
  category?: string
}

// ─── Category definitions ───────────────────────────────────────────────────────
// Keys must exactly match the valid categories the API/Claude prompt expects.
// Order here also defines the suggestion order TJ walks through.
const CATEGORY_DEFS = [
  { key: 'RINK TEMPERATURE',            label: 'Rink Temp',        emoji: '🌡️' },
  { key: 'LOCKER ROOMS',                label: 'Locker Rooms',     emoji: '🚪' },
  { key: 'GIRLS LOCKER ROOM',           label: 'Girls Locker Room', emoji: '👧' },
  { key: 'PARKING',                     label: 'Parking',          emoji: '🚗' },
  { key: 'RESTROOMS',                   label: 'Restrooms',        emoji: '🚻' },
  { key: 'SKATE SHARPENING',            label: 'Skate Sharpening', emoji: '⛸️' },
  { key: 'CONCESSIONS',                 label: 'Concessions',      emoji: '🍕' },
  { key: 'DRINKS',                      label: 'Drinks',           emoji: '🥤' },
  { key: 'WIFI',                        label: 'WiFi',             emoji: '📶' },
  { key: 'LIVEBARN',                    label: 'LiveBarn',         emoji: '📺' },
  { key: 'RINK RAT ACTIVITIES',         label: 'Rink Rat Fun',     emoji: '🎮' },
  { key: 'ICE CONDITIONS',              label: 'Ice Conditions',   emoji: '🧊' },
  { key: 'PRO SHOP',                    label: 'Pro Shop',         emoji: '🏒' },
  { key: 'SEATING AREA / WARMING AREA', label: 'Seating Area',     emoji: '🪑' },
  { key: 'FIRST IMPRESSIONS',           label: 'First Impressions', emoji: '👋' },
]

const TOTAL_CATS = CATEGORY_DEFS.length

const ACKS = [
  "Got it, thanks!",
  "Love it — good to know.",
  "Nice, noted!",
  "That's helpful, thank you.",
  "Great detail, thanks!",
  "Good to know — appreciate it.",
]

function pickAck(nextDef: typeof CATEGORY_DEFS[number] | null) {
  const line = ACKS[Math.floor(Math.random() * ACKS.length)]
  if (!nextDef) {
    return line + " You've covered every category — hit Finish & Save whenever you're ready!"
  }
  return line + ` How about ${nextDef.label} next? (Or pick a different one below.)`
}

function ReviewPageContent() {
  const searchParams = useSearchParams()
  const rinkId = searchParams.get('rink') || ''
  const { user, profile, session, refreshProfile, loading: authLoading } = useAuth()
  const [showAuth, setShowAuth] = useState(false)

  const [rinkName, setRinkName] = useState('this rink')
  const [rinkLocation, setRinkLocation] = useState('')
  const [totalReviews, setTotalReviews] = useState(0)
  const [tier, setTier] = useState<string | null>(null) // TODO: confirm actual field name on rink record
  const [messages, setMessages] = useState<ReviewMessage[]>([
    {
      role: 'tj',
      text: `Let's start with ${CATEGORY_DEFS[0].label} — what was it like? (Or pick a different category below.)`,
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lastSavedUserMsgCount, setLastSavedUserMsgCount] = useState(0)
  const [hasSavedThisSession, setHasSavedThisSession] = useState(false)
  const [xpEarned, setXpEarned] = useState(0)
  const [savedToast, setSavedToast] = useState<{ visible: boolean; gained: number }>({ visible: false, gained: 0 })
  const [selectedCategory, setSelectedCategory] = useState<string | null>(CATEGORY_DEFS[0].key)
  const [suggestionIndex, setSuggestionIndex] = useState(1)
  const [showCategorySheet, setShowCategorySheet] = useState(false)
  const [completedCategories, setCompletedCategories] = useState<Set<string>>(new Set())

  useEffect(function() {
    if (!rinkId) return
    fetch('/api/rink/' + rinkId)
      .then(function(res) { return res.json() })
      .then(function(data) {
        if (data.rink) {
          setRinkName(data.rink.name)
          setRinkLocation(data.rink.city + ', ' + data.rink.state)
          setTotalReviews(data.stats?.total_reviews || 0)
          setTier(data.rink.tier || null)
          setMessages([{
            role: 'tj',
            text: `Let's start with ${CATEGORY_DEFS[0].label} at ${data.rink.name} — what was it like? (Or pick a different category below.)`,
          }])
        }
      })
  }, [rinkId])

  const thumbnailSrc =
    '/rink-thumbnails/rr_arena' +
    ((Math.abs((rinkId || '').split('').reduce(function (acc, c) { return acc + c.charCodeAt(0) }, 0)) % 14) + 1) +
    '.png'

  const activeCategoryDef = CATEGORY_DEFS.find((c) => c.key === selectedCategory)

  function handleCategoryPick(key: string) {
    setSelectedCategory(key)
    setShowCategorySheet(false)
  }

  const userMessages = messages.filter(m => m.role === 'user')

  async function handleSend() {
    if (!input.trim() || loading || !selectedCategory) return
    const text = input.trim()
    const category = selectedCategory
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text, category }])
    setLoading(true)

    const answeredSoFar = new Set<string>([
      ...completedCategories,
      ...userMessages.map((m) => m.category as string),
      category,
    ])

    let nextDef: typeof CATEGORY_DEFS[number] | null = null
    let nextPointer = suggestionIndex
    for (let i = 0; i < CATEGORY_DEFS.length; i++) {
      const idx = (suggestionIndex + i) % CATEGORY_DEFS.length
      if (!answeredSoFar.has(CATEGORY_DEFS[idx].key)) {
        nextDef = CATEGORY_DEFS[idx]
        nextPointer = idx + 1
        break
      }
    }
    setSuggestionIndex(nextPointer)
    setSelectedCategory(nextDef ? nextDef.key : null)

    setTimeout(function() {
      setMessages(prev => [...prev, { role: 'tj', text: pickAck(nextDef) }])
      setLoading(false)
    }, 500)
  }

  const hasUnsavedAnswers = userMessages.length > lastSavedUserMsgCount
  const profileReady = !!user && !!profile

  async function saveCheckpoint() {
    if (saving || !hasUnsavedAnswers) return
    if (!user || !session?.access_token || !profile) return // gated upfront now, shouldn't hit this

    const newMessages = userMessages.slice(lastSavedUserMsgCount)
    const entries = newMessages
      .filter((m) => m.category)
      .map((m) => ({ category: m.category, rawText: m.text }))
    if (entries.length === 0) return

    setSaving(true)
    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          rinkId,
          entries,
          userId: user.id,
          userAlias: profile.alias || 'Rink Rater reviewer',
          isFirstSave: !hasSavedThisSession,
        }),
      })
      const data = await res.json()

      if (!data.success) {
        alert(data.reason || "Couldn't save — try again in a moment.")
        return
      }

      setLastSavedUserMsgCount(userMessages.length)
      setHasSavedThisSession(true)

      const results: { category: string; status: string; reason: string | null }[] = data.results || []
      setCompletedCategories(prev => {
        const next = new Set(prev)
        results.forEach((r) => { if (r.status !== 'rejected') next.add(r.category) })
        return next
      })

      const gained = data.xpAwarded || 0
      setXpEarned(prev => prev + gained)
      setSavedToast({ visible: true, gained })
      await refreshProfile()
      setTimeout(() => setSavedToast({ visible: false, gained: 0 }), 5000)

      const rejected = results.filter((r) => r.status === 'rejected')
      if (rejected.length > 0) {
        alert(
          'Heads up — ' + rejected.map((r) => r.category).join(', ') +
          " couldn't be published (" + (rejected[0].reason || 'needs review') + ')'
        )
      }
    } catch {
      alert('Could not save right now — check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  const pct = Math.round((completedCategories.size / TOTAL_CATS) * 100)
  const isComplete = completedCategories.size >= TOTAL_CATS

  // ── Auth gate: block the whole review flow until signed in ──────────────────
  // Previously this only surfaced "Sign in to save" after someone had already
  // typed real answers. Gating upfront (same pattern as Ask TJ) avoids wasting
  // their effort before telling them an account is required.
  if (authLoading) {
    return (
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <p className="body-sm" style={{ color: 'rgba(13,42,74,0.4)' }}>Loading...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <TopBar showBack backHref={rinkId ? '/rink/' + rinkId : '/'} title="LEAVE A REVIEW" />
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '32px 24px', textAlign: 'center', gap: 16,
        }}>
          <div style={{ fontSize: 56 }}>✍️</div>
          <h1 className="display-lg" style={{ marginBottom: 4 }}>Leave a Review</h1>
          <p className="body-md" style={{ color: 'rgba(13,42,74,0.55)', maxWidth: 280, lineHeight: 1.6 }}>
            Create a free account to leave a review and start earning XP — it only takes a minute.
          </p>
          <button
            className="clay-btn clay-btn-primary"
            style={{ fontSize: 16, padding: '13px 36px' }}
            onClick={() => setShowAuth(true)}
          >
            Create Account
          </button>
          <button
            className="clay-btn clay-btn-secondary"
            style={{ fontSize: 14, padding: '11px 28px' }}
            onClick={() => setShowAuth(true)}
          >
            Sign In
          </button>
        </div>
        {showAuth && (
          <AuthModal
            onClose={() => setShowAuth(false)}
            prompt="Sign in to leave a review and earn XP."
          />
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <TopBar showBack backHref={rinkId ? '/rink/' + rinkId : '/'} title="LEAVE A REVIEW" />

      {savedToast.visible && (
        <div style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          background: 'var(--rr-green)', color: '#fff', padding: '20px 32px',
          borderRadius: 20, fontFamily: 'var(--font-display)', fontWeight: 900,
          fontSize: 22, boxShadow: '0 8px 30px rgba(0,0,0,0.35)', zIndex: 100,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          whiteSpace: 'nowrap', textAlign: 'center',
        }}>
          <div style={{ fontSize: 28 }}>✓</div>
          <div>Saved! +{savedToast.gained} XP</div>
        </div>
      )}

      {/* ── Category picker bottom sheet ── */}
      {showCategorySheet && (
        <>
          <div
            onClick={() => setShowCategorySheet(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(13,42,74,0.5)', zIndex: 90 }}
          />
          <div
            style={{
              position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 95,
              background: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
              boxShadow: '0 -8px 30px rgba(0,0,0,0.25)', padding: '16px 16px 24px',
              maxHeight: '70vh', overflowY: 'auto',
            }}
            className="scroll-y"
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 15, color: 'var(--rr-navy)' }}>
                REVIEW CATEGORIES
              </div>
              <button
                onClick={() => setShowCategorySheet(false)}
                aria-label="Close"
                style={{ background: 'transparent', border: 'none', fontSize: 22, color: 'rgba(13,42,74,0.4)', cursor: 'pointer', lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {CATEGORY_DEFS.map((cat) => {
                const done = completedCategories.has(cat.key)
                const active = selectedCategory === cat.key
                return (
                  <button
                    key={cat.key}
                    onClick={() => handleCategoryPick(cat.key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: active ? 'var(--rr-navy)' : 'var(--rr-ice)',
                      color: active ? '#fff' : 'var(--rr-navy)',
                      border: 'var(--rr-outline-sm)', borderRadius: 999,
                      padding: '9px 14px', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
                      cursor: 'pointer', opacity: done && !active ? 0.55 : 1,
                    }}
                  >
                    {cat.emoji} {cat.label} {done && '✓'}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* HERO: static banner + rink info overlay box (same treatment as Ask TJ) */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '2.45 / 1',
          maxHeight: 280,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <img
          src="/hero/header-leave-review_NEW.jpg"
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center 15%',
            display: 'block',
          }}
        />

        <div
          style={{
            position: 'absolute',
            left: '4%',
            bottom: '6%',
            maxWidth: '60%',
            background: 'rgba(255,255,255,0.96)',
            borderRadius: 14,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: 'var(--rr-shadow)',
            border: 'var(--rr-outline)',
          }}
        >
          <img
            src={thumbnailSrc}
            alt=""
            style={{
              width: 'clamp(48px, 9vw, 72px)',
              height: 'clamp(48px, 9vw, 72px)',
              objectFit: 'cover',
              borderRadius: 8,
              flexShrink: 0,
              border: '2px solid rgba(13,42,74,0.15)',
            }}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--font-display)', fontWeight: 800,
              fontSize: 'clamp(14px, 2.4vw, 20px)', color: 'var(--rr-navy)', lineHeight: 1.15,
            }}>
              {rinkName}
            </div>
            {rinkLocation && (
              <div style={{ fontSize: 'clamp(10px, 1.6vw, 13px)', color: 'rgba(13,42,74,0.55)', fontWeight: 600, marginTop: 1 }}>
                {rinkLocation}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
              {totalReviews > 0 && (
                <span style={{
                  background: '#3EAE5A', color: '#fff', fontSize: 'clamp(9px,1.4vw,11px)',
                  fontWeight: 800, padding: '3px 9px', borderRadius: 999, fontFamily: 'var(--font-display)',
                }}>
                  {totalReviews} REVIEWS
                </span>
              )}
              {tier && (
                <span style={{
                  background: '#2F6FE0', color: '#fff', fontSize: 'clamp(9px,1.4vw,11px)',
                  fontWeight: 800, padding: '3px 9px', borderRadius: 999, fontFamily: 'var(--font-display)',
                }}>
                  {tier.toUpperCase()}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 4, background: '#1a3e60', borderBottom: '1.5px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
        <div style={{ height: '100%', width: pct + '%', background: 'var(--rr-green)', transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ background: 'var(--rr-navy)', padding: '4px 14px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: xpEarned > 0 ? '#FFD34D' : 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-display)' }}>
          {xpEarned > 0 ? `⭐ ${xpEarned} XP saved so far` : ''}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.45)', fontFamily: 'var(--font-display)' }}>
          {completedCategories.size} of {TOTAL_CATS} categories
        </div>
      </div>

      <div style={{ flex: 1, padding: '10px 12px 6px', background: '#EEF4FA', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }} className="scroll-y">
        {messages.map((msg, i) => {
          const catDef = msg.category ? CATEGORY_DEFS.find((c) => c.key === msg.category) : null
          return (
            <div key={i}>
              {msg.role === 'user' ? (
                <div style={{ alignSelf: 'flex-end', maxWidth: '80%', marginLeft: 'auto' }}>
                  {catDef && (
                    <div style={{
                      textAlign: 'right', fontSize: 10, fontWeight: 800, color: 'var(--rr-navy)',
                      fontFamily: 'var(--font-display)', marginBottom: 3, paddingRight: 4,
                    }}>
                      {catDef.emoji} {catDef.label}
                    </div>
                  )}
                  <div style={{
                    background: 'var(--rr-red)', color: '#fff',
                    border: 'var(--rr-outline)', borderRadius: '12px 12px 2px 12px',
                    padding: '9px 13px', fontSize: 12, lineHeight: 1.55,
                    boxShadow: 'var(--rr-shadow)',
                  }}>
                    {msg.text}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7 }}>
                  <TJ state="idle" size="sm" />
                  <div style={{
                    background: 'var(--rr-warm)', border: 'var(--rr-outline)',
                    borderRadius: '12px 12px 12px 2px', padding: '9px 13px',
                    fontSize: 12, lineHeight: 1.6, color: 'var(--rr-navy)',
                    boxShadow: 'var(--rr-shadow)', maxWidth: 230,
                  }}>
                    {msg.text}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {hasUnsavedAnswers && !loading && profileReady && (
          <button
            onClick={saveCheckpoint}
            disabled={saving}
            className="clay-btn"
            style={{
              width: '100%', marginTop: 4,
              background: 'var(--rr-red)', color: '#fff', border: 'var(--rr-outline)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: saving ? 0.6 : 1,
            }}
          >
            🏆 {saving ? 'Saving...' : isComplete ? 'Finish & Save' : 'Save & Continue'}
          </button>
        )}

        {hasUnsavedAnswers && !loading && !profileReady && (
          <div style={{
            textAlign: 'center', fontSize: 12, color: 'rgba(13,42,74,0.55)',
            fontFamily: 'var(--font-display)', fontWeight: 600, padding: '6px 4px',
          }}>
            Loading your profile...
          </div>
        )}

        {isComplete && xpEarned > 0 && !hasUnsavedAnswers && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 4, flexWrap: 'wrap' }}>
            <a
              href={rinkId ? '/rink/' + rinkId : '/'}
              style={{
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12,
                color: 'var(--rr-navy)', textDecoration: 'underline',
              }}
            >
              Done — back to {rinkName}
            </a>
            <span style={{ color: 'rgba(13,42,74,0.3)' }}>·</span>
            <a
              href="/"
              style={{
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12,
                color: 'var(--rr-navy)', textDecoration: 'underline',
              }}
            >
              Review another rink
            </a>
          </div>
        )}
      </div>

      <div style={{ padding: '9px 12px', borderTop: 'var(--rr-outline)', background: 'var(--rr-warm)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
          <div style={{
            display: 'flex', alignItems: 'center',
            background: '#fff', border: 'var(--rr-outline)', borderRadius: 999,
            boxShadow: 'var(--rr-shadow)', paddingLeft: 4, paddingRight: 4, flex: 1,
          }}>
            <button
              onClick={() => setShowCategorySheet(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                background: selectedCategory ? 'var(--rr-navy)' : 'var(--rr-red)',
                color: '#fff', border: 'none', borderRadius: 999,
                padding: '9px 12px', fontFamily: 'var(--font-display)', fontWeight: 800,
                fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {activeCategoryDef ? `${activeCategoryDef.emoji} ${activeCategoryDef.label}` : '🏷️ Category'}
            </button>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder={activeCategoryDef ? `Tell me about ${activeCategoryDef.label}...` : 'Pick a category first...'}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                padding: '13px 10px', fontSize: 17,
                fontFamily: 'var(--font-body)', color: 'var(--rr-navy)',
              }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={loading || !input.trim() || !selectedCategory}
            aria-label="Send"
            style={{
              width: 38, height: 38, borderRadius: '50%',
              background: 'var(--rr-red)', border: '2px solid #fff',
              boxShadow: 'var(--rr-shadow-sm)',
              cursor: 'pointer', color: '#fff', fontSize: 17,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, opacity: loading || !input.trim() || !selectedCategory ? 0.5 : 1,
            }}
          >→</button>
        </div>
      </div>
    </div>
  )
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<div style={{ padding: 20, textAlign: 'center', color: 'rgba(13,42,74,0.4)' }}>Loading...</div>}>
      <ReviewPageContent />
    </Suspense>
  )
}
