'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

// Matches the single-admin RLS check on shop_products (auth.users.email).
// When role-based admin access lands, swap this for a role lookup instead.
const ADMIN_EMAIL = 'senan@rinkrater.com'

interface ShopProductRow {
  id:          string
  category:    string
  title:       string
  image_url:   string
  product_url: string
  price_note:  string | null
  sort_order:  number
  active:      boolean
  created_at:  string
}

type ProductDraft = {
  category:    string
  title:       string
  image_url:   string
  product_url: string
  price_note:  string
  sort_order:  string
  active:      boolean
}

const BLANK_DRAFT: ProductDraft = {
  category:    '',
  title:       '',
  image_url:   '',
  product_url: '',
  price_note:  '',
  sort_order:  '0',
  active:      true,
}

function rowToDraft(row: ShopProductRow): ProductDraft {
  return {
    category:    row.category,
    title:       row.title,
    image_url:   row.image_url,
    product_url: row.product_url,
    price_note:  row.price_note || '',
    sort_order:  String(row.sort_order),
    active:      row.active,
  }
}

export default function AdminShopPage() {
  const { user, loading: authLoading } = useAuth()

  const [products, setProducts] = useState<ShopProductRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [newDraft, setNewDraft] = useState<ProductDraft>(BLANK_DRAFT)
  const [addPending, setAddPending] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const [rowDrafts, setRowDrafts] = useState<Record<string, ProductDraft>>({})
  const [rowPending, setRowPending] = useState<Record<string, boolean>>({})
  const [rowError, setRowError] = useState<Record<string, string>>({})

  const isAdmin = !!user?.email && user.email === ADMIN_EMAIL

  const loadProducts = useCallback(async () => {
    setLoading(true)
    setLoadError(null)

    const { data, error } = await supabase
      .from('shop_products')
      .select('id, category, title, image_url, product_url, price_note, sort_order, active, created_at')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Failed to load shop products:', error)
      setLoadError('Could not load products. Check console for details.')
      setLoading(false)
      return
    }

    const rows = data || []
    setProducts(rows)
    setRowDrafts(Object.fromEntries(rows.map((row) => [row.id, rowToDraft(row)])))
    setLoading(false)
  }, [])

  useEffect(() => {
    if (isAdmin) loadProducts()
  }, [isAdmin, loadProducts])

  const categoryOptions = Array.from(new Set(products.map((p) => p.category))).sort()

  function draftToPayload(draft: ProductDraft) {
    return {
      category:    draft.category.trim(),
      title:       draft.title.trim(),
      image_url:   draft.image_url.trim(),
      product_url: draft.product_url.trim(),
      price_note:  draft.price_note.trim() || null,
      sort_order:  Number.parseInt(draft.sort_order, 10) || 0,
      active:      draft.active,
    }
  }

  function validateDraft(draft: ProductDraft): string | null {
    if (!draft.category.trim()) return 'Category is required.'
    if (!draft.title.trim()) return 'Title is required.'
    if (!draft.image_url.trim()) return 'Image URL is required.'
    if (!draft.product_url.trim()) return 'Amazon product link is required.'
    return null
  }

  async function handleAddProduct() {
    const validationError = validateDraft(newDraft)
    if (validationError) {
      setAddError(validationError)
      return
    }

    setAddPending(true)
    setAddError(null)

    const { error } = await supabase.from('shop_products').insert(draftToPayload(newDraft))

    setAddPending(false)

    if (error) {
      console.error('Failed to add shop product:', error)
      setAddError(error.message || 'Could not add product.')
      return
    }

    setNewDraft({ ...BLANK_DRAFT, category: newDraft.category })
    loadProducts()
  }

  async function handleSaveRow(id: string) {
    const draft = rowDrafts[id]
    if (!draft) return

    const validationError = validateDraft(draft)
    if (validationError) {
      setRowError((prev) => ({ ...prev, [id]: validationError }))
      return
    }

    setRowPending((prev) => ({ ...prev, [id]: true }))
    setRowError((prev) => ({ ...prev, [id]: '' }))

    const { error } = await supabase
      .from('shop_products')
      .update({ ...draftToPayload(draft), updated_at: new Date().toISOString() })
      .eq('id', id)

    setRowPending((prev) => ({ ...prev, [id]: false }))

    if (error) {
      console.error('Failed to update shop product:', error)
      setRowError((prev) => ({ ...prev, [id]: error.message || 'Could not save changes.' }))
      return
    }

    loadProducts()
  }

  async function handleDeleteRow(id: string, title: string) {
    if (!window.confirm(`Delete "${title}" from the shop? This can't be undone.`)) return

    setRowPending((prev) => ({ ...prev, [id]: true }))

    const { error } = await supabase.from('shop_products').delete().eq('id', id)

    setRowPending((prev) => ({ ...prev, [id]: false }))

    if (error) {
      console.error('Failed to delete shop product:', error)
      setRowError((prev) => ({ ...prev, [id]: error.message || 'Could not delete.' }))
      return
    }

    loadProducts()
  }

  function updateRowDraft(id: string, patch: Partial<ProductDraft>) {
    setRowDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  if (authLoading) {
    return <div className="admin-page-state">Loading…</div>
  }

  if (!isAdmin) {
    return (
      <div className="admin-page-state">
        <h1>Not authorized</h1>
        <p>This page is only available to Rink Rater admins.</p>
      </div>
    )
  }

  return (
    <div className="admin-shop-page">
      <h1>Shop Products</h1>
      <p className="subtitle">
        Products listed here appear on the public Shop page, grouped by
        category. Lower sort order shows first, both for categories (based
        on their lowest-sorted product) and for products within a category.
        Uncheck &quot;Active&quot; to hide a product without deleting it.
      </p>

      <div className="clay-card add-card">
        <h2>Add a product</h2>

        <label htmlFor="new-category">Category</label>
        <input
          id="new-category"
          type="text"
          list="category-options"
          value={newDraft.category}
          onChange={(e) => setNewDraft((prev) => ({ ...prev, category: e.target.value }))}
          placeholder="e.g. Stay Warm and Cheer"
        />
        <datalist id="category-options">
          {categoryOptions.map((cat) => <option key={cat} value={cat} />)}
        </datalist>

        <label htmlFor="new-title">Title</label>
        <input
          id="new-title"
          type="text"
          value={newDraft.title}
          onChange={(e) => setNewDraft((prev) => ({ ...prev, title: e.target.value }))}
          placeholder="Product name as it should show on the site"
        />

        <label htmlFor="new-image">Image URL</label>
        <input
          id="new-image"
          type="text"
          value={newDraft.image_url}
          onChange={(e) => setNewDraft((prev) => ({ ...prev, image_url: e.target.value }))}
          placeholder="https://..."
        />

        <label htmlFor="new-link">Amazon product link</label>
        <input
          id="new-link"
          type="text"
          value={newDraft.product_url}
          onChange={(e) => setNewDraft((prev) => ({ ...prev, product_url: e.target.value }))}
          placeholder="https://www.amazon.com/dp/..."
        />

        <div className="field-row">
          <div className="field-col">
            <label htmlFor="new-price">Price note (optional)</label>
            <input
              id="new-price"
              type="text"
              value={newDraft.price_note}
              onChange={(e) => setNewDraft((prev) => ({ ...prev, price_note: e.target.value }))}
              placeholder="e.g. $49.99"
            />
          </div>
          <div className="field-col field-col-narrow">
            <label htmlFor="new-sort">Sort order</label>
            <input
              id="new-sort"
              type="number"
              value={newDraft.sort_order}
              onChange={(e) => setNewDraft((prev) => ({ ...prev, sort_order: e.target.value }))}
            />
          </div>
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={newDraft.active}
            onChange={(e) => setNewDraft((prev) => ({ ...prev, active: e.target.checked }))}
          />
          Active (visible on the Shop page)
        </label>

        {addError && <p className="action-error" role="alert">{addError}</p>}

        <button
          type="button"
          className="clay-btn approve-btn"
          disabled={addPending}
          onClick={handleAddProduct}
        >
          {addPending ? 'Adding…' : 'Add product'}
        </button>
      </div>

      {loading && <p>Loading products…</p>}
      {loadError && <p className="load-error">{loadError}</p>}
      {!loading && !loadError && products.length === 0 && (
        <p className="empty-state">No products yet — add your first one above.</p>
      )}

      <div className="products-list">
        {products.map((row) => {
          const draft = rowDrafts[row.id] || rowToDraft(row)
          return (
            <div key={row.id} className={`clay-card product-card ${draft.active ? '' : 'product-card--inactive'}`}>
              <div className="card-header">
                <img src={draft.image_url || row.image_url} alt="" className="thumb" />
                <div className="header-meta">
                  <div className="header-title">{row.title}</div>
                  <div className="header-sub">{row.category}</div>
                </div>
                {!draft.active && <span className="tier-chip inactive-chip">Hidden</span>}
              </div>

              <label>Category</label>
              <input
                type="text"
                list="category-options"
                value={draft.category}
                onChange={(e) => updateRowDraft(row.id, { category: e.target.value })}
              />

              <label>Title</label>
              <input
                type="text"
                value={draft.title}
                onChange={(e) => updateRowDraft(row.id, { title: e.target.value })}
              />

              <label>Image URL</label>
              <input
                type="text"
                value={draft.image_url}
                onChange={(e) => updateRowDraft(row.id, { image_url: e.target.value })}
              />

              <label>Amazon product link</label>
              <input
                type="text"
                value={draft.product_url}
                onChange={(e) => updateRowDraft(row.id, { product_url: e.target.value })}
              />

              <div className="field-row">
                <div className="field-col">
                  <label>Price note</label>
                  <input
                    type="text"
                    value={draft.price_note}
                    onChange={(e) => updateRowDraft(row.id, { price_note: e.target.value })}
                  />
                </div>
                <div className="field-col field-col-narrow">
                  <label>Sort order</label>
                  <input
                    type="number"
                    value={draft.sort_order}
                    onChange={(e) => updateRowDraft(row.id, { sort_order: e.target.value })}
                  />
                </div>
              </div>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) => updateRowDraft(row.id, { active: e.target.checked })}
                />
                Active (visible on the Shop page)
              </label>

              {rowError[row.id] && <p className="action-error" role="alert">{rowError[row.id]}</p>}

              <div className="action-row">
                <button
                  type="button"
                  className="clay-btn approve-btn"
                  disabled={!!rowPending[row.id]}
                  onClick={() => handleSaveRow(row.id)}
                >
                  {rowPending[row.id] ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  type="button"
                  className="clay-btn reject-btn"
                  disabled={!!rowPending[row.id]}
                  onClick={() => handleDeleteRow(row.id, row.title)}
                >
                  Delete
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <style jsx>{`
        .admin-page-state {
          padding: 48px 24px;
          text-align: center;
          color: var(--rr-navy);
        }
        .admin-shop-page {
          max-width: 720px;
          margin: 0 auto;
          padding: 32px 16px 80px;
        }
        h1 {
          font-family: 'Nunito', sans-serif;
          color: var(--rr-navy);
          margin-bottom: 4px;
        }
        h2 {
          font-family: 'Nunito', sans-serif;
          color: var(--rr-navy);
          font-size: 1.1rem;
          margin: 0 0 12px;
        }
        .subtitle {
          color: rgba(13, 42, 74, 0.75);
          margin-bottom: 24px;
        }
        .add-card {
          padding: 20px;
          margin-bottom: 28px;
        }
        .load-error {
          color: var(--rr-red);
          font-weight: 700;
        }
        .empty-state {
          color: rgba(13, 42, 74, 0.7);
          font-size: 1.1rem;
        }
        .products-list {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .product-card {
          padding: 20px;
        }
        .product-card--inactive {
          opacity: 0.6;
        }
        .card-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 14px;
        }
        .thumb {
          width: 44px;
          height: 44px;
          object-fit: contain;
          background: #fff;
          border-radius: 8px;
          border: 1.5px solid rgba(13, 42, 74, 0.15);
          flex-shrink: 0;
        }
        .header-meta {
          flex: 1;
          min-width: 0;
        }
        .header-title {
          font-weight: 800;
          color: var(--rr-navy);
        }
        .header-sub {
          font-size: 0.8rem;
          color: rgba(13, 42, 74, 0.6);
        }
        .tier-chip.inactive-chip {
          background: var(--rr-tier-nodata);
          color: rgba(13, 42, 74, 0.6);
        }
        label {
          display: block;
          font-weight: 700;
          color: var(--rr-navy);
          margin: 12px 0 4px;
          font-size: 0.85rem;
        }
        input {
          width: 100%;
          padding: 10px 12px;
          border-radius: 10px;
          border: 2px solid rgba(13, 42, 74, 0.15);
          font-family: inherit;
          font-size: 0.95rem;
          box-sizing: border-box;
        }
        input:focus {
          outline: 3px solid var(--rr-yellow);
          outline-offset: 1px;
          border-color: var(--rr-navy);
        }
        .field-row {
          display: flex;
          gap: 12px;
        }
        .field-col {
          flex: 1;
        }
        .field-col-narrow {
          flex: 0 0 100px;
        }
        .checkbox-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 14px;
        }
        .checkbox-row input {
          width: auto;
        }
        .action-error {
          color: var(--rr-red);
          font-weight: 700;
          margin: 10px 0 0;
        }
        .action-row {
          display: flex;
          gap: 12px;
          margin-top: 16px;
        }
        .approve-btn,
        .reject-btn {
          flex: 1;
          min-height: 44px;
        }
        .reject-btn {
          background: transparent;
          border: 2px solid var(--rr-red);
          color: var(--rr-red);
        }
      `}</style>
    </div>
  )
}
