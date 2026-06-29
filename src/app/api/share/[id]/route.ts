import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const { data: share, error } = await supabase
    .from('chat_shares')
    .select('rink_id, messages')
    .eq('id', id)
    .single()

  if (error || !share) {
    return NextResponse.json({ error: 'Share not found' }, { status: 404 })
  }

  const { data: rink, error: rinkError } = await supabase
    .from('rinks')
    .select('id, name, city, state, address, phone, website')
    .eq('id', share.rink_id)
    .single()

  if (rinkError || !rink) {
    return NextResponse.json({ error: 'Rink not found' }, { status: 404 })
  }

  return NextResponse.json({
    rink: rink,
    messages: share.messages,
  })
}
