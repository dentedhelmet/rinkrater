'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { TJ } from '@/components/tj/TJ'
import { useAuth } from '@/context/AuthContext'
import { AuthModal } from '@/components/auth/AuthModal'

interface ExtractedTag {
  label: string
  color: 'green' | 'yellow' | 'blue' | 'red'
}

interface ReviewMessage {
  role: 'tj' | 'user'
  text: string
  tags?: ExtractedTag[]
}

const TOTAL_CATS = 10

function ReviewPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rinkId = searchParams.get('rink') || ''
  const { user, profile } = useAuth()
  const [showAuth,     setShowAuth]     = useState(false)
  const [rinkName,     setRinkName]     = useState('this rink')
  const [rinkLocation, setRinkLocation] = useState('')
  const [messages, setMessages] = useState<ReviewMessage[]>([
    {
      role: 'tj',
      text: "Just talk naturally — I'll pick up the details. Start with whatever stands out most!",
    },
  ])
  const [input,          setInput]          = useState('')
  const [catsCompleted,  setCatsCompleted]  = useState(0)
  const [loading,        setLoading]        = useState(false)
  const [done,           setDone]           = useState(false)
  const [xpEarned,       setXpEarned]       = useState(0)

  useEffect(function() {
    if (!rinkId) return
    fetch('/api/rink/' + rinkId)
      .then(function(res) { return res.json() })
      .then(function(data) {
        if (data.rink) {
          setRinkName(data.rink.name)
          setRinkLocation(data.rink.city + ', ' + data.rink.state)
          setMessages([{
            role: 'tj',
            text: "Just talk naturally — I'll pick up the details. What was your overall experience at " + data.rink.name + "? Start with whatever stood out most!",
          }])
        }
      })
  }, [rinkId])

  function handleVoiceInput() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Voice input isn't supported in this browser. Try typing instead!")
      return
    }
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognitionAPI()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      setInput(transcript)
    }
    recognition.onerror = () => {
      alert("Didn't catch that — feel free to type instead!")
    }
    recognition.start()
  }

  async function handleSend() {
    if (!input.trim() || loading) return
    const text = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text }])
    setLoading(true)
    const newCats = Math.min(catsCompleted + 1, TOTAL_CATS)
    setCatsCompleted(newCats)
    const followUp = getFollowUpQuestion(newCats)
    setTimeout(function() {
      if (followUp) {
        setMessages(prev => [...prev, { role: 'tj', text: followUp }])
      } else {
        setMessages(prev => [...prev, {
          role: 'tj',
          text: "You're a rockstar! 🏒 That's a ton of great info. Ready to save your review?",
        }])
      }
      setLoading(false)
    }, 600)
  }

  async function submitReview() {
    if (!user) { setShowAuth(true); return }
    setLoading(true)
    try {
      const res = await fetch('/api/review', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rinkId,
          rawText:   messages.filter(m => m.role === 'user').map(m => m.text).join('. '),
          userId:    user.id,
          userAlias: profile?.alias || 'Rink Rater reviewer',
        }),
      })
      const data = await res.json()
      // XP is awarded by the API — use categories found for accurate calculation
      setXpEarned(data.categoriesFound ? 125 + data.categoriesFound * 25 : 125)
      setDone(true)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: '#EEF4FA' }}>
        <TopBar showBack backHref={rinkId ? '/rink/' + rinkId : '/'} title="Review saved!" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', gap: 16 }}>
          <img src="/tj/rr_tj_pointing.png" alt="TJ" style={{ width: 160, height: 160, objectFit: 'contain' }} />
          <div className="clay-card" style={{ padding: '16px', width: '100%', textAlign: 'center' }}>
            <div className="display-lg" style={{ marginBottom: 4 }}>Review posted! 🎉</div>
            <div className="body-sm" style={{ color: 'rgba(13,42,74,0.6)', marginBottom: 14 }}>
              You just helped families headed to {rinkName} this weekend.
            </div>
            <div style={{ background: 'var(--rr-green)', border: 'var(--rr-outline)', borderRadius: 'var(--rr-radius)', padding: '12px', boxShadow: 'var(--rr-shadow)', marginBottom: 12 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 28, color: '#fff' }}>
                +{xpEarned} XP
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>added to your total</div>
            </div>
            <button onClick={() => router.push(rinkId ? '/rink/' + rinkId : '/')} className="clay-btn clay-btn-primary" style={{ width: '100%' }}>
              Done
            </button>
          </div>
        </div>
      </div>
    )
  }

  const pct = Math.round((catsCompleted / TOTAL_CATS) * 100)

  // ── Auth gate ──────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <TopBar showBack backHref={rinkId ? '/rink/' + rinkId : '/'} title="Add review" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>✍️</div>
          <h2 className="display-lg" style={{ marginBottom: 8 }}>Sign in to leave a review</h2>
          <p className="body-md" style={{ color: 'rgba(13,42,74,0.55)', maxWidth: 260, marginBottom: 28, lineHeight: 1.6 }}>
            Create a free account to share your experience and earn XP for every review.
          </p>
          <button
            className="clay-btn clay-btn-primary"
            style={{ fontSize: 16, padding: '13px 36px', marginBottom: 12 }}
            onClick={() => setShowAuth(true)}
          >
            Sign In / Join Up
          </button>
          <button
            className="clay-btn clay-btn-secondary"
            style={{ fontSize: 14 }}
            onClick={() => router.back()}
          >
            ← Go Back
          </button>
        </div>
        {showAuth && (
          <AuthModal
            onClose={() => setShowAuth(false)}
            prompt="Sign in to leave a review and earn XP"
          />
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <TopBar showBack backHref={rinkId ? '/rink/' + rinkId : '/'} title="Add review" />

      <div style={{ background: 'var(--rr-navy)', padding: '8px 14px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
        <img
          src={'/rink-thumbnails/rr_arena' + ((Math.abs((rinkId || '').split('').reduce(function(acc, c) { return acc + c.charCodeAt(0) }, 0)) % 14) + 1) + '.png'}
          alt=""
          style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 8, border: '2px solid rgba(255,255,255,0.2)', flexShrink: 0 }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 20, color: '#fff' }}>
            {rinkName}
          </div>
          {rinkLocation && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
              {rinkLocation}
            </div>
          )}
        </div>
      </div>
      <div style={{ height: 4, background: '#1a3e60', borderBottom: '1.5px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
        <div style={{ height: '100%', width: pct + '%', background: 'var(--rr-green)', transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ background: 'var(--rr-navy)', padding: '2px 14px 6px', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textAlign: 'right', fontFamily: 'var(--font-display)', flexShrink: 0 }}>
        {catsCompleted} of {TOTAL_CATS} categories
      </div>

      <div style={{ flex: 1, padding: '10px 12px 6px', background: '#EEF4FA', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }} className="scroll-y">
        {messages.map((msg, i) => (
          <div key={i}>
            {msg.role === 'user' ? (
              <div style={{ alignSelf: 'flex-end', maxWidth: '80%', marginLeft: 'auto' }}>
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
              <div>
                {msg.text && (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, marginBottom: msg.tags ? 7 : 0 }}>
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
            )}
          </div>
        ))}

        {catsCompleted >= 2 && !loading && (
          <button
            onClick={submitReview}
            className="clay-btn"
            style={{ width: '100%', marginTop: 4, background: 'var(--rr-navy)', color: '#fff', border: 'var(--rr-outline)' }}
          >
            Save review · +{125 + catsCompleted * 25} XP
          </button>
        )}
      </div>

      <div style={{ padding: '9px 12px', borderTop: 'var(--rr-outline)', background: 'var(--rr-warm)', flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 11, color: 'rgba(13,42,74,0.5)', marginBottom: 6 }}>Quick starts:</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {['Great rink!', 'Needs work', 'Cold inside', 'Good food', 'Easy parking', 'Clean bathrooms'].map(function(chip) {
            return (
              <button
                key={chip}
                onClick={function() { setInput(chip) }}
                style={{
                  background: 'var(--rr-ice)',
                  border: 'var(--rr-outline-sm)',
                  borderRadius: 999,
                  padding: '5px 11px',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: 11,
                  color: 'var(--rr-navy)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {chip}
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Type your review here..."
            style={{
              flex: 1, background: '#fff',
              border: 'var(--rr-outline)', borderRadius: 999,
              padding: '10px 14px', fontSize: 13,
              fontFamily: 'var(--font-body)', color: 'var(--rr-navy)', outline: 'none',
            }}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            aria-label="Send"
            style={{
              width: 38, height: 38, borderRadius: '50%',
              background: 'var(--rr-navy)', border: 'none',
              cursor: 'pointer', color: '#fff', fontSize: 17,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, opacity: loading || !input.trim() ? 0.5 : 1,
            }}
          >→</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(13,42,74,0.12)' }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(13,42,74,0.4)', fontFamily: 'var(--font-display)' }}>OR</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(13,42,74,0.12)' }} />
        </div>
        <button
          onClick={handleVoiceInput}
          aria-label="Speak your review instead"
          style={{
            width: '100%', marginTop: 8,
            background: 'var(--rr-red)', border: 'var(--rr-outline)',
            borderRadius: 999, padding: '10px 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            cursor: 'pointer', color: '#fff',
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13,
            boxShadow: 'var(--rr-shadow-sm)',
          }}
        >
          🎤 Speak your review instead
        </button>
      </div>
    </div>
  )
}

function getFollowUpQuestion(catsCompleted: number): string | null {
  const questions = [
    // 1 — Temperature (first thing parents notice walking in)
    "Nice! How cold was it in there — full winter coat or just a light sweatshirt?",
    // 2 — Locker rooms (critical for teams)
    "Got it! How were the locker rooms — enough space, clean, and were there separate ones for girls?",
    // 3 — Parking
    "Perfect! Was parking easy to find, or a bit of a hunt?",
    // 4 — Restrooms
    "Awesome! How were the restrooms — clean, easy to find, enough stalls?",
    // 5 — Skate sharpening
    "Nice! What about skate sharpening — available on-site, and roughly how much?",
    // 6 — Food (moved down from top)
    "Great! Now — how was the food situation? Snack bar, vending machines, or bring your own?",
    // 7 — WiFi
    "Love it! Did you connect to WiFi? If so, feel free to drop the password here for other parents! 😄",
    // 8 — LiveBarn / streaming
    "Solid! Did you catch the game on LiveBarn or any live streaming?",
    // 9 — Rink Rat activities
    "Almost done! Any Rink Rat activities for the little siblings — arcade, bubble hockey, open space?",
    // 10 — First impressions for new families
    "Last one — any tips for families visiting for the very first time?",
  ]
  return questions[catsCompleted - 1] ?? null
}

function flattenTags(rawTags: string[]): ExtractedTag[] {
  return rawTags.map(t => ({
    label: t,
    color: t.toLowerCase().includes('no') || t.toLowerCase().includes('cold') ? 'red'
         : t.toLowerCase().includes('~$') || t.toLowerCase().includes('bring') ? 'yellow'
         : t.toLowerCase().includes('wifi') ? 'blue'
         : 'green',
  }))
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<div style={{ padding: 20, textAlign: 'center', color: 'rgba(13,42,74,0.4)' }}>Loading...</div>}>
      <ReviewPageContent />
    </Suspense>
  )
}
