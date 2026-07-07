'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { BottomBanner } from '@/components/layout/BottomBanner'
import { AuthModal } from '@/components/auth/AuthModal'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

interface GameSummary {
  id:         string
  game_date:  string
  opponent:   string
  rink_name:  string
  score_us:   number
  score_them: number
  periods:    Record<string, { shots: number; goals: number }>
}

function calcSvPct(periods: GameSummary['periods']): string {
  const shots = Object.values(periods).reduce((s, p) => s + p.shots, 0)
  const goals = Object.values(periods).reduce((s, p) => s + p.goals, 0)
  if (shots === 0) return '—'
  const saves = shots - goals
  return '.' + Math.round((saves / shots) * 1000).toString().padStart(3, '0')
}

export default function GameTrackerListPage() {
  const router               = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [games,    setGames]    = useState<GameSummary[]>([])
  const [loading,  setLoading]  = useState(true)
  const [creating, setCreating] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && user) loadGames()
    if (!authLoading && !user) setLoading(false)
  }, [user, authLoading])

  async function loadGames() {
    setLoading(true)
    const { data } = await supabase
      .from('game_stats')
      .select('id, game_date, opponent, rink_name, score_us, score_them, periods')
      .eq('user_id', user!.id)
      .order('game_date', { ascending: false })
    setGames((data as GameSummary[]) ?? [])
    setLoading(false)
  }

  async function createNewGame() {
    if (!user) { setShowAuth(true); return }
    setCreating(true)
    const { data, error } = await supabase
      .from('game_stats')
      .insert({ user_id: user.id })
      .select('id')
      .single()
    setCreating(false)
    if (!error && data) router.push(`/game-tracker/${data.id}`)
  }

  async function deleteGame(id: string) {
    await supabase.from('game_stats').delete().eq('id', id)
    setGames((prev) => prev.filter((g) => g.id !== id))
    setDeleteId(null)
  }

  // ── Not logged in ────────────────────────────────────────────────────────────
  if (!authLoading && !user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <TopBar showBack backHref="/" title="Game Tracker" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>📊</div>
          <h1 className="display-lg" style={{ marginBottom: 8 }}>Game Tracker</h1>
          <p className="body-md" style={{ color: 'rgba(13,42,74,0.55)', maxWidth: 260, marginBottom: 28, lineHeight: 1.6 }}>
            Sign in to track game stats, shots, and build a history for your player.
          </p>
          <button className="clay-btn clay-btn-primary" style={{ fontSize: 16, padding: '13px 36px' }}
            onClick={() => setShowAuth(true)}>
            Sign In
          </button>
        </div>
        <BottomBanner />
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} prompt="Sign in to use Game Tracker" />}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <TopBar showBack backHref="/profile" title="Game Tracker" />

      <main style={{ flex: 1, overflowY: 'auto', background: '#EEF4FA', padding: 12 }} className="scroll-y">

        {/* New Game button */}
        <button
          onClick={createNewGame}
          disabled={creating}
          className="clay-btn clay-btn-primary"
          style={{ width: '100%', fontSize: 16, padding: '13px', marginBottom: 16, opacity: creating ? 0.6 : 1 }}
        >
          {creating ? 'Creating...' : '+ New Game'}
        </button>

        {/* Games list */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'rgba(13,42,74,0.4)' }}>
            Loading games...
          </div>
        ) : games.length === 0 ? (
          <div className="clay-card" style={{ padding: '24px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🏒</div>
            <p className="display-sm" style={{ marginBottom: 6 }}>No games yet</p>
            <p className="body-sm" style={{ color: 'rgba(13,42,74,0.5)' }}>
              Tap "New Game" to start tracking.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {games.map((game) => {
              const totalShots = Object.values(game.periods).reduce((s, p) => s + p.shots, 0)
              const svPct      = calcSvPct(game.periods)
              const won        = game.score_us > game.score_them
              const lost       = game.score_us < game.score_them
              const dated      = new Date(game.game_date + 'T12:00:00')
                .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

              return (
                <div key={game.id} className="clay-card" style={{ padding: 0, overflow: 'hidden' }}>
                  <Link href={`/game-tracker/${game.id}`} style={{ textDecoration: 'none', display: 'block', padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div>
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 15, color: 'var(--rr-navy)' }}>
                          {game.opponent || 'Unnamed game'}
                        </div>
                        <div className="body-xs" style={{ color: 'rgba(13,42,74,0.5)', marginTop: 2 }}>
                          {dated}{game.rink_name ? ` · ${game.rink_name}` : ''}
                        </div>
                      </div>
                      {(game.score_us > 0 || game.score_them > 0) && (
                        <div style={{
                          fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 18,
                          color: won ? 'var(--rr-green)' : lost ? 'var(--rr-red)' : 'var(--rr-navy)',
                        }}>
                          {game.score_us}–{game.score_them}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: 'rgba(13,42,74,0.5)' }}>
                        <span style={{ fontWeight: 800, color: 'var(--rr-navy)' }}>{totalShots}</span> shots faced
                      </div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: 'rgba(13,42,74,0.5)' }}>
                        <span style={{ fontWeight: 800, color: 'var(--rr-navy)' }}>{svPct}</span> SV%
                      </div>
                    </div>
                  </Link>

                  {/* Delete confirm */}
                  {deleteId === game.id ? (
                    <div style={{ borderTop: 'var(--rr-outline-sm)', padding: '10px 14px', display: 'flex', gap: 8, background: '#FFF3C4' }}>
                      <span className="body-xs" style={{ flex: 1, color: 'var(--rr-navy)', fontWeight: 700 }}>Delete this game?</span>
                      <button onClick={() => deleteGame(game.id)} style={{ background: 'var(--rr-red)', color: 'white', border: 'none', borderRadius: 6, padding: '4px 12px', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 11, cursor: 'pointer' }}>Delete</button>
                      <button onClick={() => setDeleteId(null)} style={{ background: 'none', border: '1.5px solid var(--rr-navy)', borderRadius: 6, padding: '4px 10px', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 11, cursor: 'pointer', color: 'var(--rr-navy)' }}>Cancel</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteId(game.id)}
                      style={{ width: '100%', borderTop: 'var(--rr-outline-sm)', padding: '7px', background: 'none', border: 'none', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 10, color: 'rgba(13,42,74,0.35)', cursor: 'pointer', letterSpacing: '0.5px' }}
                    >
                      DELETE GAME
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>

      <BottomBanner />
    </div>
  )
}
