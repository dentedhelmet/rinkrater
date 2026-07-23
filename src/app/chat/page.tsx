'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { TJ } from '@/components/tj/TJ'
import type { TJState } from '@/components/tj/TJ'

interface Message {
  role: 'user' | 'agent'
  text: string
  source?: string
  time?: string
}

const QUICK_CHIPS_SETS = [
  [
    'How cold is it?',
    'Girls locker room?',
    'Parking?',
    'WiFi password?',
    'Skate sharpening cost?',
  ],
  [
    'Are there concessions?',
    "How's the ice?",
    'Is there a pro shop?',
    "How's the seating?",
    'Is there a sled hockey program?',
  ],
]

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function ChatPageContent() {
  const searchParams = useSearchParams()
  const rinkId = searchParams.get('rink') || ''

  const [rinkName, setRinkName] = useState('this rink')
  const [rinkLocation, setRinkLocation] = useState('')
  const [totalReviews, setTotalReviews] = useState(0)
  const [tier, setTier] = useState<string | null>(null) // TODO: confirm actual field name on rink record
  const [messages, setMessages] = useState<Message[]>([
    { role: 'agent', text: "Hey! Ask me anything — I'll check the reviews for you.", time: nowTime() },
  ])
  const [input, setInput] = useState('')
  const [tjState, setTjState] = useState<TJState>('idle')
  const [loading, setLoading] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [chipSetIndex, setChipSetIndex] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!rinkId) return
    fetch(`/api/rink/${rinkId}`)
      .then(res => res.json())
      .then(data => {
        if (data.rink) {
          setRinkName(data.rink.name)
          setRinkLocation(`${data.rink.city}, ${data.rink.state}`)
          setTotalReviews(data.stats?.total_reviews || 0)
          setTier(data.rink.tier || null)
          setMessages([{
            role: 'agent',
            text: `Hey! Ask me anything about ${data.rink.name} — I've got ${data.stats?.total_reviews || 0} reviews to work with.`,
            time: nowTime(),
          }])
        }
      })
      .catch(() => {})
  }, [rinkId])

  const thumbnailSrc =
    '/rink-thumbnails/rr_arena' +
    ((Math.abs((rinkId || '').split('').reduce(function (acc, c) { return acc + c.charCodeAt(0) }, 0)) % 14) + 1) +
    '.png'

  const activeChips = QUICK_CHIPS_SETS[chipSetIndex]

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text, time: nowTime() }])
    setLoading(true)
    setTjState('thinking')

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, rinkId, rinkName }),
      })
      const data = await res.json()
      setTjState('answering')
      setMessages(prev => [...prev, {
        role: 'agent',
        text: data.answer ?? 'Sorry, I had trouble finding that information.',
        source: data.reviewsUsed ? `Based on ${data.reviewsUsed} reviews` : undefined,
        time: nowTime(),
      }])
    } catch {
      setMessages(prev => [...prev, { role: 'agent', text: "Hmm, I couldn't reach the rink data right now. Try again?", time: nowTime() }])
    } finally {
      setLoading(false)
      setTjState('idle')
    }
  }

  async function handleShare() {
    if (sharing) return
    setSharing(true)
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rinkId: rinkId, messages: messages }),
      })
      const data = await res.json()
      if (data.shareId) {
        const shareUrl = window.location.origin + '/share/' + data.shareId
        if (navigator.share) {
          await navigator.share({ title: 'My Rink Rater conversation about ' + rinkName, url: shareUrl })
        } else {
          await navigator.clipboard.writeText(shareUrl)
          alert('Link copied to clipboard!')
        }
      }
    } catch (e) {
      alert('Could not create share link. Try again.')
    } finally {
      setSharing(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <TopBar
        showBack
        backHref={rinkId ? `/rink/${rinkId}` : '/'}
        title="ASK TJ ANYTHING"
        rightAction={
          <button
            onClick={handleShare}
            disabled={sharing}
            aria-label="Share this conversation"
            style={{
              width: 52, height: 52,
              background: 'transparent',
              border: 'none',
              cursor: sharing ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: sharing ? 0.5 : 1,
            }}
          >
            <img
              src="/icons/rr_clay_share_chat_button_red.png"
              alt="Share conversation"
              style={{ width: 52, height: 52, objectFit: 'contain' }}
            />
          </button>
        }
      />

      {/* HERO: static banner (TJ + scoreboard baked into the image) + rink info overlay box */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '2.79 / 1',
          maxHeight: 300,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <img
          src="/hero/header-ask-tj-anything1.jpg"
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center 12%',
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

      <div
        style={{ flex: 1, padding: '12px 12px 6px', background: '#EEF4FA', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}
        className="scroll-y"
      >
        {messages.map((msg, i) => (
          <div key={i}>
            {msg.role === 'user' ? (
              <div style={{ alignSelf: 'flex-end', maxWidth: '80%', marginLeft: 'auto' }}>
                <div style={{
                  background: 'var(--rr-red)', color: '#fff',
                  border: 'var(--rr-outline)', borderRadius: '14px 14px 3px 14px',
                  padding: '10px 14px', fontSize: 14, lineHeight: 1.55,
                  boxShadow: 'var(--rr-shadow)',
                }}>
                  {msg.text}
                </div>
                {msg.time && (
                  <div style={{ textAlign: 'right', fontSize: 10, color: 'rgba(13,42,74,0.4)', marginTop: 3, paddingRight: 4 }}>
                    {msg.time} <span style={{ color: 'var(--rr-red)' }}>✓✓</span>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, maxWidth: '92%' }}>
                <TJ state={i === messages.length - 1 ? tjState : 'idle'} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    background: '#fff', border: 'var(--rr-outline)',
                    borderRadius: '4px 16px 16px 16px', padding: '12px 14px',
                    fontSize: 14, lineHeight: 1.6, color: 'var(--rr-navy)',
                    boxShadow: 'var(--rr-shadow)', whiteSpace: 'pre-wrap',
                  }}>
                    {msg.text}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 5, paddingLeft: 4, gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {msg.source && (
                        <span className="caption" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}>
                          ⭐ {msg.source}
                        </span>
                      )}
                      {msg.time && (
                        <span style={{ fontSize: 10, color: 'rgba(13,42,74,0.35)' }}>{msg.time}</span>
                      )}
                    </div>
                    {msg.source && (
                      <a
                        href={rinkId ? '/review?rink=' + rinkId : '/review'}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          border: '1.5px solid var(--rr-red)', borderRadius: 999,
                          padding: '3px 4px 3px 10px', textDecoration: 'none',
                          fontFamily: 'var(--font-display)', fontWeight: 700,
                          fontSize: 10, color: 'var(--rr-red)', whiteSpace: 'nowrap',
                          background: '#fff',
                        }}
                      >
                        Know more?
                        <span style={{
                          background: 'var(--rr-red)', color: '#fff', borderRadius: 999,
                          padding: '4px 9px', fontWeight: 800, letterSpacing: 0.2,
                        }}>
                          LEAVE A REVIEW +125 XP
                        </span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <TJ state="thinking" size="sm" />
            <div style={{
              background: '#fff', border: 'var(--rr-outline)',
              borderRadius: '4px 16px 16px 16px', padding: '10px 14px',
              boxShadow: 'var(--rr-shadow)', display: 'flex', gap: 5, alignItems: 'center',
            }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--rr-navy)', opacity: 0.3 }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length > 1 && (
        <button
          onClick={handleShare}
          disabled={sharing}
          aria-label="Share this conversation"
          className={'floating-share-btn' + (sharing ? ' floating-share-btn--sharing' : '')}
          style={{
            position: 'fixed',
            right: 12,
            bottom: 90,
            width: 81, height: 81,
            background: 'transparent',
            border: 'none',
            cursor: sharing ? 'default' : 'pointer',
            zIndex: 50,
          }}
        >
          <img
            src="/icons/rr_clay_share_chat_button_red.png"
            alt="Share conversation"
            style={{ width: 81, height: 81, objectFit: 'contain' }}
          />
        </button>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '7px 12px', background: 'var(--rr-warm)', borderTop: '1.5px solid rgba(13,42,74,0.08)' }}>
        {activeChips.map(chip => (
          <button
            key={chip}
            onClick={() => sendMessage(chip)}
            style={{
              background: 'var(--rr-warm)', border: 'var(--rr-outline-sm)', borderRadius: '999px',
              padding: '5px 11px', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-display)',
              color: 'var(--rr-navy)', cursor: 'pointer', boxShadow: 'var(--rr-shadow-sm)',
            }}
          >
            {chip}
          </button>
        ))}
        <button
          onClick={() => setChipSetIndex(i => (i + 1) % QUICK_CHIPS_SETS.length)}
          style={{
            marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 800,
            fontFamily: 'var(--font-display)', color: 'var(--rr-navy)', whiteSpace: 'nowrap',
          }}
        >
          🔄 MORE QUESTIONS
        </button>
      </div>

      <div style={{ padding: '9px 12px', borderTop: 'var(--rr-outline)', background: 'var(--rr-warm)', display: 'flex', gap: 7, alignItems: 'center', flexShrink: 0 }}>
        <button
          aria-label="Ask a question"
          style={{
            width: 34, height: 34, borderRadius: '50%', background: 'var(--rr-red)',
            border: '2px solid #fff', boxShadow: 'var(--rr-shadow-sm)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0, color: '#fff', fontSize: 15,
          }}
        >
          ✏️
        </button>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
          placeholder={`Ask anything about ${rinkName}...`}
          style={{
            flex: 1, background: '#fff', border: 'var(--rr-outline)', borderRadius: '999px',
            padding: '8px 13px', fontSize: 12, fontFamily: 'var(--font-body)',
            color: 'var(--rr-navy)', outline: 'none',
          }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
          aria-label="Send message"
          style={{
            width: 34, height: 34, borderRadius: '50%', background: 'var(--rr-red)',
            border: '2px solid #fff', boxShadow: 'var(--rr-shadow-sm)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, color: '#fff', fontSize: 16,
            opacity: loading || !input.trim() ? 0.5 : 1,
          }}
        >
          →
        </button>
      </div>
      <style jsx>{`
        .floating-share-btn {
          animation: slideInFromRight 0.4s ease-out;
        }
        .floating-share-btn:hover, .floating-share-btn:active {
          transform: scale(1.12);
          transition: transform 0.15s ease;
        }
        .floating-share-btn--sharing {
          opacity: 0.5;
        }
        @keyframes slideInFromRight {
          from {
            transform: translateX(80px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div style={{ padding: 20, textAlign: 'center', color: 'rgba(13,42,74,0.4)' }}>Loading...</div>}>
      <ChatPageContent />
    </Suspense>
  )
}
