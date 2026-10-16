'use client'

import { useEffect, useRef, useState } from 'react'
import { animate, useReducedMotion } from 'framer-motion'

/**
 * Counts up (or down) from the last value it showed to the new one.
 * Jumps straight to the value when the user prefers reduced motion.
 */
export function AnimatedNumber({ value, duration = 0.9 }: { value: number; duration?: number }) {
  const reduceMotion = useReducedMotion()
  const [display, setDisplay] = useState(reduceMotion ? value : 0)
  const fromRef = useRef(reduceMotion ? value : 0)

  useEffect(() => {
    if (reduceMotion) {
      setDisplay(value)
      fromRef.current = value
      return
    }
    const controls = animate(fromRef.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    })
    fromRef.current = value
    return () => controls.stop()
  }, [value, duration, reduceMotion])

  return <>{display.toLocaleString()}</>
}
