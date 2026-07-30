'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { AVATARS } from '@/lib/avatars'

export function AvatarUpload({ currentUrl, initials }: { currentUrl: string | null; initials: string }) {
  const { user, refreshProfile } = useAuth()
  const [showSheet, setShowSheet] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  async function handlePick(src: string) {
    if (!user || src === currentUrl) {
      setShowSheet(false)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: src })
        .eq('id', user.id)

      if (updateError) throw updateError

      await refreshProfile()
      setShowSheet(false)
    } catch (err) {
      console.error('Avatar update failed:', err)
      setError('Could not update your photo — try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 84, height: 84, borderRadius: '50%',
        border: 'var(--rr-outline)', overflow: 'hidden', flexShrink: 0,
        background: 'var(--rr-yellow)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentUrl} alt="Your avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 28, color: 'var(--rr-navy)' }}>
            {initials}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowSheet(true)}
        className="clay-btn clay-btn-secondary"
        style={{ fontSize: 12, padding: '7px 16px' }}
      >
        Change photo
      </button>

      {error && <div style={{ fontSize: 11, color: 'var(--rr-red)' }}>{error}</div>}

      {showSheet && (
        <>
          <div
            onClick={() => setShowSheet(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(13,42,74,0.5)', zIndex: 200 }}
          />
          <div
            style={{
              position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 205,
              background: 'var(--rr-warm)', borderTopLeftRadius: 20, borderTopRightRadius: 20,
              boxShadow: '0 -8px 30px rgba(0,0,0,0.25)', padding: '16px 16px 24px',
              maxHeight: '75vh', overflowY: 'auto',
            }}
            className="scroll-y"
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 15, color: 'var(--rr-navy)' }}>
                Choose your photo
              </div>
              <button
                onClick={() => setShowSheet(false)}
                aria-label="Close"
                style={{ background: 'transparent', border: 'none', fontSize: 22, color: 'rgba(13,42,74,0.4)', cursor: 'pointer', lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10,
              opacity: saving ? 0.5 : 1, pointerEvents: saving ? 'none' : 'auto',
            }}>
              {AVATARS.map((src) => {
                const isCurrent = src === currentUrl
                return (
                  <button
                    key={src}
                    type="button"
                    onClick={() => handlePick(src)}
                    aria-label={isCurrent ? 'Current photo' : 'Choose this photo'}
                    style={{
                      position: 'relative', padding: 0, background: 'none',
                      border: isCurrent ? '2.5px solid var(--rr-red)' : '2px solid transparent',
                      borderRadius: '50%', cursor: 'pointer',
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt=""
                      style={{ width: '100%', aspectRatio: '1', borderRadius: '50%', display: 'block', objectFit: 'cover' }}
                    />
                    {isCurrent && (
                      <div style={{
                        position: 'absolute', bottom: 0, right: 0, width: 16, height: 16,
                        background: 'var(--rr-red)', borderRadius: '50%', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', fontSize: 9,
                        color: 'white', fontWeight: 900, border: '1.5px solid white',
                      }}>✓</div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
