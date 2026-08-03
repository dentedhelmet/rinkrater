'use client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomBanner } from '@/components/layout/BottomBanner'
import { AboutTimeline } from '@/components/about/AboutTimeline'

export default function AboutPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <TopBar showBack backHref="/" title="About" />
      <main
        style={{ flex: 1, overflowY: 'auto', padding: '0 16px 32px' }}
        className="scroll-y"
      >
        <AboutTimeline />
      </main>
      <BottomBanner />
    </div>
  )
}
