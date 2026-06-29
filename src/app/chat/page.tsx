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
}

const QUICK_CHIPS = [
  'How cold is it?',
  'Girls locker room?',
  'Parking?',
  'WiFi password?',
  'Skate sharpening cost?',
]

function ChatPageContent() {
  const searchParams = useSearchParams()
  const rinkId = searchParams.get('rink') || ''

  const [rinkName, setRinkName] = useState('this rink')
  const [rinkLocation, setRinkLocation] = useState('')
  const [messages, setMessages] = useState<Message[]>([
    { role: 'agent', text: "Hey! Ask me anything — I'll check the reviews for you." },
  ])
  const [input, setInput] = useState('')
  const [tjState, setTjState] = useState<TJState>('idle')
  const [loading, setLoading] = useState(false)
  const [sharing, setSharing] = useState(false)
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
          setMessages([{
            role: 'agent',
            text: `Hey! Ask me anything about ${data.rink.name} — I've got ${data.stats?.total_reviews || 0} reviews to work with.`,
          }])
        }
      })
      .catch(() => {})
  }, [rinkId])

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text }])
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
      }])
    } catch {
      setMessages(prev => [...prev, { role: 'agent', text: "Hmm, I couldn't reach the rink data right now. Try again?" }])
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
        title="Ask TJ"
        rightAction={
          <button
            onClick={handleShare}
            disabled={sharing}
            aria-label="Share this conversation"
            style={{
              width: 36, height: 36,
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
              style={{ width: 36, height: 36, objectFit: 'contain' }}
            />
          </button>
        }
      />

      <div style={{ background: 'var(--rr-navy)', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: 'var(--rr-outline)', flexShrink: 0 }}>
        <TJ state={tjState} size="sm" />
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13, color: '#fff' }}>
            {rinkName}
          </div>
          {rinkLocation && (
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
              {rinkLocation}
            </div>
          )}
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
                  border: 'var(--rr-outline)', borderRadius: '12px 12px 2px 12px',
                  padding: '9px 13px', fontSize: 14, lineHeight: 1.55,
                  boxShadow: 'var(--rr-shadow)',
                }}>
                  {msg.text}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, maxWidth: '90%' }}>
                <TJ state={i === messages.length - 1 ? tjState : 'idle'} size="sm" />
                <div>
                  <div style={{
                    background: 'var(--rr-warm)', border: 'var(--rr-outline)',
                    borderRadius: '12px 12px 12px 2px', padding: '9px 13px',
                    fontSize: 14, lineHeight: 1.6, color: 'var(--rr-navy)',
                    boxShadow: 'var(--rr-shadow)', whiteSpace: 'pre-wrap',
                  }}>
                    {msg.text}
                  </div>
                  {msg.source && (
                    <div className="caption" style={{ marginTop: 3, paddingLeft: 4 }}>
                      {msg.source}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7 }}>
            <TJ state="thinking" size="sm" />
            <div style={{
              background: 'var(--rr-warm)', border: 'var(--rr-outline)',
              borderRadius: '12px 12px 12px 2px', padding: '10px 14px',
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

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '7px 12px', background: 'var(--rr-warm)', borderTop: '1.5px solid rgba(13,42,74,0.08)' }}>
        {QUICK_CHIPS.map(chip => (
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
      </div>

      <div style={{ padding: '9px 12px', borderTop: 'var(--rr-outline)', background: 'var(--rr-warm)', display: 'flex', gap: 7, alignItems: 'center', flexShrink: 0 }}>
        <button
          aria-label="Voice input"
          style={{
            width: 32, height: 32, borderRadius: '50%', background: 'var(--rr-red)',
            border: 'var(--rr-outline-sm)', boxShadow: 'var(--rr-shadow-sm)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0, color: '#fff', fontSize: 15,
          }}
        >
          🎤
        </button>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
          placeholder="Ask anything about this rink..."
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
            width: 32, height: 32, borderRadius: '50%', background: 'var(--rr-navy)', border: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, color: '#fff', fontSize: 16,
            opacity: loading || !input.trim() ? 0.5 : 1,
          }}
        >
          →
        </button>
      </div>
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