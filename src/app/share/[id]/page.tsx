'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { TJ } from '@/components/tj/TJ'

interface Message {
  role: 'user' | 'agent'
  text: string
}

interface RinkData {
  id: string
  name: string
  address?: string
  city: string
  state: string
  phone?: string
  website?: string
}

export default function SharePage() {
  const params = useParams()
  const id = params?.id as string

  const [rink, setRink] = useState<RinkData | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(function() {
    if (!id) return

    fetch('/api/share/' + id)
      .then(function(res) {
        if (!res.ok) throw new Error('not found')
        return res.json()
      })
      .then(function(data) {
        setRink(data.rink)
        setMessages(data.messages || [])
      })
      .catch(function() { setNotFound(true) })
      .finally(function() { setLoading(false) })
  }, [id])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', color: 'rgba(13,42,74,0.4)' }}>
        Loading shared conversation...
      </div>
    )
  }

  if (notFound || !rink) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', padding: 20, textAlign: 'center', color: 'rgba(13,42,74,0.4)' }}>
        This shared conversation could not be found.
      </div>
    )
  }

  const mapsQuery = encodeURIComponent(rink.name + ' ' + rink.city + ' ' + rink.state)
  const mapsUrl = 'https://www.google.com/maps/search/?api=1' + String.fromCharCode(38) + 'query=' + mapsQuery

  return (
    <div style={{ minHeight: '100dvh', background: '#EEF4FA' }}>
      <div style={{ background: 'var(--rr-red)', padding: '14px 16px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 18, color: '#fff' }}>
          Rink Rater
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', letterSpacing: '1px', textTransform: 'uppercase' }}>
          Rate where you skate
        </div>
      </div>

      <div style={{ background: 'var(--rr-navy)', padding: '16px 16px 14px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 20, color: '#fff', marginBottom: 4 }}>
          {rink.name}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
          {rink.address ? rink.address + ' - ' : ''}{rink.city}, {rink.state}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: '10px 16px', background: 'var(--rr-warm)', borderBottom: 'var(--rr-outline)' }}>
        {rink.phone ? (
          <a
            href={'tel:+1' + rink.phone.replace(/[^0-9]/g, '')}
            style={{ background: 'var(--rr-warm)', border: 'var(--rr-outline)', borderRadius: 10, padding: '8px 4px', textAlign: 'center', textDecoration: 'none' }}
          >
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 10, color: 'var(--rr-navy)' }}>Contact</div>
          </a>
        ) : (
          <div style={{ background: 'var(--rr-warm)', border: 'var(--rr-outline)', borderRadius: 10, padding: '8px 4px', textAlign: 'center', opacity: 0.4 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 10, color: 'var(--rr-navy)' }}>Contact</div>
          </div>
        )}
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ background: 'var(--rr-warm)', border: 'var(--rr-outline)', borderRadius: 10, padding: '8px 4px', textAlign: 'center', textDecoration: 'none' }}
        >
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 10, color: 'var(--rr-navy)' }}>Directions</div>
        </a>
        <Link
          href={'/nearby?rink=' + rink.id}
          style={{ background: 'var(--rr-warm)', border: 'var(--rr-outline)', borderRadius: 10, padding: '8px 4px', textAlign: 'center', textDecoration: 'none', display: 'block' }}
        >
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 10, color: 'var(--rr-navy)' }}>Nearby</div>
        </Link>
      </div>

      <div style={{ padding: '16px 16px 8px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 14, color: 'var(--rr-navy)', marginBottom: 10 }}>
          A conversation with TJ
        </div>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map(function(msg, i) {
          if (msg.role === 'user') {
            return (
              <div key={i} style={{ alignSelf: 'flex-end', maxWidth: '85%' }}>
                <div style={{
                  background: 'var(--rr-red)', color: '#fff',
                  border: 'var(--rr-outline)', borderRadius: '12px 12px 2px 12px',
                  padding: '9px 13px', fontSize: 14, lineHeight: 1.55,
                  boxShadow: 'var(--rr-shadow)',
                }}>
                  {msg.text}
                </div>
              </div>
            )
          }
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-end', gap: 7, maxWidth: '90%' }}>
              <TJ state="idle" size="sm" crop="face" />
              <div style={{
                background: 'var(--rr-warm)', border: 'var(--rr-outline)',
                borderRadius: '12px 12px 12px 2px', padding: '9px 13px',
                fontSize: 14, lineHeight: 1.6, color: 'var(--rr-navy)',
                boxShadow: 'var(--rr-shadow)', whiteSpace: 'pre-wrap',
              }}>
                {msg.text}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ padding: '20px 16px 40px', textAlign: 'center' }}>
        <Link
          href={'/rink/' + rink.id}
          style={{
            display: 'inline-block',
            background: 'var(--rr-red)',
            color: '#fff',
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 13,
            padding: '12px 24px',
            borderRadius: 999,
            textDecoration: 'none',
            border: 'var(--rr-outline)',
            boxShadow: 'var(--rr-shadow)',
          }}
        >
          See more reviews for {rink.name}
        </Link>
      </div>
    </div>
  )
}
