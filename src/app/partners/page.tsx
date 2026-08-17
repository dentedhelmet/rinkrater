'use client'

import { useState } from 'react'
import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { BottomBanner } from '@/components/layout/BottomBanner'
import { PartnerModal } from '@/components/partners/PartnerModal'

interface Partner {
  name:  string
  logo:  string
  blurb: string
  facts: string[]
  href:  string
}

// NOTE: blurbs below are original summaries written for Rink Rater, not
// copied from either partner's own site. Facts are drawn from each
// partner's own published numbers — worth checking with each partner
// before publishing to confirm these are still current.
const PARTNERS: Partner[] = [
  {
    name:  'My Hockey Rankings',
    logo:  '/partners/mhr.v5.logo-full-bg.png',
    blurb: "My Hockey Rankings uses a data-driven rating system — built from goal differential and strength of schedule — to rank youth hockey teams across thousands of clubs and leagues nationwide. What started as a simple way to help teams find evenly matched opponents has grown into one of youth hockey's most trusted ranking resources, free to families thanks to sponsor support and a dedicated volunteer network.",
    facts: ['Since 2003', '2,900+ Clubs Tracked', '29,000+ Teams Ranked'],
    href:  'https://myhockeyrankings.com',
  },
  {
    name:  'For The Love Of Hockey',
    logo:  '/partners/FTLOH_Logo_1.png',
    blurb: "For The Love Of Hockey is a hockey lifestyle and apparel brand built by and for hockey families — sideline hoodies, rink totes, and gear that says \"hockey mom\" or \"hockey dad\" without saying a word. They call themselves hockey's second rink family, backed by a coach-review tool and rewards program built specifically for youth hockey communities.",
    facts: ['Riverside, CT', 'Hockey Lifestyle Apparel', 'Coach Review Program'],
    href:  'https://fortheloveofhockey11.com',
  },
]

export default function PartnersPage() {
  const [activePartner, setActivePartner] = useState<Partner | null>(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <TopBar showBack backHref="/" title="Partners" />

      {/* HERO: header image with title on the open left side */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: '2.45 / 1', maxHeight: 300, overflow: 'hidden', flexShrink: 0 }}>
        <img
          src="/hero/header-partners.jpg"
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }}
        />
        <div style={{ position: 'absolute', left: '5%', top: '50%', transform: 'translateY(-50%)', maxWidth: '45%' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'clamp(20px, 5vw, 36px)', color: 'var(--rr-navy)', lineHeight: 1.1, marginBottom: 6 }}>
            Our Partners
          </div>
          <div style={{ fontSize: 'clamp(11px, 2.2vw, 14px)', color: 'rgba(13,42,74,0.7)', fontWeight: 600, lineHeight: 1.4 }}>
            Real reviews. Real partners. Real impact.
          </div>
        </div>
      </div>

      <main style={{ flex: 1, overflowY: 'auto', padding: '24px 16px' }} className="scroll-y">
        <div className="clay-card" style={{ padding: '20px', marginBottom: 16 }}>
          <div style={{ fontSize: 14, lineHeight: 1.6, color: 'rgba(13,42,74,0.75)', marginBottom: 16 }}>
            Rink Rater is proud to partner with leading organizations in the hockey community. Tap a partner below to learn more.
          </div>

          {PARTNERS.map((partner, i) => (
            <button
              key={partner.name}
              onClick={() => setActivePartner(partner)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                background: 'var(--rr-ice)', border: 'var(--rr-outline-sm)', borderRadius: 10,
                padding: '12px 14px', marginBottom: i < PARTNERS.length - 1 ? 10 : 0,
                textAlign: 'left', cursor: 'pointer',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={partner.logo} alt={partner.name} style={{ width: 48, height: 48, objectFit: 'contain', flexShrink: 0 }} />
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, color: 'var(--rr-navy)' }}>
                {partner.name}
              </div>
            </button>
          ))}
        </div>

        <div className="clay-card" style={{ padding: '20px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, color: 'var(--rr-navy)', marginBottom: 14 }}>
            Interested in partnering? FEEL FREE TO REACH OUT.
          </div>
          <Link
            href="/contact"
            className="clay-btn clay-btn-primary"
            style={{ display: 'inline-block', fontSize: 13, padding: '10px 24px', textDecoration: 'none' }}
          >
            Contact Us
          </Link>
        </div>
      </main>

      {activePartner && (
        <PartnerModal
          name={activePartner.name}
          logo={activePartner.logo}
          blurb={activePartner.blurb}
          facts={activePartner.facts}
          href={activePartner.href}
          onClose={() => setActivePartner(null)}
        />
      )}

      <BottomBanner />
    </div>
  )
}
