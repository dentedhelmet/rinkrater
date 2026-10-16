'use client'

import { usePartners } from '@/lib/partners'

export function FeaturedPartners() {
  const PARTNERS = usePartners({ featuredOnly: true })
  if (PARTNERS.length === 0) return null

  return (
    <div className="clay-card" style={{ padding: '14px', marginBottom: 14 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 13, color: 'var(--rr-navy)', marginBottom: 10 }}>
        FEATURED PARTNERS
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {PARTNERS.map(function(partner) {
          return (
            <a
              key={partner.id}
              href={partner.href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: 'var(--rr-ice)',
                border: 'var(--rr-outline-sm)',
                borderRadius: 10,
                padding: '8px 10px',
                textDecoration: 'none',
              }}
            >
              <img
                src={partner.logo_url}
                alt={partner.name}
                style={{ width: 40, height: 40, objectFit: 'contain', flexShrink: 0 }}
              />
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, color: 'var(--rr-navy)' }}>
                {partner.name}
              </div>
            </a>
          )
        })}
      </div>
    </div>
  )
}
