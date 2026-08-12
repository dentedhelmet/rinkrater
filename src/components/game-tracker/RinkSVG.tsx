'use client'

import { useRef } from 'react'

// ─── Types ─────────────────────────────────────────────────────────────────────
export type ShotResult = 'save' | 'goal' | 'miss'
export type ShotType   = 'wrist' | 'slap' | 'backhand' | 'tip'
export type Period     = '1st' | '2nd' | '3rd' | 'OT'

export interface ShotDot {
  id:        string
  x:         number   // normalized 0–1
  y:         number   // normalized 0–1
  result:    ShotResult
  shot_type: ShotType
  period:    Period
}

interface RinkSVGProps {
  shots:        ShotDot[]
  onTap?:       (x: number, y: number) => void
  pendingPos?:  { x: number; y: number } | null
  onShotTap?:   (shot: ShotDot) => void
  interactive?: boolean
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const W = 280
const H = 370

const RESULT_COLOR: Record<ShotResult, string> = {
  save:  '#3BB273',
  goal:  '#C8102E',
  miss:  'rgba(13,42,74,0.5)',
}
const PERIOD_LABEL: Record<Period, string> = {
  '1st': '1', '2nd': '2', '3rd': '3', 'OT': 'OT',
}

// ─── Component ─────────────────────────────────────────────────────────────────
export function RinkSVG({
  shots,
  onTap,
  pendingPos,
  onShotTap,
  interactive = false,
}: RinkSVGProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  function getPos(clientX: number, clientY: number) {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    return {
      x: Math.max(0.02, Math.min(0.98, (clientX - rect.left)  / rect.width)),
      y: Math.max(0.02, Math.min(0.98, (clientY - rect.top)   / rect.height)),
    }
  }

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    if (!interactive || !onTap) return
    const pos = getPos(e.clientX, e.clientY)
    if (pos) onTap(pos.x, pos.y)
  }

  function handleTouch(e: React.TouchEvent<SVGSVGElement>) {
    if (!interactive || !onTap) return
    e.preventDefault()
    const t = e.touches[0]
    const pos = getPos(t.clientX, t.clientY)
    if (pos) onTap(pos.x, pos.y)
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      style={{
        width:              '100%',
        maxWidth:           340,
        display:            'block',
        margin:             '0 auto',
        cursor:             interactive ? 'crosshair' : 'default',
        userSelect:         'none',
        WebkitUserSelect:   'none',
        touchAction:        interactive ? 'none' : 'auto',
      }}
      onClick={handleClick}
      onTouchStart={handleTouch}
    >
      {/* ── Ice surface ── */}
      <defs>
        <clipPath id="iceClip">
          <rect x="4" y="4" width={W - 8} height={H - 8} rx="36" />
        </clipPath>
      </defs>
      <rect x="4" y="4" width={W - 8} height={H - 8}
        rx="36" fill="#E8F5FC" stroke="#0D2A4A" strokeWidth="3"/>

      {/* ── Center ice marker (top edge) ── */}
      <line x1="4" y1="24" x2={W - 4} y2="24"
        stroke="#C8102E" strokeWidth="2" strokeDasharray="10,5"/>
      <text x={W / 2} y="19" textAnchor="middle"
        fill="#C8102E" fontSize="7" fontFamily="'Nunito',sans-serif" fontWeight="700"
        style={{ pointerEvents: 'none' }}>
        CENTER ICE
      </text>

      {/* ── Center ice faceoff circle — bisected by the center-ice line, */}
      {/* clipped so it cuts off cleanly at the rink boundary rather than */}
      {/* poking above the black border. */}
      <g clipPath="url(#iceClip)">
        <circle cx={W / 2} cy="24" r="42" fill="none" stroke="#1565C0" strokeWidth="1.5"/>
        <circle cx={W / 2} cy="24" r="3.5" fill="#1565C0"/>
      </g>

      {/* ── Blue line ── */}
      <line x1="4" y1="136" x2={W - 4} y2="136"
        stroke="#1565C0" strokeWidth="4.5"/>

      {/* ── Neutral zone faceoff dots ── */}
      <circle cx="72"     cy="108" r="4" fill="#C8102E"/>
      <circle cx={W - 72} cy="108" r="4" fill="#C8102E"/>

      {/* ── Zone label ── */}
      <text x={W / 2} y="85" textAnchor="middle"
        fill="rgba(13,42,74,0.15)" fontSize="13"
        fontFamily="'Nunito',sans-serif" fontWeight="900"
        style={{ pointerEvents: 'none' }}>
        NEUTRAL ZONE
      </text>

      {/* ── Defensive zone faceoff circles ── */}
      <circle cx="72"     cy="246" r="42"
        fill="rgba(200,16,46,0.04)" stroke="#C8102E" strokeWidth="1.5"/>
      <circle cx="72"     cy="246" r="3.5" fill="#C8102E"/>
      <circle cx={W - 72} cy="246" r="42"
        fill="rgba(200,16,46,0.04)" stroke="#C8102E" strokeWidth="1.5"/>
      <circle cx={W - 72} cy="246" r="3.5" fill="#C8102E"/>

      {/* ── Faceoff circle hash marks ── */}
      {/* Outer ticks: short marks projecting straight out from the circle's
          left/right sides — matches where players line up for a faceoff. */}
      {/* Inner crosshair: small target mark around the center dot. */}
      {[72, W - 72].map((cx) => (
        <g key={cx} stroke="#C8102E" strokeWidth="1.5">
          {/* Outer ticks — left side */}
          <line x1={cx - 42} y1={236} x2={cx - 50} y2={236} />
          <line x1={cx - 42} y1={256} x2={cx - 50} y2={256} />
          {/* Outer ticks — right side */}
          <line x1={cx + 42} y1={236} x2={cx + 50} y2={236} />
          <line x1={cx + 42} y1={256} x2={cx + 50} y2={256} />
          {/* Inner crosshair around center dot */}
          <line x1={cx - 9} y1={246} x2={cx - 3} y2={246} />
          <line x1={cx + 9} y1={246} x2={cx + 3} y2={246} />
          <line x1={cx}     y1={246 - 9} x2={cx} y2={246 - 3} />
          <line x1={cx}     y1={246 + 9} x2={cx} y2={246 + 3} />
        </g>
      ))}

      {/* ── Goal line ── */}
      <line x1="8" y1="310" x2={W - 8} y2="310"
        stroke="#C8102E" strokeWidth="2.5"/>

      {/* ── Crease (rectangle + D arc) ── */}
      <rect x="108" y="298" width="64" height="12"
        fill="rgba(21,101,192,0.1)" stroke="#1565C0" strokeWidth="1.5"/>
      <path d={`M 108 298 A 52 52 0 0 1 172 298`}
        fill="rgba(21,101,192,0.1)" stroke="#1565C0" strokeWidth="1.5"/>

      {/* ── Goal / net ── */}
      <rect x="116" y="310" width="48" height="22" rx="2"
        fill="rgba(13,42,74,0.07)" stroke="#0D2A4A" strokeWidth="2"/>
      {/* Posts */}
      <line x1="116" y1="310" x2="116" y2="316" stroke="#0D2A4A" strokeWidth="3.5"/>
      <line x1="164" y1="310" x2="164" y2="316" stroke="#0D2A4A" strokeWidth="3.5"/>

      {/* ── Shot dots ── */}
      {shots.map((shot) => {
        const cx    = shot.x * W
        const cy    = shot.y * H
        const color = RESULT_COLOR[shot.result]
        const label = PERIOD_LABEL[shot.period]
        return (
          <g
            key={shot.id}
            onClick={onShotTap ? (e) => { e.stopPropagation(); onShotTap(shot) } : undefined}
            style={{ cursor: onShotTap ? 'pointer' : 'default' }}
          >
            <circle cx={cx} cy={cy} r="12"
              fill={color} opacity="0.9" stroke="white" strokeWidth="1.5"/>
            <text
              x={cx} y={cy + 0.5}
              textAnchor="middle" dominantBaseline="middle"
              fill="white" fontSize={label === 'OT' ? '6' : '8'}
              fontWeight="800" fontFamily="'Nunito',sans-serif"
              style={{ pointerEvents: 'none' }}
            >
              {label}
            </text>
          </g>
        )
      })}

      {/* ── Pending shot crosshair ── */}
      {pendingPos && (
        <>
          <circle
            cx={pendingPos.x * W} cy={pendingPos.y * H}
            r="15" fill="rgba(255,210,63,0.35)"
            stroke="#FFD23F" strokeWidth="2.5"
          />
          <line
            x1={pendingPos.x * W - 8} y1={pendingPos.y * H}
            x2={pendingPos.x * W + 8} y2={pendingPos.y * H}
            stroke="#FFD23F" strokeWidth="2"
          />
          <line
            x1={pendingPos.x * W} y1={pendingPos.y * H - 8}
            x2={pendingPos.x * W} y2={pendingPos.y * H + 8}
            stroke="#FFD23F" strokeWidth="2"
          />
        </>
      )}
    </svg>
  )
}
