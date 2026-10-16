import type { Metadata } from 'next'
import { supabase } from '@/lib/supabase'

// Gives every rink page its own title and description, e.g.
// "Ridgefield Winter Garden — Rink Rater". Used by Google Analytics (to tell
// rinks apart), search results, and link previews.
export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params
  try {
    const { data: rink } = await supabase
      .from('rinks')
      .select('name, city, state')
      .eq('id', decodeURIComponent(id))
      .maybeSingle()

    if (!rink?.name) return { title: 'Rink' }

    const place = [rink.city, rink.state].filter(Boolean).join(', ')
    return {
      title: rink.name,
      description: `What hockey families say about ${rink.name}${place ? ` in ${place}` : ''} — parking, food, temperature, locker rooms and more.`,
    }
  } catch {
    return { title: 'Rink' }
  }
}

export default function RinkLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
