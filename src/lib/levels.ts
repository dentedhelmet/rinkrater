export interface Level {
  level:    number
  title:    string
  xpStart:  number
  xpEnd:    number
}

export const LEVELS: Level[] = [
  { level: 1, title: 'Rookie',       xpStart: 0,    xpEnd: 499  },
  { level: 2, title: 'Regular',      xpStart: 500,  xpEnd: 999  },
  { level: 3, title: 'Road Warrior', xpStart: 1000, xpEnd: 2499 },
  { level: 4, title: 'Scout',        xpStart: 2500, xpEnd: 4999 },
  { level: 5, title: 'Team Captain', xpStart: 5000, xpEnd: 9999 },
]

export function getLevelForXP(xp: number): Level {
  return (
    [...LEVELS].reverse().find((l) => xp >= l.xpStart) ?? LEVELS[0]
  )
}

export function getNextLevelXP(xp: number): number {
  const current = getLevelForXP(xp)
  return current.xpEnd + 1
}
