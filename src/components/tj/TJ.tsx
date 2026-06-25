'use client'

const RIVE_READY = false
const USE_REAL_IMAGE = true

export type TJState =
  | 'idle'
  | 'searching'
  | 'thinking'
  | 'answering'
  | 'celebrate'
  | 'nudge'
  | 'cold'

interface TJProps {
  state?: TJState
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  crop?: 'full' | 'face'
}

const SIZE_MAP = {
  sm: 44,
  md: 52,
  lg: 80,
  xl: 160,
}

export function TJ(props: TJProps) {
  const state = props.state || 'idle'
  const size = props.size || 'md'
  const className = props.className || ''
  const crop = props.crop || 'full'
  const px = SIZE_MAP[size]

  if (USE_REAL_IMAGE) {
    return (
      <TJImage
        width={px}
        height={Math.round(px * 1.25)}
        crop={crop}
        className={className}
        state={state}
      />
    )
  }

  return (
    <TJStatic
      state={state}
      width={px}
      height={Math.round(px * 1.25)}
      className={className}
    />
  )
}

function TJImage(props: {
  width: number
  height: number
  crop: 'full' | 'face'
  className: string
  state: TJState
}) {
  const src = props.crop === 'face' ? '/tj/tj-face.png' : '/tj/tj-fullpose.png'

  return (
    <div
      className={props.className}
      style={{
        width: props.width,
        height: props.height,
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
        borderRadius: props.crop === 'face' ? '50%' : 0,
      }}
      aria-label={'TJ mascot - ' + props.state}
      role="img"
    >
      <img
        src={src}
        alt="TJ mascot"
        style={{
          width: '100%',
          height: '100%',
          objectFit: props.crop === 'face' ? 'cover' : 'contain',
          objectPosition: 'center',
        }}
      />
    </div>
  )
}

function TJStatic({
  state,
  width,
  height,
  className,
}: {
  state: TJState
  width: number
  height: number
  className: string
}) {
  const mouthPath = getMouthPath(state)
  const eyeStyle  = getEyeStyle(state)
  const bodyColor = state === 'cold' ? '#5B9BD5' : '#C8102E'

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 64 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label={'TJ mascot - ' + state}
      role="img"
    >
      <ellipse cx="32" cy="76" rx="18" ry="4" fill={bodyColor} opacity="0.15" />
      <rect x="18" y="40" width="28" height="32" rx="7" fill={bodyColor} />
      <rect x="4"  y="46" width="16" height="8" rx="4" fill={bodyColor} />
      <rect x="44" y="46" width="16" height="8" rx="4" fill={bodyColor} />
      <rect x="2"  y="48" width="9" height="7" rx="3" fill="#1a1a1a" />
      <rect x="53" y="48" width="9" height="7" rx="3" fill="#1a1a1a" />
      <rect x="27" y="34" width="10" height="8" rx="2" fill="#F5CBA7" />
      <circle cx="32" cy="24" r="16" fill="#F5CBA7" />
      <rect x="16" y="12" width="32" height="16" rx="8" fill="#1a1a1a" />
      <rect x="16" y="20" width="32" height="8" rx="2" fill="#1a1a1a" opacity="0.5" />
      <rect x="12" y="16" width="6" height="14" rx="3" fill="#C0C0C0" />
      <rect x="46" y="16" width="6" height="14" rx="3" fill="#C0C0C0" />
      <circle cx="26" cy="25" r={eyeStyle.r} fill="#1a1a1a" />
      <circle cx="38" cy="25" r={eyeStyle.r} fill="#1a1a1a" />
      {eyeStyle.shine && (
        <>
          <circle cx="27.5" cy="23.5" r="1" fill="#fff" opacity="0.7" />
          <circle cx="39.5" cy="23.5" r="1" fill="#fff" opacity="0.7" />
        </>
      )}
      <path d={mouthPath} stroke="#C0392B" strokeWidth="2" strokeLinecap="round" fill="none" />
      <rect x="21" y="70" width="9"  height="9"  rx="2.5" fill="#1a1a1a" />
      <rect x="34" y="70" width="9"  height="9"  rx="2.5" fill="#1a1a1a" />
      <rect x="17" y="77" width="16" height="4"  rx="2"  fill="#C0C0C0" />
      <rect x="31" y="77" width="16" height="4"  rx="2"  fill="#C0C0C0" />
      {state === 'celebrate' && <CelebrationElements />}
      {state === 'nudge'     && <NudgeArm />}
      {state === 'cold'      && <ColdLines />}
      {state === 'thinking'  && <ThinkingDots />}
      {state !== 'cold' && state !== 'thinking' && (
        <>
          <rect
            x="52" y="20" width="5" height="40"
            rx="2.5" fill="#8B4513"
            transform="rotate(-15 54 40)"
          />
          <ellipse
            cx="44" cy="12" rx="7" ry="5"
            fill="#1a1a1a"
            transform="rotate(-15 44 12)"
          />
        </>
      )}
    </svg>
  )
}

function getMouthPath(state: TJState): string {
  switch (state) {
    case 'idle':      return 'M26 31 Q32 35 38 31'
    case 'searching': return 'M26 30 Q32 36 38 30'
    case 'thinking':  return 'M28 32 Q32 31 36 32'
    case 'answering': return 'M25 30 Q32 37 39 30'
    case 'celebrate': return 'M24 29 Q32 38 40 29'
    case 'nudge':     return 'M26 31 Q32 35 38 31'
    case 'cold':      return 'M27 32 Q32 30 37 32'
    default:          return 'M26 31 Q32 35 38 31'
  }
}

function getEyeStyle(state: TJState): { r: number; shine: boolean } {
  switch (state) {
    case 'celebrate': return { r: 3, shine: true }
    case 'thinking':  return { r: 2, shine: false }
    case 'cold':      return { r: 1.5, shine: false }
    default:          return { r: 2.5, shine: true }
  }
}

function CelebrationElements() {
  return (
    <>
      <text x="8"  y="16" fontSize="8" fill="#FFD23F">★</text>
      <text x="50" y="12" fontSize="6" fill="#FFD23F">★</text>
      <text x="4"  y="30" fontSize="5" fill="#FFD23F">✦</text>
    </>
  )
}

function NudgeArm() {
  return (
    <rect
      x="44" y="44" width="20" height="7"
      rx="3.5" fill="#C8102E"
      transform="rotate(-20 44 48)"
    />
  )
}

function ColdLines() {
  return (
    <>
      <line x1="8"  y1="36" x2="12" y2="40" stroke="#D6EFFA" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      <line x1="52" y1="36" x2="56" y2="40" stroke="#D6EFFA" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
    </>
  )
}

function ThinkingDots() {
  return (
    <>
      <circle cx="22" cy="6" r="2.5" fill="#0D2A4A" opacity="0.3" />
      <circle cx="32" cy="4" r="2.5" fill="#0D2A4A" opacity="0.5" />
      <circle cx="42" cy="6" r="2.5" fill="#0D2A4A" opacity="0.7" />
    </>
  )
}

interface TJSpeechProps {
  children: React.ReactNode
  state?: TJState
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function TJSpeech(props: TJSpeechProps) {
  const state = props.state || 'idle'
  const size = props.size || 'md'
  const className = props.className || ''

  return (
    <div
      style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}
      className={className}
    >
      <TJ state={state} size={size === 'lg' ? 'md' : 'sm'} crop="face" />
      <div
        style={{
          background: 'var(--rr-warm)',
          border: 'var(--rr-outline)',
          borderRadius: '12px 12px 12px 2px',
          padding: '9px 13px',
          fontSize: 12,
          lineHeight: 1.55,
          color: 'var(--rr-navy)',
          boxShadow: 'var(--rr-shadow)',
          maxWidth: 220,
          flex: 1,
        }}
      >
        {props.children}
      </div>
    </div>
  )
}
