'use client'

import { useState, useEffect } from 'react'

const ROTATING_WORDS = ['NAME', 'CITY', 'STATE']

interface AnimatedSearchPlaceholderProps {
  visible: boolean
}

export function AnimatedSearchPlaceholder(props: AnimatedSearchPlaceholderProps) {
  const [index, setIndex] = useState(0)
  const [animKey, setAnimKey] = useState(0)

  useEffect(function() {
    if (!props.visible) return

    const interval = setInterval(function() {
      setIndex(function(prev) { return (prev + 1) % ROTATING_WORDS.length })
      setAnimKey(function(prev) { return prev + 1 })
    }, 2500)

    return function() { clearInterval(interval) }
  }, [props.visible])

  if (!props.visible) {
    return null
  }

  return (
    <div className="animated-placeholder">
      <span className="animated-placeholder-label">SEARCH FOR A RINK BY... </span>
      <span key={animKey} className="animated-placeholder-word">
        {ROTATING_WORDS[index]}
      </span>

      <style jsx>{`
        .animated-placeholder {
          position: absolute;
          left: 38px;
          top: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          pointer-events: none;
          overflow: hidden;
          font-size: 13px;
          font-family: var(--font-body);
        }
        .animated-placeholder-label {
          color: rgba(13,42,74,0.45);
          font-weight: 700;
          white-space: nowrap;
        }
        .animated-placeholder-word {
          color: var(--rr-navy);
          font-weight: 800;
          font-family: var(--font-display);
          white-space: nowrap;
          display: inline-block;
          animation: slideDownBounce 0.7s linear;
        }
        @keyframes slideDownBounce {
          0% {
            transform: translateY(-100%);
            opacity: 0;
          }
          15% {
            transform: translateY(0);
            opacity: 1;
          }
          35% {
            transform: translateY(-8px);
          }
          55% {
            transform: translateY(0);
          }
          70% {
            transform: translateY(-3px);
          }
          85% {
            transform: translateY(0);
          }
          100% {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
