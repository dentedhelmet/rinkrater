'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface Partner {
  id:          string
  name:        string
  logo_url:    string
  blurb:       string
  facts:       string[]
  href:        string
  sort_order:  number
  is_active:   boolean
  is_featured: boolean
}

// Shown if the partners table can't be reached (or before the v5 migration
// runs), so the public pages never come up empty. Edit partners in the admin
// dashboard — this list is only a safety net.
export const FALLBACK_PARTNERS: Partner[] = [
  {
    id:          'fallback-mhr',
    name:        'My Hockey Rankings',
    logo_url:    '/partners/mhr.v5.logo-full-bg.png',
    blurb:       "My Hockey Rankings uses a data-driven rating system — built from goal differential and strength of schedule — to rank youth hockey teams across thousands of clubs and leagues nationwide. What started as a simple way to help teams find evenly matched opponents has grown into one of youth hockey's most trusted ranking resources, free to families thanks to sponsor support and a dedicated volunteer network.",
    facts:       ['Since 2003', '2,900+ Clubs Tracked', '29,000+ Teams Ranked'],
    href:        'https://myhockeyrankings.com',
    sort_order:  1,
    is_active:   true,
    is_featured: true,
  },
  {
    id:          'fallback-ftloh',
    name:        'For The Love Of Hockey',
    logo_url:    '/partners/FTLOH_Logo_1.png',
    blurb:       "For The Love Of Hockey is a hockey lifestyle and apparel brand built by and for hockey families — sideline hoodies, rink totes, and gear that says \"hockey mom\" or \"hockey dad\" without saying a word. They call themselves hockey's second rink family, backed by a coach-review tool and rewards program built specifically for youth hockey communities.",
    facts:       ['Riverside, CT', 'Hockey Lifestyle Apparel', 'Coach Review Program'],
    href:        'https://fortheloveofhockey11.com',
    sort_order:  2,
    is_active:   true,
    is_featured: true,
  },
]

const PARTNER_COLUMNS = 'id, name, logo_url, blurb, facts, href, sort_order, is_active, is_featured'

/** Active partners for the public pages, in display order. */
export function usePartners({ featuredOnly = false }: { featuredOnly?: boolean } = {}) {
  const [partners, setPartners] = useState<Partner[]>(
    featuredOnly ? FALLBACK_PARTNERS.filter((p) => p.is_featured) : FALLBACK_PARTNERS
  )

  useEffect(() => {
    let cancelled = false
    let query = supabase
      .from('partners')
      .select(PARTNER_COLUMNS)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
    if (featuredOnly) query = query.eq('is_featured', true)

    query.then(({ data, error }) => {
      if (cancelled) return
      if (error) {
        console.error('Could not load partners, showing fallback list:', error)
        return
      }
      setPartners((data as Partner[]) ?? [])
    })
    return () => { cancelled = true }
  }, [featuredOnly])

  return partners
}

export const PARTNER_SELECT = PARTNER_COLUMNS
