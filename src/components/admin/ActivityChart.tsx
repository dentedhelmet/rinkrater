'use client'

import { motion, useReducedMotion } from 'framer-motion'

export interface ActivityPoint {
  day:   string  // YYYY-MM-DD
  count: number
}

/**
 * Bar chart of reviews per day. Bars grow from the baseline on first load
 * and glide to their new heights on every refresh (refreshKey bump).
 * A visually hidden table carries the same data for screen readers.
 */
export function ActivityChart({ data, refreshKey }: { data: ActivityPoint[]; refreshKey: number }) {
  const reduceMotion = useReducedMotion()
  const max = Math.max(1, ...data.map((d) => d.count))
  const total = data.reduce((sum, d) => sum + d.count, 0)
  const todayIso = new Date().toISOString().slice(0, 10)

  const dayLabel = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' })
  const fullLabel = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

  return (
    <figure className="activity">
      <figcaption>
        <span className="activity-title">Reviews, last 14 days</span>
        <span className="activity-total">{total.toLocaleString()} total</span>
      </figcaption>

      <div className="bars" aria-hidden="true">
        {data.map((d, i) => {
          const pct = (d.count / max) * 100
          const isToday = d.day === todayIso
          return (
            <div className="bar-col" key={d.day} title={`${fullLabel(d.day)}: ${d.count}`}>
              <div className="bar-track">
                <motion.div
                  key={`${d.day}-${refreshKey}`}
                  className={`bar ${isToday ? 'bar-today' : ''}`}
                  initial={reduceMotion ? false : { height: '0%' }}
                  animate={{ height: `${Math.max(pct, d.count > 0 ? 4 : 0)}%` }}
                  transition={{ type: 'spring', stiffness: 140, damping: 18, delay: reduceMotion ? 0 : i * 0.03 }}
                />
              </div>
              <span className={`bar-label ${isToday ? 'bar-label-today' : ''}`}>{dayLabel(d.day)}</span>
            </div>
          )
        })}
      </div>

      <table className="sr-only">
        <caption>Reviews per day, last 14 days</caption>
        <thead>
          <tr><th scope="col">Day</th><th scope="col">Reviews</th></tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}><td>{fullLabel(d.day)}</td><td>{d.count}</td></tr>
          ))}
        </tbody>
      </table>

      <style jsx>{`
        .activity {
          margin: 0;
          padding: 16px;
        }
        figcaption {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 12px;
        }
        .activity-title {
          font-weight: 900;
          color: var(--rr-navy);
        }
        .activity-total {
          font-weight: 700;
          font-size: 0.85rem;
          color: rgba(13, 42, 74, 0.78);
        }
        .bars {
          display: grid;
          grid-template-columns: repeat(14, 1fr);
          gap: 6px;
          height: 140px;
          align-items: end;
        }
        .bar-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 100%;
          gap: 6px;
        }
        .bar-track {
          flex: 1;
          width: 100%;
          display: flex;
          align-items: flex-end;
          background: var(--rr-ice, #eaf4fb);
          border-radius: 6px;
          overflow: hidden;
        }
        .bar-track :global(.bar) {
          width: 100%;
          background: var(--rr-navy);
          border-radius: 6px 6px 0 0;
        }
        .bar-track :global(.bar-today) {
          background: var(--rr-red);
        }
        .bar-label {
          font-size: 0.75rem;
          font-weight: 700;
          color: rgba(13, 42, 74, 0.75);
        }
        .bar-label-today {
          color: var(--rr-red);
        }
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
      `}</style>
    </figure>
  )
}
