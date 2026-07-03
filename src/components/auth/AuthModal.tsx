'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'

// ─── Types ─────────────────────────────────────────────────────────────────────
type Tab = 'signin' | 'signup'

interface AuthModalProps {
  onClose:     () => void
  defaultTab?: Tab
  /** Optional message shown above the form, e.g. "Sign in to save your score" */
  prompt?:     string
}

// ─── Shared input style ────────────────────────────────────────────────────────
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

// ─── Avatar options ────────────────────────────────────────────────────────────
const AVATARS = Array.from({ length: 27 }, (_, i) => `/characters/profile_photo${i + 1}.png`)

// ─── Component ─────────────────────────────────────────────────────────────────
export function AuthModal({ onClose, defaultTab = 'signin', prompt }: AuthModalProps) {
  const [tab,            setTab]            = useState<Tab>(defaultTab)
  const [email,          setEmail]          = useState('')
  const [password,       setPassword]       = useState('')
  const [alias,          setAlias]          = useState('')
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null)
  const [loading,        setLoading]        = useState(false)
  const [error,          setError]          = useState<string | null>(null)
  const [success,        setSuccess]        = useState<string | null>(null)
  const [mounted,        setMounted]        = useState(false)

  useEffect(() => { setMounted(true) }, [])

  function switchTab(t: Tab) {
    setTab(t)
    setError(null)
    setSuccess(null)
  }

  // ── Sign In ──────────────────────────────────────────────────────────────────
  async function handleSignIn() {
    if (!email || !password) {
      setError('Please fill in all fields.')
      return
    }
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message === 'Invalid login credentials'
        ? 'Wrong email or password. Try again.'
        : error.message)
    } else {
      onClose()
    }
    setLoading(false)
  }

  // ── Sign Up ──────────────────────────────────────────────────────────────────
  async function handleSignUp() {
    setError(null)

    if (!alias.trim())           return setError('Choose a hockey alias.')
    if (alias.trim().length < 3) return setError('Alias must be at least 3 characters.')
    if (!selectedAvatar)         return setError('Please pick a profile photo.')
    if (!email)                  return setError('Email is required.')
    if (!password)               return setError('Password is required.')
    if (password.length < 6)     return setError('Password must be at least 6 characters.')

    setLoading(true)

    // Check alias availability
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .ilike('alias', alias.trim())
      .maybeSingle()

    if (existing) {
      setError('That alias is taken — try another.')
      setLoading(false)
      return
    }

    // Create auth user
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      const trimmedAlias = alias.trim()
      const initials     = trimmedAlias.substring(0, 2).toUpperCase()

      const { error: profileError } = await supabase.from('profiles').insert({
        id:              data.user.id,
        alias:           trimmedAlias,
        initials,
        avatar_url:      selectedAvatar,
        level:           1,
        level_title:     'Rookie',
        xp:              0,
        xp_to_next:      500,
        streak:          0,
        total_reviews:   0,
        families_helped: 0,
      })

      if (profileError) {
        setError('Account created but profile setup failed. Please sign in.')
      } else {
        setSuccess("Welcome to Rink Rater! Check your email to verify your account, then sign in.")
      }
    }

    setLoading(false)
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  if (!mounted) return null

  return createPortal(
    /* Backdrop */
    <div
      onClick={onClose}
      style={{
        position:       'fixed',
        inset:          0,
        background:     'rgba(13,42,74,0.7)',
        zIndex:         300,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        '16px',
      }}
    >
      {/* Modal card */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width:        '100%',
          maxWidth:     400,
          maxHeight:    '90dvh',
          overflowY:    'auto',
          background:   'var(--rr-warm)',
          border:       'var(--rr-outline)',
          borderRadius: 'var(--rr-radius)',
          boxShadow:    'var(--rr-shadow-lg)',
          padding:      '20px 20px 32px',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo/rinkrater-logo.png"
            alt="Rink Rater"
            style={{ width: 100, height: 70, objectFit: 'contain', display: 'block' }}
          />
        </div>

        {/* Optional prompt */}
        {prompt && (
          <p
            className="body-sm"
            style={{ textAlign: 'center', color: 'rgba(13,42,74,0.55)', marginBottom: 16 }}
          >
            {prompt}
          </p>
        )}

        {/* Tabs */}
        <div style={{
          display:       'grid',
          gridTemplateColumns: '1fr 1fr',
          gap:           6,
          marginBottom:  20,
          background:    'var(--rr-ice)',
          border:        'var(--rr-outline-sm)',
          borderRadius:  'var(--rr-radius-pill)',
          padding:       4,
        }}>
          {(['signin', 'signup'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              style={{
                fontFamily:   'var(--font-display)',
                fontWeight:   800,
                fontSize:     13,
                padding:      '8px',
                borderRadius: 'var(--rr-radius-pill)',
                border:       tab === t ? 'var(--rr-outline-sm)' : 'none',
                background:   tab === t ? 'var(--rr-warm)' : 'transparent',
                color:        'var(--rr-navy)',
                boxShadow:    tab === t ? 'var(--rr-shadow-sm)' : 'none',
                cursor:       'pointer',
                transition:   'all 0.15s',
              }}
            >
              {t === 'signin' ? 'Sign In' : 'Join Up'}
            </button>
          ))}
        </div>

        {/* Success state */}
        {success ? (
          <div style={{
            background:   'var(--rr-tier-trusted)',
            border:       '1.5px solid #3BB273',
            borderRadius: 'var(--rr-radius-sm)',
            padding:      '14px',
            textAlign:    'center',
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>🏒</div>
            <p className="body-sm" style={{ color: '#085041', fontWeight: 700 }}>{success}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Alias field (sign up only) */}
            {tab === 'signup' && (
              <div>
                <label
                  className="label"
                  style={{ display: 'block', marginBottom: 5, color: 'rgba(13,42,74,0.6)' }}
                >
                  Hockey Alias
                </label>
                <input
                  type="text"
                  placeholder="e.g. HockeyMomof3"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  style={INPUT_STYLE}
                  autoComplete="username"
                  maxLength={24}
                />
                <p className="body-xs" style={{ marginTop: 4, color: 'rgba(13,42,74,0.4)' }}>
                  Your public name on Rink Rater. No spaces.
                </p>
              </div>
            )}

            {/* Avatar picker (sign up only) */}
            {tab === 'signup' && (
              <div>
                <label
                  className="label"
                  style={{ display: 'block', marginBottom: 8, color: 'rgba(13,42,74,0.6)' }}
                >
                  Pick your profile photo
                </label>
                <div style={{
                  display:       'grid',
                  gridTemplateColumns: 'repeat(6, 1fr)',
                  gap:           8,
                  maxHeight:     180,
                  overflowY:     'auto',
                  padding:       '4px 2px',
                  borderRadius:  'var(--rr-radius-sm)',
                  border:        'var(--rr-outline-sm)',
                  background:    '#fff',
                  paddingTop:    8,
                  paddingBottom: 8,
                  paddingLeft:   8,
                  paddingRight:  8,
                }}>
                  {AVATARS.map((src) => {
                    const isSelected = selectedAvatar === src
                    return (
                      <button
                        key={src}
                        type="button"
                        onClick={() => setSelectedAvatar(src)}
                        style={{
                          position:     'relative',
                          padding:      0,
                          background:   'none',
                          border:       isSelected ? '2.5px solid var(--rr-red)' : '2px solid transparent',
                          borderRadius: '50%',
                          cursor:       'pointer',
                          transition:   'border-color 0.15s',
                          boxShadow:    isSelected ? '0 0 0 2px rgba(200,16,46,0.2)' : 'none',
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt=""
                          style={{
                            width:        '100%',
                            aspectRatio:  '1',
                            borderRadius: '50%',
                            display:      'block',
                            objectFit:    'cover',
                          }}
                        />
                        {isSelected && (
                          <div style={{
                            position:       'absolute',
                            bottom:         0,
                            right:          0,
                            width:          16,
                            height:         16,
                            background:     'var(--rr-red)',
                            borderRadius:   '50%',
                            display:        'flex',
                            alignItems:     'center',
                            justifyContent: 'center',
                            fontSize:       9,
                            color:          'white',
                            fontWeight:     900,
                            border:         '1.5px solid white',
                          }}>✓</div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label
                className="label"
                style={{ display: 'block', marginBottom: 5, color: 'rgba(13,42,74,0.6)' }}
              >
                Email
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={INPUT_STYLE}
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div>
              <label
                className="label"
                style={{ display: 'block', marginBottom: 5, color: 'rgba(13,42,74,0.6)' }}
              >
                Password
              </label>
              <input
                type="password"
                placeholder={tab === 'signup' ? 'Min. 6 characters' : '••••••••'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (tab === 'signin' ? handleSignIn() : handleSignUp())}
                style={INPUT_STYLE}
                autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
              />
            </div>

            {/* Error */}
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

            {/* CTA */}
            <button
              onClick={tab === 'signin' ? handleSignIn : handleSignUp}
              disabled={loading}
              className="clay-btn clay-btn-primary"
              style={{ width: '100%', fontSize: 16, padding: '13px', opacity: loading ? 0.6 : 1 }}
            >
              {loading
                ? 'One moment...'
                : tab === 'signin'
                ? 'Sign In'
                : 'Create Account'}
            </button>

            {/* Switch tab hint */}
            <p className="body-xs" style={{ textAlign: 'center', color: 'rgba(13,42,74,0.4)' }}>
              {tab === 'signin' ? (
                <>No account? <button onClick={() => switchTab('signup')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rr-red)', fontWeight: 700, fontSize: 11, fontFamily: 'var(--font-display)', padding: 0 }}>Join up →</button></>
              ) : (
                <>Already have one? <button onClick={() => switchTab('signin')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rr-red)', fontWeight: 700, fontSize: 11, fontFamily: 'var(--font-display)', padding: 0 }}>Sign in →</button></>
              )}
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
