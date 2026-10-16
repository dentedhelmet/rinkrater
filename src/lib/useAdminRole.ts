'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

export type AdminRole = 'super_admin' | 'moderator' | 'partner_manager'

/**
 * Looks up the signed-in user's admin role (or null for everyone else).
 *
 * This only decides what the UI shows. The real lock lives in the database:
 * every admin_* function checks the caller's role itself, so hiding or
 * showing a button here can't grant anyone access.
 */
export function useAdminRole() {
  const { user, loading: authLoading } = useAuth()
  const [role, setRole] = useState<AdminRole | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    if (authLoading) return
    if (!user) {
      setRole(null)
      setLoading(false)
      return
    }

    setLoading(true)
    supabase.rpc('my_admin_role').then(({ data, error }) => {
      if (cancelled) return
      if (error) {
        // Not fatal — e.g. the migration hasn't been run yet. Treat as non-admin.
        console.error('my_admin_role failed:', error)
        setRole(null)
      } else {
        setRole((data as AdminRole | null) ?? null)
      }
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [user, authLoading])

  return { role, isAdmin: role !== null, loading: authLoading || loading }
}
