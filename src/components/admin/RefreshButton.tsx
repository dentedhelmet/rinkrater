'use client'

import { motion, useReducedMotion } from 'framer-motion'

/** Round refresh button whose arrow spins while data is reloading. */
export function RefreshButton({
  onClick,
  refreshing,
  label = 'Refresh',
}: {
  onClick: () => void
  refreshing: boolean
  label?: string
}) {
  const reduceMotion = useReducedMotion()

  return (
    <button
      type="button"
      className="refresh-btn"
      onClick={onClick}
      disabled={refreshing}
      aria-label={refreshing ? 'Refreshing…' : label}
      title={label}
    >
      <motion.svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        aria-hidden="true"
        animate={refreshing && !reduceMotion ? { rotate: 360 } : { rotate: 0 }}
        transition={refreshing ? { duration: 0.8, repeat: Infinity, ease: 'linear' } : { duration: 0.3 }}
      >
        <path
          d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </motion.svg>

      <style jsx>{`
        .refresh-btn {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 2px solid var(--rr-navy);
          background: #fff;
          color: var(--rr-navy);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 3px 0 rgba(13, 42, 74, 0.25);
          transition: transform 0.1s ease, box-shadow 0.1s ease;
        }
        .refresh-btn:active:not(:disabled) {
          transform: translateY(2px);
          box-shadow: 0 1px 0 rgba(13, 42, 74, 0.25);
        }
        .refresh-btn:disabled {
          cursor: progress;
        }
        .refresh-btn:focus-visible {
          outline: 3px solid var(--rr-yellow);
          outline-offset: 2px;
        }
      `}</style>
    </button>
  )
}
