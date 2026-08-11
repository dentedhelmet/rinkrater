'use client'

import { useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'

const TOPICS = ['General Inquiry', 'Feedback', 'Marketing Partnerships']

const INPUT_STYLE: React.CSSProperties = {
  width:        '100%',
  fontFamily:   'var(--font-body)',
  fontSize:     14,
  padding:      '12px 14px',
  borderRadius: 'var(--rr-radius-sm)',
  border:       'var(--rr-outline-sm)',
  background:   '#fff',
  color:        'var(--rr-navy)',
  outline:      'none',
  boxSizing:    'border-box',
}

const LABEL_STYLE: React.CSSProperties = {
  display:      'block',
  marginBottom: 5,
  color:        'rgba(13,42,74,0.6)',
}

export default function ContactPage() {
  const [topic, setTopic]     = useState(TOPICS[0])
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [phone, setPhone]     = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  // Honeypot — invisible to real visitors, usually filled in by bots.
  // If this has any value on submit, we silently drop the request.
  const [website, setWebsite] = useState('')

  const [sending, setSending] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [sent, setSent]       = useState(false)

  function validate(): string | null {
    if (!name.trim())    return 'Please enter your name.'
    if (!email.trim())   return 'Please enter your email address.'
    if (!subject.trim()) return 'Please enter a subject.'
    if (!message.trim()) return 'Please enter a message.'
    return null
  }

  async function handleSubmit() {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, name, email, phone, subject, message, website }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to send')
      }
      setSent(true)
    } catch (err) {
      console.error('Contact form send failed:', err)
      setError("Something went wrong sending your message. Please try again, or email us directly.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <TopBar showBack backHref="/" title="CONTACT US" />

      {/* HERO: header image with title overlaid on the open left side */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '2.45 / 1',
          maxHeight: 340,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <img
          src="/hero/header-contact-us.jpg"
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
            display: 'block',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: '5%',
            top: '50%',
            transform: 'translateY(-50%)',
            maxWidth: '55%',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 900,
              fontSize: 'clamp(20px, 5vw, 38px)',
              color: 'var(--rr-navy)',
              lineHeight: 1.1,
              marginBottom: 6,
            }}
          >
            Contact Rink Rater
          </div>
          <div
            style={{
              fontSize: 'clamp(11px, 2.2vw, 15px)',
              color: 'rgba(13,42,74,0.7)',
              fontWeight: 600,
              lineHeight: 1.4,
            }}
          >
            Questions, feedback, or partnership ideas — we'd love to hear from you.
          </div>
        </div>
      </div>

      <div style={{ flex: 1, padding: '20px 16px 40px', background: '#EEF4FA', overflowY: 'auto' }} className="scroll-y">
        <div
          className="clay-card"
          style={{ maxWidth: 480, margin: '0 auto', padding: 22, background: 'var(--rr-warm)' }}
        >
          {sent ? (
            <div style={{ textAlign: 'center', padding: '20px 10px' }}>
              <div style={{ fontSize: 44, marginBottom: 10 }}>🏒</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 20, color: 'var(--rr-navy)', marginBottom: 8 }}>
                Message sent!
              </div>
              <div style={{ fontSize: 13, color: 'rgba(13,42,74,0.6)', lineHeight: 1.5 }}>
                Thanks for reaching out — we'll get back to you as soon as we can.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={LABEL_STYLE} htmlFor="contact-topic">Topic</label>
                <select
                  id="contact-topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  style={{ ...INPUT_STYLE, cursor: 'pointer' }}
                >
                  {TOPICS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={LABEL_STYLE} htmlFor="contact-name">Full Name</label>
                <input
                  id="contact-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={INPUT_STYLE}
                  autoComplete="name"
                />
              </div>

              <div>
                <label style={LABEL_STYLE} htmlFor="contact-email">Email Address</label>
                <input
                  id="contact-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={INPUT_STYLE}
                  autoComplete="email"
                />
              </div>

              <div>
                <label style={LABEL_STYLE} htmlFor="contact-phone">Phone Number <span style={{ fontWeight: 400 }}>(optional)</span></label>
                <input
                  id="contact-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={INPUT_STYLE}
                  autoComplete="tel"
                />
              </div>

              <div>
                <label style={LABEL_STYLE} htmlFor="contact-subject">Subject</label>
                <input
                  id="contact-subject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  style={INPUT_STYLE}
                />
              </div>

              <div>
                <label style={LABEL_STYLE} htmlFor="contact-message">Message</label>
                <textarea
                  id="contact-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  style={{ ...INPUT_STYLE, resize: 'vertical' }}
                />
              </div>

              {/* Honeypot field — hidden from real visitors via off-screen positioning,
                  not display:none (some bots skip fields that are display:none). */}
              <div style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }} aria-hidden="true">
                <label htmlFor="contact-website">Website</label>
                <input
                  id="contact-website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>

              {error && (
                <div style={{
                  background:   '#FFD6D6',
                  border:       '1.5px solid #C8102E',
                  borderRadius: 'var(--rr-radius-sm)',
                  padding:      '10px 12px',
                  fontSize:     12,
                  color:        '#791F1F',
                  fontWeight:   700,
                  fontFamily:   'var(--font-display)',
                }}>
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={sending}
                className="clay-btn clay-btn-primary"
                style={{ width: '100%', fontSize: 16, padding: '13px', opacity: sending ? 0.6 : 1 }}
              >
                {sending ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
