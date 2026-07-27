'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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

export default function ResetPasswordPage() {
  const router = useRouter()
  const [ready,    setReady]    = useState(false)
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState(false)

  useEffect(() => {
    // Supabase's client auto-detects the recovery token in the URL and
    // fires a PASSWORD_RECOVERY event once it establishes a session from it.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })

    // Fallback in case the event already fired before this listener mounted
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit() {
    setError(null)
    if (!password || password.length < 6) return setError('Password must be at least 6 characters.')
    if (password !== confirm) return setError('Passwords do not match.')

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
      setTimeout(() => router.push('/profile'), 1500)
    }
  }

  return (
    <div style={{
      display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center',
      padding: 16, background: '#EEF4FA', minHeight: '100dvh',
    }}>
      <div style={{
        width: '100%', maxWidth: 400,
        background: 'var(--rr-warm)', border: 'var(--rr-outline)',
        borderRadius: 'var(--rr-radius)', boxShadow: 'var(--rr-shadow-lg)',
        padding: '24px 20px 32px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo/rinkrater-logo.png" alt="Rink Rater" style={{ width: 100, height: 70, objectFit: 'contain' }} />
        </div>

        <div className="display-lg" style={{ textAlign: 'center', marginBottom: 8 }}>
          Set a new password
        </div>

        {!ready && !success && (
          <p className="body-sm" style={{ textAlign: 'center', color: 'rgba(13,42,74,0.55)' }}>
            Verifying your reset link...
          </p>
        )}

        {ready && !success && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={INPUT_STYLE}
              autoComplete="new-password"
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              style={INPUT_STYLE}
              autoComplete="new-password"
            />
            {error && (
              <div style={{
                background: '#FFD6D6', border: '1.5px solid #C8102E',
                borderRadius: 'var(--rr-radius-sm)', padding: '10px 12px',
                fontSize: 12, color: '#791F1F', fontWeight: 700, fontFamily: 'var(--font-display)',
              }}>
                {error}
              </div>
            )}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="clay-btn clay-btn-primary"
              style={{ width: '100%', fontSize: 16, padding: '13px', opacity: loading ? 0.6 : 1 }}
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        )}

        {success && (
          <div style={{
            background: 'var(--rr-tier-trusted)', border: '1.5px solid #3BB273',
            borderRadius: 'var(--rr-radius-sm)', padding: 14, textAlign: 'center', marginTop: 16,
          }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>🏒</div>
            <p className="body-sm" style={{ color: '#085041', fontWeight: 700 }}>
              Password updated! Redirecting...
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
