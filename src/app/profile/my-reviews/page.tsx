'use client'

import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomBanner } from '@/components/layout/BottomBanner'
import { useAuth } from '@/context/AuthContext'

interface MyReview {
  id:          string
  rink_id:     string
  rink_name:   string
  rink_city:   string
  rink_state:  string
  category:    string
  comment:     string
  review_date: string
  status:      'published' | 'pending' | 'rejected'
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  published: { bg: '#3EAE5A', color: '#fff', label: 'Published' },
  pending:   { bg: 'var(--rr-yellow)', color: 'var(--rr-navy)', label: 'Pending review' },
  rejected:  { bg: 'rgba(13,42,74,0.15)', color: 'rgba(13,42,74,0.6)', label: 'Not published' },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.pending
  return (
    <span style={{
      background: s.bg, color: s.color,
      fontSize: 10, fontWeight: 800, fontFamily: 'var(--font-display)',
      padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  )
}

function ReviewCard({ review, token, onUpdated }: {
  review: MyReview
  token: string
  onUpdated: (updated: MyReview) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(review.comment)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleSave() {
    if (!draft.trim()) {
      setError('Comment cannot be empty.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/my-reviews/${review.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ comment: draft.trim() }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error || 'Could not save your edit.')
        return
      }
      onUpdated(data.review)
      setEditing(false)
    } catch {
      setError('Could not save right now — check your connection.')
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setDraft(review.comment)
    setError(null)
    setEditing(false)
  }

  return (
    <div className="clay-card" style={{ padding: '12px 14px', marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 13, color: 'var(--rr-navy)' }}>
            {review.rink_name}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(13,42,74,0.5)', marginTop: 1 }}>
            {review.category}
          </div>
        </div>
        <StatusBadge status={review.status} />
      </div>

      {editing ? (
        <div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            style={{
              width: '100%', boxSizing: 'border-box', fontFamily: 'var(--font-body)',
              fontSize: 13, padding: '8px 10px', borderRadius: 'var(--rr-radius-sm)',
              border: 'var(--rr-outline-sm)', color: 'var(--rr-navy)', resize: 'vertical',
              marginBottom: 6,
            }}
          />
          {error && (
            <div style={{ fontSize: 11, color: '#C8102E', fontWeight: 700, marginBottom: 6 }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              className="clay-btn clay-btn-primary"
              style={{ fontSize: 12, padding: '7px 16px', opacity: saving ? 0.6 : 1 }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="clay-btn clay-btn-secondary"
              style={{ fontSize: 12, padding: '7px 16px' }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 13, color: 'rgba(13,42,74,0.8)', lineHeight: 1.5, marginBottom: 8 }}>
            "{review.comment}"
          </div>
          <button
            onClick={() => setEditing(true)}
            style={{
              background: 'var(--rr-ice)', border: 'var(--rr-outline-sm)', borderRadius: 999,
              padding: '6px 14px', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11,
              color: 'var(--rr-navy)', cursor: 'pointer',
            }}
          >
            Edit
          </button>
        </div>
      )}
    </div>
  )
}

export default function MyReviewsPage() {
  const { user, session, loading: authLoading } = useAuth()
  const [reviews, setReviews] = useState<MyReview[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(function() {
    if (!user || !session?.access_token) return

    fetch('/api/my-reviews', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.reviews) {
          setReviews(data.reviews)
        } else {
          setLoadError(data.error || 'Could not load your reviews.')
        }
      })
      .catch(() => setLoadError('Could not load your reviews — check your connection.'))
      .finally(() => setLoading(false))
  }, [user, session])

  function handleUpdated(updated: MyReview) {
    setReviews((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
  }

  // Client-side filter — the whole list is already loaded in one request,
  // so there's no need for a server round-trip just to narrow it down.
  // Matches against rink name OR category, so "temp" finds every Rink
  // Temperature entry too, not just rink names.
  const query = search.trim().toLowerCase()
  const filteredReviews = query
    ? reviews.filter((r) =>
        r.rink_name.toLowerCase().includes(query) ||
        r.category.toLowerCase().includes(query)
      )
    : reviews

  if (authLoading) {
    return (
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <p className="body-sm" style={{ color: 'rgba(13,42,74,0.4)' }}>Loading...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <TopBar showBack backHref="/profile" title="My Reviews" />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
          <p className="body-md" style={{ color: 'rgba(13,42,74,0.55)' }}>
            Sign in to see the reviews you've left.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <TopBar showBack backHref="/profile" title="My Reviews" />

      <main style={{ flex: 1, overflowY: 'auto', background: '#EEF4FA', padding: 12 }} className="scroll-y">
        {!loading && !loadError && reviews.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <label
              htmlFor="my-reviews-search"
              style={{
                display: 'block', marginBottom: 6, fontSize: 15, fontWeight: 800,
                color: 'var(--rr-navy)', fontFamily: 'var(--font-display)',
                textTransform: 'uppercase', letterSpacing: 0.3,
              }}
            >
              Search by Rink Name or Category
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="my-reviews-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="e.g. South Windsor, Parking..."
                style={{
                  width: '100%', boxSizing: 'border-box', fontFamily: 'var(--font-body)',
                  fontSize: 14, padding: '10px 36px 10px 12px', borderRadius: 'var(--rr-radius-sm)',
                  border: 'var(--rr-outline-sm)', color: 'var(--rr-navy)', background: '#fff',
                  outline: 'none',
                }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  style={{
                    position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                    width: 28, height: 28, borderRadius: '50%', border: 'none',
                    background: 'rgba(13,42,74,0.08)', color: 'rgba(13,42,74,0.6)',
                    fontSize: 14, cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: 30, color: 'rgba(13,42,74,0.4)', fontSize: 12 }}>
            Loading your reviews...
          </div>
        )}

        {!loading && loadError && (
          <div style={{ textAlign: 'center', padding: 30, color: 'rgba(13,42,74,0.5)', fontSize: 12 }}>
            {loadError}
          </div>
        )}

        {!loading && !loadError && reviews.length === 0 && (
          <div style={{ textAlign: 'center', padding: 30, color: 'rgba(13,42,74,0.4)', fontSize: 12 }}>
            You haven't left any reviews yet.
          </div>
        )}

        {!loading && !loadError && reviews.length > 0 && filteredReviews.length === 0 && (
          <div style={{ textAlign: 'center', padding: 30, color: 'rgba(13,42,74,0.4)', fontSize: 12 }}>
            No reviews match "{search}".
          </div>
        )}

        {!loading && !loadError && filteredReviews.map((review) => (
          <ReviewCard
            key={review.id}
            review={review}
            token={session!.access_token}
            onUpdated={handleUpdated}
          />
        ))}
      </main>

      <BottomBanner />
    </div>
  )
}
