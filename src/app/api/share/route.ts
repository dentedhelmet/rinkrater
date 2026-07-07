export const maxDuration = 30
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const rinkId = body.rinkId
  const messages = body.messages

  if (!rinkId || !messages || !Array.isArray(messages)) {
    return NextResponse.json({ error: 'Missing rinkId or messages' }, { status: 400 })
  }

  const shareId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

  const { error } = await supabase.from('chat_shares').insert({
    id: shareId,
    rink_id: rinkId,
    messages: messages,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ shareId: shareId })
}
