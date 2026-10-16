// Badge definitions shared by the Profile page and the admin User Lookup.
// Add or change a badge here and both places update.

export interface BadgeDef {
  id:          string
  icon:        string
  label:       string
  criteria:    string
  earnedIf:    (totalReviews: number, xp: number) => boolean
  comingSoon?: boolean
}

export const BADGE_DEFS: BadgeDef[] = [
  { id: 'rink_regular',   icon: '/badges/badges-rink-regular.png',    label: 'Rink Regular',   criteria: 'Leave 1 review',      earnedIf: (r) => r >= 1  },
  { id: 'road_warrior',   icon: '/badges/badges-road-warrior.png',    label: 'Road Warrior',   criteria: 'Reach 1,000 XP',      earnedIf: (_, xp) => xp >= 1000 },
  { id: 'scout',          icon: '/badges/badges-scout.png',           label: 'Scout',          criteria: 'Leave 5 reviews',     earnedIf: (r) => r >= 5  },
  { id: 'pioneer',        icon: '/badges/badges-pioneer.png',         label: 'Pioneer',        criteria: 'Leave 10 reviews',    earnedIf: (r) => r >= 10 },
  { id: 'temp_reporter',  icon: '/badges/badges-temp-reporter.png',   label: 'Temp Reporter',  criteria: 'Leave 3 reviews',     earnedIf: (r) => r >= 3  },
  { id: 'review_50',      icon: '/badges/badges-fifty-reviews.png',   label: '50 Reviews',     criteria: 'Leave 50 reviews',    earnedIf: (r) => r >= 50 },
  { id: 'coast_to_coast', icon: '/badges/badges-five-states.png',     label: '5 States',       criteria: 'Coming soon',         earnedIf: () => false, comingSoon: true },
  { id: 'rink_rat_mom',   icon: '/badges/badges-rink-rat-mom.png',    label: 'Rink Rat Mom',   criteria: 'Coming soon',         earnedIf: () => false, comingSoon: true },
]

export function badgesFor(totalReviews: number, xp: number) {
  return BADGE_DEFS.map((b) => ({ ...b, earned: b.earnedIf(totalReviews, xp) }))
}
