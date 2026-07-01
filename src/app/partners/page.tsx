'use client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomBanner } from '@/components/layout/BottomBanner'

export default function PartnersPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <TopBar showBack backHref="/" title="Partners" />
      <main style={{ flex: 1, overflowY: 'auto', padding: '24px 16px' }} className="scroll-y">
        <div className="clay-card" style={{ padding: '20px', marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 22, color: 'var(--rr-navy)', marginBottom: 12 }}>
            Our Partners
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.6, color: 'rgba(13,42,74,0.75)', marginBottom: 16 }}>
            Rink Rater is proud to partner with leading organizations in the hockey community.
          </div>
          <a href="https://myhockeyrankings.com" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--rr-ice)', border: 'var(--rr-outline-sm)', borderRadius: 10, padding: '12px 14px', marginBottom: 10, textDecoration: 'none' }}>
            <img src="/partners/mhr.v5.logo-full-bg.png" alt="My Hockey Rankings" style={{ width: 48, height: 48, objectFit: 'contain' }} />
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, color: 'var(--rr-navy)' }}>My Hockey Rankings</div>
          </a>
          <a href="https://fortheloveofhockey11.com" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--rr-ice)', border: 'var(--rr-outline-sm)', borderRadius: 10, padding: '12px 14px', textDecoration: 'none' }}>
            <img src="/partners/FTLOH_Logo_1.png" alt="For The Love Of Hockey" style={{ width: 48, height: 48, objectFit: 'contain' }} />
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, color: 'var(--rr-navy)' }}>For The Love Of Hockey</div>
          </a>
        </div>
        <div className="clay-card" style={{ padding: '20px', textAlign: 'center', opacity: 0.5 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, color: 'var(--rr-navy)' }}>
            Interested in partnering? Coming soon.
          </div>
        </div>
      </main>
      <BottomBanner />
    </div>
  )
}
