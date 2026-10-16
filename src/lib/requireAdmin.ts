import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { AdminRole } from '@/lib/useAdminRole'

type AdminCheck =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }

/**
 * Server-side admin gate for /api/admin/* routes.
 *
 * Reads the caller's Supabase session token from the Authorization header and
 * asks the database (has_admin_role) whether they hold one of the given roles.
 * Pass no roles to accept any admin.
 *
 *   const check = await requireAdmin(req, ['super_admin'])
 *   if (!check.ok) return check.response
 */
export async function requireAdmin(req: NextRequest, roles?: AdminRole[]): Promise<AdminCheck> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim()
  if (!token) {
    return { ok: false, response: NextResponse.json({ error: 'Not signed in' }, { status: 401 }) }
  }

  const supabaseAsUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )

  const { data: userData, error: userError } = await supabaseAsUser.auth.getUser()
  if (userError || !userData.user) {
    return { ok: false, response: NextResponse.json({ error: 'Not signed in' }, { status: 401 }) }
  }

  const { data: allowed, error: roleError } = await supabaseAsUser.rpc('has_admin_role', {
    p_roles: roles && roles.length > 0 ? roles : null,
  })

  if (roleError) {
    console.error('has_admin_role check failed:', roleError)
    return { ok: false, response: NextResponse.json({ error: 'Could not verify access' }, { status: 500 }) }
  }
  if (!allowed) {
    return { ok: false, response: NextResponse.json({ error: 'Not authorized' }, { status: 403 }) }
  }

  return { ok: true, userId: userData.user.id }
}
