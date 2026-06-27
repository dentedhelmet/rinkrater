'use client'

const PARTNERS = [
  {
    name: 'My Hockey Rankings',
    logo: '/partners/mhr.v5.logo-full-bg.png',
    url: 'https://myhockeyrankings.com',
  },
  {
    name: 'For The Love Of Hockey',
    logo: '/partners/FTLOH_Logo_1.png',
    url: 'https://fortheloveofhockey11.com',
  },
]

export function FeaturedPartners() {
  return (
    <div className="clay-card" style={{ padding: '14px', marginBottom: 14 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 13, color: 'var(--rr-navy)', marginBottom: 10 }}>
        Featured Partners
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {PARTNERS.map(function(partner) {
          return (
            <a
              key={partner.name}
              href={partner.url}
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
                src={partner.logo}
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
