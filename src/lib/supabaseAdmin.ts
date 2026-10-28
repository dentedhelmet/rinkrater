import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Server-only Supabase client using the SERVICE ROLE key.
 *
 * This key skips Row Level Security entirely, so:
 *   • only import this from API routes / server code, never a 'use client' file
 *   • the env var must NOT start with NEXT_PUBLIC_ (that would ship it to browsers)
 *
 * Returns null when the key isn't set, so callers can fail quietly instead of
 * crashing the request (e.g. on a machine where .env.local isn't updated yet).
 */
let cached: SupabaseClient | null = null

export function supabaseAdmin(): SupabaseClient | null {
  if (typeof window !== 'undefined') {
    throw new Error('supabaseAdmin() must only be used on the server.')
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null

  if (!cached) {
    cached = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return cached
}
