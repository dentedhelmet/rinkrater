'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { BottomBanner } from '@/components/layout/BottomBanner'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { RinkSVG } from '@/components/game-tracker/RinkSVG'
import type { ShotDot, ShotResult, ShotType, Period } from '@/components/game-tracker/RinkSVG'

// ─── Types ─────────────────────────────────────────────────────────────────────
interface PeriodStats { shots: number; goals: number }

interface GameData {
  id:         string
  game_date:  string
  opponent:   string
  rink_id:    string | null
  rink_name:  string
  score_us:   number
  score_them: number
  periods:    Record<Period, PeriodStats>
  pk_shots:   number; pk_saves: number; pk_goals: number
  sh_shots:   number; sh_saves: number; sh_goals: number
}

type Tab        = 'stats' | 'map'
type SaveStatus = 'saved' | 'saving' | 'error'

const PERIODS: Period[] = ['1st', '2nd', '3rd', 'OT']

const DEFAULT_PERIODS: Record<Period, PeriodStats> = {
  '1st': { shots: 0, goals: 0 },
  '2nd': { shots: 0, goals: 0 },
  '3rd': { shots: 0, goals: 0 },
  'OT':  { shots: 0, goals: 0 },
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function svPct(shots: number, goals: number): string {
  if (shots === 0) return '—'
  const saves = shots - goals
  return '.' + Math.round((saves / shots) * 1000).toString().padStart(3, '0')
}

function clamp(n: number, min = 0, max = 999) {
  return Math.max(min, Math.min(max, n))
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function GameTrackerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router  = useRouter()
  const { user } = useAuth()

  const [game,       setGame]       = useState<GameData | null>(null)
  const [shots,      setShots]      = useState<ShotDot[]>([])
  const [tab,        setTab]        = useState<Tab>('stats')
  const [loading,    setLoading]    = useState(true)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [mapFilter,  setMapFilter]  = useState<Period | 'all'>('all')

  // Shot placement modal
  const [placing,        setPlacing]        = useState(false)
  const [pendingPeriod,  setPendingPeriod]   = useState<Period>('1st')
  const [pendingPos,     setPendingPos]      = useState<{ x: number; y: number } | null>(null)
  const [pendingType,    setPendingType]     = useState<ShotType | null>(null)
  const [pendingResult,  setPendingResult]   = useState<ShotResult | null>(null)
  const [shotDetail,     setShotDetail]      = useState<ShotDot | null>(null)

  // ── Load ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (user) loadGame()
  }, [user, id])

  async function loadGame() {
    setLoading(true)
    const [{ data: g }, { data: s }] = await Promise.all([
      supabase.from('game_stats').select('*').eq('id', id).single(),
      supabase.from('shot_locations').select('*').eq('game_id', id).order('created_at'),
    ])
    if (g) {
      setGame({
        ...g,
        periods: { ...DEFAULT_PERIODS, ...g.periods },
      } as GameData)
    }
    setShots((s ?? []) as ShotDot[])
    setLoading(false)
  }

  // ── Save game ───────────────────────────────────────────────────────────────
  const saveGame = useCallback(async (updated: GameData) => {
    setSaveStatus('saving')
    const { error } = await supabase
      .from('game_stats')
      .update({
        game_date:  updated.game_date,
        opponent:   updated.opponent,
        rink_id:    updated.rink_id,
        rink_name:  updated.rink_name,
        score_us:   updated.score_us,
        score_them: updated.score_them,
        periods:    updated.periods,
        pk_shots:   updated.pk_shots,
        pk_saves:   updated.pk_saves,
        pk_goals:   updated.pk_goals,
        sh_shots:   updated.sh_shots,
        sh_saves:   updated.sh_saves,
        sh_goals:   updated.sh_goals,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    setSaveStatus(error ? 'error' : 'saved')
  }, [id])

  // ── Period counter helpers ──────────────────────────────────────────────────
  function adjustPeriodStat(
    period: Period,
    field: 'shots' | 'goals',
    delta: number,
    skipModal = false
  ) {
    if (!game) return
    if (field === 'shots' && delta > 0 && !skipModal) {
      // Open placement modal
      setPendingPeriod(period)
      setPendingPos(null)
      setPendingType(null)
      setPendingResult(null)
      setPlacing(true)
      return
    }
    const updated: GameData = {
      ...game,
      periods: {
        ...game.periods,
        [period]: {
          ...game.periods[period],
          [field]: clamp(game.periods[period][field] + delta),
        },
      },
    }
    setGame(updated)
    saveGame(updated)
  }

  function adjustField(field: keyof GameData, delta: number) {
    if (!game) return
    const updated = { ...game, [field]: clamp((game[field] as number) + delta) }
    setGame(updated)
    saveGame(updated)
  }

  function updateField(field: keyof GameData, value: string | number | null) {
    if (!game) return
    const updated = { ...game, [field]: value }
    setGame(updated)
    saveGame(updated)
  }

  // ── Confirm shot placement ──────────────────────────────────────────────────
  async function confirmShot() {
    if (!game || !pendingPos || !pendingType || !pendingResult) return
    setSaveStatus('saving')

    // Insert shot_location
    const { data: newShot, error } = await supabase
      .from('shot_locations')
      .insert({
        game_id:   id,
        period:    pendingPeriod,
        x:         pendingPos.x,
        y:         pendingPos.y,
        shot_type: pendingType,
        result:    pendingResult,
      })
      .select()
      .single()

    if (!error && newShot) {
      setShots((prev) => [...prev, newShot as ShotDot])
    }

    // Update period stats
    const updatedGame: GameData = {
      ...game,
      periods: {
        ...game.periods,
        [pendingPeriod]: {
          shots: game.periods[pendingPeriod].shots + 1,
          goals: game.periods[pendingPeriod].goals + (pendingResult === 'goal' ? 1 : 0),
        },
      },
    }
    setGame(updatedGame)
    await saveGame(updatedGame)

    setPlacing(false)
    // Switch to map tab briefly so user sees their dot
    setTab('map')
    setMapFilter(pendingPeriod)
    setTimeout(() => setTab('stats'), 1500)
  }

  async function deleteShot(shot: ShotDot) {
    if (!game) return
    await supabase.from('shot_locations').delete().eq('id', shot.id)
    setShots((prev) => prev.filter((s) => s.id !== shot.id))

    // Decrement period counter
    const updatedGame: GameData = {
      ...game,
      periods: {
        ...game.periods,
        [shot.period]: {
          shots: clamp(game.periods[shot.period].shots - 1),
          goals: clamp(game.periods[shot.period].goals - (shot.result === 'goal' ? 1 : 0)),
        },
      },
    }
    setGame(updatedGame)
    saveGame(updatedGame)
    setShotDetail(null)
  }

  // ── Derived totals ──────────────────────────────────────────────────────────
  const totalShots  = game ? PERIODS.reduce((s, p) => s + game.periods[p].shots, 0) : 0
  const totalGoals  = game ? PERIODS.reduce((s, p) => s + game.periods[p].goals, 0) : 0
  const totalSaves  = totalShots - totalGoals
  const overallSvPct = svPct(totalShots, totalGoals)

  const filteredShots = mapFilter === 'all'
    ? shots
    : shots.filter((s) => s.period === mapFilter)

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading || !game) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <TopBar showBack backHref="/game-tracker" title="Game Tracker" />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(13,42,74,0.4)' }}>
          Loading...
        </div>
      </div>
    )
  }

  const dated = new Date(game.game_date + 'T12:00:00')
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

      {/* ── TopBar ── */}
      <TopBar
        showBack
        backHref="/game-tracker"
        title={game.opponent || 'Game Tracker'}
        rightAction={
          <span style={{
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 10,
            color: saveStatus === 'saving' ? '#FFD23F'
                 : saveStatus === 'error'  ? '#C8102E'
                 : 'rgba(255,255,255,0.45)',
          }}>
            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'error' ? 'Error' : 'Saved ✓'}
          </span>
        }
      />

      {/* ── Tab bar ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'var(--rr-navy)', borderBottom: 'var(--rr-outline)' }}>
        {(['stats', 'map'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13,
            padding: '11px',
            background: tab === t ? 'var(--rr-warm)' : 'transparent',
            color: tab === t ? 'var(--rr-navy)' : 'rgba(255,255,255,0.55)',
            border: 'none', cursor: 'pointer',
            borderBottom: tab === t ? '3px solid var(--rr-red)' : '3px solid transparent',
            transition: 'all 0.15s',
          }}>
            {t === 'stats' ? '📋 STATS' : '🗺 SHOT MAP'}
          </button>
        ))}
      </div>

      <main style={{ flex: 1, overflowY: 'auto', background: '#EEF4FA' }} className="scroll-y">

        {/* ══════════════════════════════════════════════════════════════════════
            STATS TAB
        ══════════════════════════════════════════════════════════════════════ */}
        {tab === 'stats' && (
          <div style={{ padding: '12px 12px 24px' }}>

            {/* ── Game Details ── */}
            <div className="clay-card" style={{ padding: '14px 14px', marginBottom: 10 }}>
              <div className="label" style={{ color: 'rgba(13,42,74,0.5)', marginBottom: 10 }}>GAME DETAILS</div>

              {/* Date */}
              <div style={{ marginBottom: 10 }}>
                <label className="label" style={{ display: 'block', marginBottom: 4, color: 'rgba(13,42,74,0.5)' }}>DATE</label>
                <input
                  type="date"
                  value={game.game_date}
                  onChange={(e) => updateField('game_date', e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: 'var(--rr-outline-sm)', borderRadius: 'var(--rr-radius-sm)', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--rr-navy)', background: '#fff', boxSizing: 'border-box' }}
                />
              </div>

              {/* Opponent */}
              <div style={{ marginBottom: 10 }}>
                <label className="label" style={{ display: 'block', marginBottom: 4, color: 'rgba(13,42,74,0.5)' }}>OPPONENT</label>
                <input
                  type="text"
                  placeholder="Team name"
                  value={game.opponent}
                  onChange={(e) => updateField('opponent', e.target.value)}
                  onBlur={() => saveGame(game)}
                  style={{ width: '100%', padding: '9px 12px', border: 'var(--rr-outline-sm)', borderRadius: 'var(--rr-radius-sm)', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--rr-navy)', background: '#fff', boxSizing: 'border-box' }}
                />
              </div>

              {/* Location */}
              <div style={{ marginBottom: 10 }}>
                <label className="label" style={{ display: 'block', marginBottom: 4, color: 'rgba(13,42,74,0.5)' }}>LOCATION</label>
                <input
                  type="text"
                  placeholder="Rink name"
                  value={game.rink_name}
                  onChange={(e) => updateField('rink_name', e.target.value)}
                  onBlur={() => saveGame(game)}
                  style={{ width: '100%', padding: '9px 12px', border: 'var(--rr-outline-sm)', borderRadius: 'var(--rr-radius-sm)', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--rr-navy)', background: '#fff', boxSizing: 'border-box' }}
                />
              </div>

              {/* Score */}
              <div>
                <div className="label" style={{ marginBottom: 6, color: 'rgba(13,42,74,0.5)' }}>FINAL SCORE</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div className="label" style={{ textAlign: 'center', marginBottom: 4, color: 'rgba(13,42,74,0.4)' }}>US</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                      <button onClick={() => adjustField('score_us', -1)} className="clay-btn clay-btn-secondary" style={{ padding: '6px 12px', fontSize: 16 }}>−</button>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 28, minWidth: 36, textAlign: 'center', color: 'var(--rr-navy)' }}>{game.score_us}</span>
                      <button onClick={() => adjustField('score_us', 1)} className="clay-btn clay-btn-primary" style={{ padding: '6px 12px', fontSize: 16 }}>+</button>
                    </div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 24, color: 'rgba(13,42,74,0.3)' }}>—</div>
                  <div style={{ flex: 1 }}>
                    <div className="label" style={{ textAlign: 'center', marginBottom: 4, color: 'rgba(13,42,74,0.4)' }}>THEM</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                      <button onClick={() => adjustField('score_them', -1)} className="clay-btn clay-btn-secondary" style={{ padding: '6px 12px', fontSize: 16 }}>−</button>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 28, minWidth: 36, textAlign: 'center', color: 'var(--rr-navy)' }}>{game.score_them}</span>
                      <button onClick={() => adjustField('score_them', 1)} className="clay-btn clay-btn-primary" style={{ padding: '6px 12px', fontSize: 16 }}>+</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Period Stats ── */}
            <div className="clay-card" style={{ padding: '14px', marginBottom: 10 }}>
              <div className="label" style={{ color: 'rgba(13,42,74,0.5)', marginBottom: 10 }}>PERIOD STATS</div>

              {PERIODS.map((period) => {
                const p     = game.periods[period]
                const saves = p.shots - p.goals
                const pct   = svPct(p.shots, p.goals)
                return (
                  <div key={period} style={{
                    background: 'var(--rr-warm)', border: 'var(--rr-outline-sm)',
                    borderRadius: 'var(--rr-radius-sm)', boxShadow: 'var(--rr-shadow-sm)',
                    padding: '10px 12px', marginBottom: 8,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 14, color: 'var(--rr-navy)' }}>
                        {period} PERIOD
                      </span>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 11, color: 'rgba(13,42,74,0.4)' }}>
                        SV% {pct}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                      {/* Shots */}
                      <div style={{ textAlign: 'center' }}>
                        <div className="label" style={{ color: 'rgba(13,42,74,0.45)', marginBottom: 4 }}>SHOTS</div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                          <button onClick={() => adjustPeriodStat(period, 'shots', -1, true)}
                            style={{ width: 26, height: 26, border: 'var(--rr-outline-sm)', borderRadius: 6, background: 'var(--rr-ice)', fontWeight: 800, fontSize: 14, cursor: 'pointer', color: 'var(--rr-navy)', fontFamily: 'var(--font-display)' }}>−</button>
                          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 20, color: 'var(--rr-navy)', minWidth: 24, textAlign: 'center' }}>{p.shots}</span>
                          <button onClick={() => adjustPeriodStat(period, 'shots', 1)}
                            style={{ width: 26, height: 26, border: 'none', borderRadius: 6, background: 'var(--rr-red)', fontWeight: 800, fontSize: 14, cursor: 'pointer', color: 'white', fontFamily: 'var(--font-display)', boxShadow: '0 2px 0 #8b0a1f' }}>+</button>
                        </div>
                      </div>
                      {/* GA */}
                      <div style={{ textAlign: 'center' }}>
                        <div className="label" style={{ color: 'rgba(13,42,74,0.45)', marginBottom: 4 }}>GA</div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                          <button onClick={() => adjustPeriodStat(period, 'goals', -1, true)}
                            style={{ width: 26, height: 26, border: 'var(--rr-outline-sm)', borderRadius: 6, background: 'var(--rr-ice)', fontWeight: 800, fontSize: 14, cursor: 'pointer', color: 'var(--rr-navy)', fontFamily: 'var(--font-display)' }}>−</button>
                          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 20, color: p.goals > 0 ? 'var(--rr-red)' : 'var(--rr-navy)', minWidth: 24, textAlign: 'center' }}>{p.goals}</span>
                          <button onClick={() => adjustPeriodStat(period, 'goals', 1, true)}
                            style={{ width: 26, height: 26, border: 'none', borderRadius: 6, background: 'var(--rr-navy)', fontWeight: 800, fontSize: 14, cursor: 'pointer', color: 'white', fontFamily: 'var(--font-display)', boxShadow: '0 2px 0 #05101e' }}>+</button>
                        </div>
                      </div>
                      {/* Saves */}
                      <div style={{ textAlign: 'center' }}>
                        <div className="label" style={{ color: 'rgba(13,42,74,0.45)', marginBottom: 4 }}>SAVES</div>
                        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 20, color: 'var(--rr-green)' }}>{Math.max(0, saves)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Totals row */}
              <div style={{ background: 'var(--rr-navy)', borderRadius: 'var(--rr-radius-sm)', padding: '10px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4 }}>
                {[
                  { label: 'SHOTS',  val: totalShots },
                  { label: 'GA',     val: totalGoals },
                  { label: 'SAVES',  val: totalSaves },
                  { label: 'SV%',    val: overallSvPct },
                ].map(({ label, val }) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 8, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.5px', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 16, color: 'white' }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Special Teams ── */}
            <div className="clay-card" style={{ padding: '14px', marginBottom: 10 }}>
              <div className="label" style={{ color: 'rgba(13,42,74,0.5)', marginBottom: 10 }}>SPECIAL TEAMS</div>

              {[
                { label: 'PENALTY KILL', shots: 'pk_shots', saves: 'pk_saves', goals: 'pk_goals' },
                { label: 'SHORTHANDED',  shots: 'sh_shots', saves: 'sh_saves', goals: 'sh_goals' },
              ].map(({ label, shots: sf, saves: sv, goals: gf }) => (
                <div key={label} style={{ background: 'var(--rr-warm)', border: 'var(--rr-outline-sm)', borderRadius: 'var(--rr-radius-sm)', boxShadow: 'var(--rr-shadow-sm)', padding: '10px 12px', marginBottom: 8 }}>
                  <div className="label" style={{ marginBottom: 8, color: 'var(--rr-navy)' }}>{label}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    {[
                      { label: 'SHOTS', field: sf as keyof GameData },
                      { label: 'SAVES', field: sv as keyof GameData },
                      { label: 'GA',    field: gf as keyof GameData },
                    ].map(({ label: fl, field }) => (
                      <div key={fl} style={{ textAlign: 'center' }}>
                        <div className="label" style={{ color: 'rgba(13,42,74,0.45)', marginBottom: 4 }}>{fl}</div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                          <button onClick={() => adjustField(field, -1)}
                            style={{ width: 26, height: 26, border: 'var(--rr-outline-sm)', borderRadius: 6, background: 'var(--rr-ice)', fontWeight: 800, fontSize: 14, cursor: 'pointer', color: 'var(--rr-navy)', fontFamily: 'var(--font-display)' }}>−</button>
                          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 18, minWidth: 22, textAlign: 'center', color: 'var(--rr-navy)' }}>{game[field] as number}</span>
                          <button onClick={() => adjustField(field, 1)}
                            style={{ width: 26, height: 26, border: 'none', borderRadius: 6, background: 'var(--rr-navy)', fontWeight: 800, fontSize: 14, cursor: 'pointer', color: 'white', fontFamily: 'var(--font-display)', boxShadow: '0 2px 0 #05101e' }}>+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            SHOT MAP TAB
        ══════════════════════════════════════════════════════════════════════ */}
        {tab === 'map' && (
          <div style={{ padding: '12px 12px 24px' }}>
            {/* Period filter */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              {(['all', ...PERIODS] as const).map((f) => (
                <button key={f} onClick={() => setMapFilter(f as Period | 'all')}
                  style={{
                    fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 11,
                    padding: '6px 12px', borderRadius: 'var(--rr-radius-pill)',
                    border: mapFilter === f ? 'none' : 'var(--rr-outline-sm)',
                    background: mapFilter === f ? 'var(--rr-navy)' : 'var(--rr-warm)',
                    color: mapFilter === f ? 'white' : 'var(--rr-navy)',
                    cursor: 'pointer',
                    boxShadow: mapFilter === f ? 'var(--rr-shadow-sm)' : 'none',
                  }}>
                  {f === 'all' ? 'ALL' : f.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Rink */}
            <div className="clay-card" style={{ padding: 10, marginBottom: 12 }}>
              <RinkSVG
                shots={filteredShots}
                onShotTap={(shot) => setShotDetail(shot)}
              />
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 12 }}>
              {[['#3BB273', 'Save'], ['#C8102E', 'Goal'], ['rgba(13,42,74,0.5)', 'Miss']].map(([color, label]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: color, border: '1.5px solid white', boxShadow: 'var(--rr-shadow-sm)' }} />
                  <span className="label" style={{ color: 'rgba(13,42,74,0.6)' }}>{label}</span>
                </div>
              ))}
            </div>

            {/* Shot count summary */}
            <div className="clay-card-sm" style={{ padding: '10px 14px', textAlign: 'center' }}>
              <span className="body-sm" style={{ color: 'rgba(13,42,74,0.6)' }}>
                {filteredShots.length} shot{filteredShots.length !== 1 ? 's' : ''} shown
                {mapFilter !== 'all' ? ` — ${mapFilter}` : ''}
                {' · '}
                <span style={{ color: '#3BB273', fontWeight: 700 }}>{filteredShots.filter(s => s.result === 'save').length} saves</span>
                {' · '}
                <span style={{ color: '#C8102E', fontWeight: 700 }}>{filteredShots.filter(s => s.result === 'goal').length} goals</span>
              </span>
            </div>
          </div>
        )}
      </main>

      <BottomBanner />

      {/* ══════════════════════════════════════════════════════════════════════
          SHOT PLACEMENT MODAL (Option B)
      ══════════════════════════════════════════════════════════════════════ */}
      {placing && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(13,42,74,0.8)',
            zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
          onClick={() => setPlacing(false)}
        >
          <div
            style={{
              width: '100%', maxWidth: 380, background: 'var(--rr-warm)',
              border: 'var(--rr-outline)', borderRadius: 'var(--rr-radius)',
              boxShadow: 'var(--rr-shadow-lg)', padding: '16px 16px 20px',
              maxHeight: '90dvh', overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div className="display-sm">Place the shot</div>
                <div className="body-xs" style={{ color: 'rgba(13,42,74,0.5)', marginTop: 2 }}>
                  {pendingPeriod} period
                </div>
              </div>
              <button onClick={() => setPlacing(false)}
                style={{ background: 'none', border: 'var(--rr-outline-sm)', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', fontSize: 14, color: 'var(--rr-navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)' }}>
                ✕
              </button>
            </div>

            {/* Step indicators */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {[
                { num: 1, label: 'Tap location', done: !!pendingPos },
                { num: 2, label: 'Shot type',   done: !!pendingType },
                { num: 3, label: 'Result',       done: !!pendingResult },
              ].map(({ num, label, done }) => (
                <div key={num} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', margin: '0 auto 3px',
                    background: done ? 'var(--rr-green)' : (!pendingPos && num === 1) || (pendingPos && !pendingType && num === 2) || (pendingType && !pendingResult && num === 3) ? 'var(--rr-red)' : 'var(--rr-ice)',
                    border: 'var(--rr-outline-sm)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 10,
                    color: done ? 'white' : 'var(--rr-navy)',
                  }}>
                    {done ? '✓' : num}
                  </div>
                  <div style={{ fontSize: 8, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'rgba(13,42,74,0.5)' }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Rink (interactive) */}
            <div style={{
              border: pendingPos ? '2px solid var(--rr-green)' : '2px dashed rgba(13,42,74,0.2)',
              borderRadius: 'var(--rr-radius-sm)', overflow: 'hidden', marginBottom: 12,
              background: pendingPos ? 'rgba(59,178,115,0.04)' : 'rgba(13,42,74,0.02)',
            }}>
              {!pendingPos && (
                <div style={{ textAlign: 'center', padding: '8px 0 2px', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, color: 'rgba(13,42,74,0.45)' }}>
                  TAP THE ICE TO MARK THE SHOT LOCATION
                </div>
              )}
              <RinkSVG
                shots={[]}
                pendingPos={pendingPos}
                onTap={(x, y) => setPendingPos({ x, y })}
                interactive
              />
            </div>

            {/* Shot type */}
            {pendingPos && (
              <div style={{ marginBottom: 12 }}>
                <div className="label" style={{ color: 'rgba(13,42,74,0.5)', marginBottom: 8 }}>SHOT TYPE</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  {(['wrist', 'slap', 'backhand', 'tip'] as ShotType[]).map((type) => (
                    <button key={type} onClick={() => setPendingType(type)} style={{
                      padding: '8px 4px', border: pendingType === type ? 'none' : 'var(--rr-outline-sm)',
                      borderRadius: 'var(--rr-radius-sm)',
                      background: pendingType === type ? 'var(--rr-navy)' : 'var(--rr-warm)',
                      color: pendingType === type ? 'white' : 'var(--rr-navy)',
                      fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 10,
                      cursor: 'pointer', textTransform: 'uppercase',
                      boxShadow: pendingType === type ? 'var(--rr-shadow-sm)' : 'none',
                    }}>
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Result */}
            {pendingPos && pendingType && (
              <div style={{ marginBottom: 14 }}>
                <div className="label" style={{ color: 'rgba(13,42,74,0.5)', marginBottom: 8 }}>RESULT</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {[
                    { value: 'save' as ShotResult,  label: '✓ Save', bg: '#3BB273' },
                    { value: 'goal' as ShotResult,  label: '🚨 Goal', bg: '#C8102E' },
                    { value: 'miss' as ShotResult,  label: '✗ Miss', bg: 'rgba(13,42,74,0.6)' },
                  ].map(({ value, label, bg }) => (
                    <button key={value} onClick={() => setPendingResult(value)} style={{
                      padding: '10px 6px', border: 'none',
                      borderRadius: 'var(--rr-radius-sm)',
                      background: pendingResult === value ? bg : 'rgba(13,42,74,0.08)',
                      color: pendingResult === value ? 'white' : 'var(--rr-navy)',
                      fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 12,
                      cursor: 'pointer',
                      opacity: pendingResult && pendingResult !== value ? 0.5 : 1,
                      boxShadow: pendingResult === value ? 'var(--rr-shadow-sm)' : 'none',
                    }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Confirm */}
            <button
              onClick={confirmShot}
              disabled={!pendingPos || !pendingType || !pendingResult}
              className="clay-btn clay-btn-primary"
              style={{ width: '100%', fontSize: 15, padding: '12px', opacity: (!pendingPos || !pendingType || !pendingResult) ? 0.4 : 1 }}
            >
              Add Shot
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SHOT DETAIL MODAL (tap a dot to see / delete)
      ══════════════════════════════════════════════════════════════════════ */}
      {shotDetail && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(13,42,74,0.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setShotDetail(null)}
        >
          <div
            style={{ width: '100%', maxWidth: 300, background: 'var(--rr-warm)', border: 'var(--rr-outline)', borderRadius: 'var(--rr-radius)', boxShadow: 'var(--rr-shadow-lg)', padding: '20px 16px', textAlign: 'center' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 36, marginBottom: 8 }}>
              {shotDetail.result === 'save' ? '🧤' : shotDetail.result === 'goal' ? '🚨' : '💨'}
            </div>
            <div className="display-md" style={{ marginBottom: 4 }}>
              {shotDetail.result.charAt(0).toUpperCase() + shotDetail.result.slice(1)}
            </div>
            <div className="body-sm" style={{ color: 'rgba(13,42,74,0.55)', marginBottom: 16 }}>
              {shotDetail.shot_type.charAt(0).toUpperCase() + shotDetail.shot_type.slice(1)} shot · {shotDetail.period} period
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShotDetail(null)} className="clay-btn clay-btn-secondary" style={{ flex: 1 }}>Close</button>
              <button onClick={() => deleteShot(shotDetail)} className="clay-btn clay-btn-primary" style={{ flex: 1 }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
