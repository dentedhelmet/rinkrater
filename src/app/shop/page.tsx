'use client'

import { useEffect, useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomBanner } from '@/components/layout/BottomBanner'
import { supabase } from '@/lib/supabase'

const STOREFRONT_URL = 'https://www.amazon.com/shop/rinkrater'

interface ShopProduct {
  id:          string
  category:    string
  title:       string
  image_url:   string
  product_url: string
  price_note:  string | null
  sort_order:  number
}

interface ShopCategory {
  name:  string
  items: ShopProduct[]
}

// Groups already-sorted rows by category, preserving the order categories
// first appear in (which is controlled by each row's sort_order).
function groupByCategory(rows: ShopProduct[]): ShopCategory[] {
  const groups: ShopCategory[] = []
  const index: Record<string, ShopCategory> = {}

  rows.forEach((row) => {
    let group = index[row.category]
    if (!group) {
      group = { name: row.category, items: [] }
      index[row.category] = group
      groups.push(group)
    }
    group.items.push(row)
  })

  return groups
}

export default function ShopPage() {
  const [categories, setCategories] = useState<ShopCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadProducts() {
      const { data, error } = await supabase
        .from('shop_products')
        .select('id, category, title, image_url, product_url, price_note, sort_order')
        .eq('active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })

      if (cancelled) return

      if (error) {
        console.error('Failed to load shop products:', error)
        setLoadError(true)
        setLoading(false)
        return
      }

      setCategories(groupByCategory(data || []))
      setLoading(false)
    }

    loadProducts()
    return () => { cancelled = true }
  }, [])

  const hasProducts = categories.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <TopBar showBack backHref="/" title="Shop" />
      <main style={{ flex: 1, overflowY: 'auto', padding: '24px 16px' }} className="scroll-y">
        <div className="clay-card" style={{ padding: '20px', marginBottom: 16, textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 22, color: 'var(--rr-navy)', marginBottom: 10 }}>
            Rink Rater Shop
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.6, color: 'rgba(13,42,74,0.75)', marginBottom: 14 }}>
            Gear picks for hockey families, hand-picked by us. Purchases through these links help support Rink Rater at no extra cost to you.
          </div>
          <a
            href={STOREFRONT_URL}
            target="_blank"
            rel="sponsored noopener noreferrer"
            className="clay-btn clay-btn-secondary"
            style={{ display: 'inline-block', padding: '10px 20px' }}
          >
            Browse our full Amazon Storefront {'→'}
          </a>
        </div>

        {loading && (
          <div className="clay-card" style={{ padding: '20px', textAlign: 'center', color: 'rgba(13,42,74,0.5)', fontSize: 13, fontWeight: 700 }}>
            Loading gear…
          </div>
        )}

        {!loading && loadError && (
          <div className="clay-card" style={{ padding: '20px', textAlign: 'center', color: 'rgba(13,42,74,0.5)', fontSize: 13, fontWeight: 700 }}>
            Couldn&apos;t load the shop right now. Try again in a bit, or visit our{' '}
            <a href={STOREFRONT_URL} target="_blank" rel="sponsored noopener noreferrer" style={{ color: 'var(--rr-red)' }}>
              Amazon Storefront
            </a>.
          </div>
        )}

        {!loading && !loadError && !hasProducts && (
          <div className="clay-card" style={{ padding: '20px', marginBottom: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🏒</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, color: 'rgba(13,42,74,0.4)' }}>
              Picks coming soon — check out the full Storefront above in the meantime!
            </div>
          </div>
        )}

        {!loading && !loadError && categories.map((group) => (
          <div key={group.name} className="clay-card" style={{ padding: '16px', marginBottom: 16 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 15, color: 'var(--rr-navy)', marginBottom: 12, textTransform: 'uppercase' }}>
              {group.name}
            </div>
            <div className="shop-grid">
              {group.items.map((item) => (
                <a
                  key={item.id}
                  href={item.product_url}
                  target="_blank"
                  rel="sponsored noopener noreferrer"
                  className="clay-card-sm shop-product-card"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.image_url} alt={item.title} className="shop-product-img" />
                  <div className="shop-product-title">{item.title}</div>
                  {item.price_note && (
                    <div className="shop-product-price">{item.price_note}</div>
                  )}
                  <div className="shop-product-cta">Shop on Amazon {'→'}</div>
                </a>
              ))}
            </div>
          </div>
        ))}
      </main>
      <BottomBanner />

      <style jsx>{`
        .shop-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }
        .shop-product-card {
          display: flex;
          flex-direction: column;
          padding: 10px;
          text-decoration: none;
          cursor: pointer;
        }
        .shop-product-img {
          width: 100%;
          aspect-ratio: 1 / 1;
          object-fit: contain;
          background: #fff;
          border-radius: 8px;
          margin-bottom: 8px;
        }
        .shop-product-title {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 12px;
          color: var(--rr-navy);
          line-height: 1.35;
          margin-bottom: 4px;
          flex: 1;
        }
        .shop-product-price {
          font-family: var(--font-display);
          font-weight: 800;
          font-size: 12px;
          color: var(--rr-navy);
          margin-bottom: 6px;
        }
        .shop-product-cta {
          font-family: var(--font-display);
          font-weight: 800;
          font-size: 11px;
          color: var(--rr-red);
        }
        @media (min-width: 480px) {
          .shop-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        @media (min-width: 768px) {
          .shop-grid {
            grid-template-columns: repeat(4, 1fr);
          }
        }
      `}</style>
    </div>
  )
}
