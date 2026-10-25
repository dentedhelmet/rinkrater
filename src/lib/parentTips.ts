/**
 * Parent Tips ("From the Rink Family") — shared categories, limits and types.
 * The category keys must match the check constraint in supabase/parent_tips.sql.
 */

export type TipCategory = 'nutrition' | 'workouts' | 'skills' | 'camps' | 'gear' | 'rink_life'

export interface TipCategoryInfo {
  id:     TipCategory
  label:  string
  /** Emoji fallback, used if the image file can't load. */
  icon:   string
  /** Round 280×280 badge in public/tip-icons/ */
  iconSrc: string
  /** Shown under the category in the share form to nudge good tips. */
  prompt: string
}

export const TIP_CATEGORIES: TipCategoryInfo[] = [
  { id: 'nutrition', label: 'Nutrition', icon: '🍎', iconSrc: '/tip-icons/rr-tip-nutrition_icon.png', prompt: 'Game-day snacks, rink-friendly meals, staying hydrated' },
  { id: 'workouts',  label: 'Workouts',  icon: '💪', iconSrc: '/tip-icons/rr-tip-workouts_icon.png', prompt: 'Off-ice fun that builds strength, balance and stamina' },
  { id: 'skills',    label: 'Skills',    icon: '🏒', iconSrc: '/tip-icons/rr-tip-skills_icon.png', prompt: 'Driveway drills, stickhandling, skating practice at home' },
  { id: 'camps',     label: 'Camps',     icon: '⛺', iconSrc: '/tip-icons/rr-tip-camps_icon.png', prompt: 'Camps and clinics your family loved, and what to pack' },
  { id: 'gear',      label: 'Gear',      icon: '🎒', iconSrc: '/tip-icons/rr-tip-gear_icon.png', prompt: 'Must-haves for the bag, sizing lessons, keeping gear fresh' },
  { id: 'rink_life', label: 'Rink Life', icon: '🧊', iconSrc: '/tip-icons/rr-tip-rinklife_icon.png', prompt: 'Early mornings, carpools, tournament weekends, staying warm' },
]

export const TIP_CATEGORY_MAP: Record<TipCategory, TipCategoryInfo> = Object.fromEntries(
  TIP_CATEGORIES.map((c) => [c.id, c])
) as Record<TipCategory, TipCategoryInfo>

export const isTipCategory = (v: unknown): v is TipCategory =>
  typeof v === 'string' && TIP_CATEGORIES.some((c) => c.id === v)

export const TIP_LIMITS = {
  titleMin: 3,
  titleMax: 80,
  bodyMin:  20,
  bodyMax:  600,
  maxPendingPerUser: 5,
} as const

/** Instagram usernames: letters, numbers, periods, underscores, up to 30. */
export const INSTAGRAM_HANDLE_RE = /^[A-Za-z0-9._]{1,30}$/

export function cleanInstagramHandle(raw: string): string {
  return raw.trim().replace(/^@+/, '')
}

export interface PublicTip {
  id:           string
  category:     TipCategory
  title:        string
  body:         string
  author:       string
  published_at: string | null
}
