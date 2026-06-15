'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { TJ } from '@/components/tj/TJ'

interface ExtractedTag {
  label: string
  color: 'green' | 'yellow' | 'blue' | 'red'
}

interface ReviewMessage {
  role: 'tj' | 'user'
  text: string
  tags?: ExtractedTag[]
}

const RINK_NAME = 'McKendree Metro Rec Plex'
const TOTAL_CATS = 7

export default function ReviewPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<ReviewMessage[]>([
    {
      role: 'tj',
      text: `Just talk naturally — I'll pick up the details. Start with whatever stands out most. How was the food situation at ${RINK_NAME}?`,
    },
  ])
  const [input, setInput] = useState('')
  const [catsCompleted, setCatsCompleted] = useState(0)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [xpEarned, setXpEarned] = useState(0)

  async function handleSend() {
    if (!input.trim() || loading) return
    const text = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text }])
    setLoading(true)

    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rinkName: RINK_NAME, rawText: text }),
      })
      const data = await res.json()
      const tags = flattenTags(data.tags || [])
      const newCats = Math.min(catsCompleted + (tags.length > 0 ? 2 : 1), TOTAL_CATS)
      setCatsCompleted(newCats)

      if (tags.length > 0) {
        setMessages(prev => [...prev, { role: 'tj', text: "Got it — look right?", tags }])
      }

      const followUp = getFollowUpQuestion(newCats)
      if (followUp) {
        setTimeout(() => {
          setMessages(prev => [...prev, { role: 'tj', text: followUp }])
          setLoading(false)
        }, 600)
      } else {
        setMessages(prev => [...prev, {
          role: 'tj',
          text: "I think we've covered the big ones! Want to save your review?",
        }])
        setLoading(false)
      }
    } catch {
      setMessages(prev => [...prev, { role: 'tj', text: "That was great info! What else stood out?" }])
      setLoading(false)
    }
  }

  async function submitReview() {
    setLoading(true)
    try {
      await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rinkId: 'mckendree-il',
          rawText: messages.filter(m => m.role === 'user').map(m => m.text).join('. '),
        }),
      })
      setXpEarned(125 + catsCompleted * 25)
      setDone(true)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: '#EEF4FA' }}>
        <TopBar showBack backHref="/" title="Review saved!" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', gap: 16 }}>
          <TJ state="celebrate" size="xl" />
          <div className="clay-card" style={{ padding: '16px', width: '100%', textAlign: 'center' }}>
            <div className="display-lg" style={{ marginBottom: 4 }}>Review posted! 🎉</div>
            <div className="body-sm" style={{ color: 'rgba(13,42,74,0.6)', marginBottom: 14 }}>
              You just helped families headed to {RINK_NAME} this weekend.
            </div>
            <div style={{ background: 'var(--rr-green)', border: 'var(--rr-outline)', borderRadius: 'var(--rr-radius)', padding: '12px', boxShadow: 'var(--rr-shadow)', marginBottom: 12 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 28, color: '#fff' }}>
                +{xpEarned} XP
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>added to your total</div>
            </div>
            <button onClick={() => router.push('/')} className="clay-btn clay-btn-primary" style={{ width: '100%' }}>
              Done
            </button>
          </div>
        </div>
      </div>
    )
  }

  const pct = Math.round((catsCompleted / TOTAL_CATS) * 100)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <TopBar showBack backHref="/" title="Add review" />

      <div style={{ background: 'var(--rr-navy)', padding: '8px 14px 0', flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 13, color: '#fff' }}>
          {RINK_NAME}
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
          2 reviews so far · your review helps families this weekend
        </div>
      </div>
      <div style={{ height: 4, background: '#1a3e60', borderBottom: '1.5px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--rr-green)', transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ background: 'var(--rr-navy)', padding: '2px 14px 6px', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textAlign: 'right', fontFamily: 'var(--font-display)', flexShrink: 0 }}>
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
                {msg.tags && msg.tags.length > 0 && (
                  <div className="clay-card-sm" style={{ padding: '10px 12px', marginLeft: 44 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 11, color: 'var(--rr-navy)', marginBottom: 7 }}>
                      ✦ Got it — look right?
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 5 }}>
                      {msg.tags.map((tag, ti) => (
                        <span key={ti} className={`tag-pill tag-pill--${tag.color}`} style={{ cursor: 'pointer' }}>
                          {tag.label}
                        </span>
                      ))}
                    </div>
                    <div className="caption">Tap any tag to remove it</div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {catsCompleted >= 3 && !loading && (
          <button
            onClick={submitReview}
            className="clay-btn clay-btn-primary"
            style={{ width: '100%', marginTop: 4 }}
          >
            Save review · +{125 + catsCompleted * 25} XP
          </button>
        )}
      </div>

      <div style={{ padding: '9px 12px', borderTop: 'var(--rr-outline)', background: 'var(--rr-warm)', display: 'flex', gap: 7, alignItems: 'center', flexShrink: 0 }}>
        <button
          aria-label="Voice input"
          style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--rr-red)', border: 'var(--rr-outline-sm)',
            boxShadow: 'var(--rr-shadow-sm)', cursor: 'pointer',
            flexShrink: 0, color: '#fff', fontSize: 15,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          🎤
        </button>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Tell me about the rink..."
          style={{
            flex: 1, background: '#fff',
            border: 'var(--rr-outline)', borderRadius: 999,
            padding: '8px 13px', fontSize: 12,
            fontFamily: 'var(--font-body)', color: 'var(--rr-navy)', outline: 'none',
          }}
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          aria-label="Send"
          style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--rr-navy)', border: 'none',
            cursor: 'pointer', color: '#fff', fontSize: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, opacity: loading || !input.trim() ? 0.5 : 1,
          }}
        >→</button>
      </div>
    </div>
  )
}

function getFollowUpQuestion(catsCompleted: number): string | null {
  const questions = [
    "Nice! Families always ask — did you notice skate sharpening? And roughly how cold was it?",
    "Great detail! What was parking like — easy to find a spot?",
    "Almost there — anything about WiFi or the locker rooms worth mentioning?",
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
