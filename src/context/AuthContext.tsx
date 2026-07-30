'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface Profile {
  id:                 string
  alias:              string
  initials:           string
  avatar_url:         string | null
  full_name:          string | null
  country:            'US' | 'CA' | 'OTHER' | null
  state:              string | null
  player_type:        ('parent' | 'player' | 'coach' | 'other')[] | null
  player_type_other:  string | null
  favorite_skates:    string | null
  current_stick:      string | null
  level:              number
  level_title:        string
  xp:                 number
  xp_to_next:         number
  streak:             number
  total_reviews:      number
  families_helped:    number
  created_at:         string
}

interface AuthContextType {
  user:           User    | null
  profile:        Profile | null
  session:        Session | null
  loading:        boolean
  signOut:        () => Promise<void>
  refreshProfile: () => Promise<void>
}

// ─── Context ───────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextType>({
  user:           null,
  profile:        null,
  session:        null,
  loading:        true,
  signOut:        async () => {},
  refreshProfile: async () => {},
})

// ─── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<User    | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (error) {
      console.error('fetchProfile failed:', error)
      return
    }
    if (data) setProfile(data as Profile)
  }, [])

  useEffect(() => {
    let settled = false

    // Hard safety net: no matter what happens below — getSession() hangs,
    // throws, or the network is just slow — loading is FORCED to false
    // after 8s so the UI can never spin forever.
    const timeout = setTimeout(() => {
      if (!settled) {
        console.error('Auth getSession() timed out after 8s — forcing loading=false')
        setLoading(false)
      }
    }, 8000)

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          return fetchProfile(session.user.id)
        }
      })
      .catch((err) => {
        // Previously missing entirely — if getSession() ever rejected,
        // setLoading(false) below never ran, leaving the app stuck loading
        // forever with no way to recover.
        console.error('getSession() failed:', err)
      })
      .finally(() => {
        settled = true
        clearTimeout(timeout)
        setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        try {
          setSession(session)
          setUser(session?.user ?? null)
          if (session?.user) {
            await fetchProfile(session.user.id)
          } else {
            setProfile(null)
          }
        } catch (err) {
          console.error('onAuthStateChange handler failed:', err)
        } finally {
          setLoading(false)
        }
      }
    )

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error('signOut failed:', err)
    } finally {
      // Clear local state regardless of whether the network call itself
      // succeeded. Someone clicking "Sign Out" should never see nothing
      // happen just because that request was slow or briefly failed.
      setUser(null)
      setProfile(null)
      setSession(null)
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id)
  }, [user, fetchProfile])

  return (
    <AuthContext.Provider
      value={{ user, profile, session, loading, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// ─── Hook ──────────────────────────────────────────────────────────────────────
export const useAuth = () => useContext(AuthContext)
