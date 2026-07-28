'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { TopBar } from '@/components/layout/TopBar'
import { BottomBanner } from '@/components/layout/BottomBanner'
import { AvatarUpload } from '@/components/profile/AvatarUpload'

const PLAYER_TYPE_OPTIONS = [
  { value: 'parent', label: 'Parent' },
  { value: 'player', label: 'Player' },
  { value: 'coach',  label: 'Coach' },
  { value: 'other',  label: 'Other' },
] as const

const COUNTRY_OPTIONS = [
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'OTHER', label: 'Other' },
] as const

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
]

const CA_PROVINCES = [
  'AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT',
]

function inputStyle(): React.CSSProperties {
  return {
    width: '100%',
    padding: '10px 12px',
    border: 'var(--rr-outline-sm)',
    borderRadius: 10,
    fontSize: 14,
    fontFamily: 'var(--font-body)',
    color: 'var(--rr-navy)',
    background: '#fff',
    outline: 'none',
  }
}

function labelStyle(): React.CSSProperties {
  return {
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: 11,
    color: 'rgba(13,42,74,0.6)',
    textTransform: 'uppercase',
    marginBottom: 6,
    display: 'block',
  }
}

export default function ProfileEditPage() {
  const router = useRouter()
  const { user, profile, loading, refreshProfile } = useAuth()

  const [fullName, setFullName]               = useState('')
  const [country, setCountry]                 = useState('US')
  const [state, setState]                     = useState('')
  const [playerType, setPlayerType]           = useState<string | null>(null)
  const [playerTypeOther, setPlayerTypeOther] = useState('')
  const [favoriteSkates, setFavoriteSkates]   = useState('')
  const [currentStick, setCurrentStick]       = useState('')

  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [error, setError]   = useState<string | null>(null)

  // Hydrate form fields once the profile loads
  useEffect(function() {
    if (!profile) return
    setFullName(profile.full_name || '')
    setCountry(profile.country || 'US')
    setState(profile.state || '')
    setPlayerType(profile.player_type || null)
    setPlayerTypeOther(profile.player_type_other || '')
    setFavoriteSkates(profile.favorite_skates || '')
    setCurrentStick(profile.current_stick || '')
  }, [profile])

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <div style={{ fontSize: 32 }}>⛸️</div>
        <p className="body-sm" style={{ color: 'rgba(13,42,74,0.4)' }}>Loading...</p>
      </div>
    )
  }

  if (!user || !profile) {
    router.push('/profile')
    return null
  }

  async function handleSave() {
    if (!user) return

    setSaving(true)
    setError(null)
    setSaved(false)

    const updates = {
      full_name: fullName.trim() || null,
      country: country,
      state: state || null,
      player_type: playerType,
      player_type_other: playerType === 'other' ? (playerTypeOther.trim() || null) : null,
      favorite_skates: favoriteSkates.trim() || null,
      current_stick: currentStick.trim() || null,
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)

    if (updateError) {
      console.error('Profile save failed:', updateError)
      setError('Something went wrong saving your profile. Please try again.')
      setSaving(false)
      return
    }

    await refreshProfile()
    setSaving(false)
    setSaved(true)
    setTimeout(function() { setSaved(false) }, 3000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <TopBar showBack={true} backHref="/profile" title="Edit Profile" />

      <main style={{ flex: 1, overflowY: 'auto', background: '#EEF4FA', padding: '20px 16px' }} className="scroll-y">

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <AvatarUpload currentUrl={profile.avatar_url} initials={profile.initials} />
        </div>

        <div className="clay-card" style={{ padding: 16, marginBottom: 14 }}>
          <label style={labelStyle()}>Name</label>
          <input
            type="text"
            value={fullName}
            onChange={function(e) { setFullName(e.target.value) }}
            placeholder="Your name"
            style={{ ...inputStyle(), marginBottom: 14 }}
          />

          <label style={labelStyle()}>Country</label>
          <select
            value={country}
            onChange={function(e) {
              setCountry(e.target.value)
              setState('') // reset region when country changes
            }}
            style={{ ...inputStyle(), marginBottom: 14 }}
          >
            {COUNTRY_OPTIONS.map(function(c) {
              return <option key={c.value} value={c.value}>{c.label}</option>
            })}
          </select>

          <label style={labelStyle()}>
            {country === 'CA' ? 'Province' : country === 'US' ? 'State' : 'Region'}
          </label>
          {country === 'OTHER' ? (
            <input
              type="text"
              value={state}
              onChange={function(e) { setState(e.target.value) }}
              placeholder="Region or city"
              style={{ ...inputStyle(), marginBottom: 0 }}
            />
          ) : (
            <select
              value={state}
              onChange={function(e) { setState(e.target.value) }}
              style={{ ...inputStyle(), marginBottom: 0 }}
            >
              <option value="">Select {country === 'CA' ? 'a province' : 'a state'}</option>
              {(country === 'CA' ? CA_PROVINCES : US_STATES).map(function(s) {
                return <option key={s} value={s}>{s}</option>
              })}
            </select>
          )}
        </div>

        <div className="clay-card" style={{ padding: 16, marginBottom: 14 }}>
          <label style={labelStyle()}>I'm a...</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: playerType === 'other' ? 10 : 0 }}>
            {PLAYER_TYPE_OPTIONS.map(function(opt) {
              const isSelected = playerType === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={function() { setPlayerType(opt.value) }}
                  style={{
                    background: isSelected ? 'var(--rr-red)' : 'var(--rr-ice)',
                    color: isSelected ? '#fff' : 'var(--rr-navy)',
                    border: 'var(--rr-outline-sm)',
                    borderRadius: 10,
                    padding: '10px 8px',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>

          {playerType === 'other' && (
            <input
              type="text"
              value={playerTypeOther}
              onChange={function(e) { setPlayerTypeOther(e.target.value) }}
              placeholder="Tell us more (e.g. Rink Manager, Fan)"
              style={inputStyle()}
            />
          )}
        </div>

        <div className="clay-card" style={{ padding: 16, marginBottom: 14 }}>
          <label style={labelStyle()}>Favorite Skates</label>
          <input
            type="text"
            value={favoriteSkates}
            onChange={function(e) { setFavoriteSkates(e.target.value) }}
            placeholder="e.g. Bauer Vapor Hyperlite"
            style={{ ...inputStyle(), marginBottom: 14 }}
          />

          <label style={labelStyle()}>Current Stick</label>
          <input
            type="text"
            value={currentStick}
            onChange={function(e) { setCurrentStick(e.target.value) }}
            placeholder="e.g. CCM Jetspeed FT6"
            style={inputStyle()}
          />
        </div>

        {error && (
          <div style={{ color: 'var(--rr-red)', fontSize: 12, marginBottom: 12, textAlign: 'center' }}>
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="clay-btn clay-btn-primary"
          style={{ width: '100%', fontSize: 15, padding: '13px 0' }}
        >
          {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save Changes'}
        </button>

      </main>

      <BottomBanner />
    </div>
  )
}