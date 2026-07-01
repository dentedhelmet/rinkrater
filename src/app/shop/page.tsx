'use client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomBanner } from '@/components/layout/BottomBanner'

export default function ShopPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <TopBar showBack backHref="/" title="Shop" />
      <main style={{ flex: 1, overflowY: 'auto', padding: '24px 16px' }} className="scroll-y">
        <div className="clay-card" style={{ padding: '20px', marginBottom: 16, textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 22, color: 'var(--rr-navy)', marginBottom: 12 }}>
            Rink Rater Shop
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.6, color: 'rgba(13,42,74,0.75)', marginBottom: 16 }}>
            Gear for hockey families — coming soon.
          </div>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🏒</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, color: 'rgba(13,42,74,0.4)' }}>
            Check back soon!
          </div>
        </div>
      </main>
      <BottomBanner />
    </div>
  )
}
