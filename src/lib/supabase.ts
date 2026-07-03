import { createClient } from '@supabase/supabase-js'

// NEXT_PUBLIC_ prefix = accessible on client; falls back to server-only vars
// so existing API routes keep working without changes
const supabaseUrl = (
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.SUPABASE_URL
)!

const supabaseKey = (
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY
)!

export const supabase = createClient(supabaseUrl, supabaseKey)