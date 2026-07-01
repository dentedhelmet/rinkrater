'use client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomBanner } from '@/components/layout/BottomBanner'

export default function AboutPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <TopBar showBack backHref="/" title="About" />
      <main style={{ flex: 1, overflowY: 'auto', padding: '24px 16px' }} className="scroll-y">
        <div className="clay-card" style={{ padding: '20px', marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 22, color: 'var(--rr-navy)', marginBottom: 12 }}>
            About Rink Rater
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.6, color: 'rgba(13,42,74,0.75)' }}>
            Rink Rater is the go-to resource for hockey families across North America. With over 14,000 reviews from real hockey parents, we help you know what to expect before you arrive at any rink.
          </div>
        </div>
        <div className="clay-card" style={{ padding: '20px', marginBottom: 16, textAlign: 'center', opacity: 0.5 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, color: 'var(--rr-navy)' }}>
            More coming soon
          </div>
        </div>
      </main>
      <BottomBanner />
    </div>
  )
}
