import type { AdminRole } from '@/lib/useAdminRole'

/**
 * The Admin Dashboard's table of contents.
 *
 * To add a feature: build its page under src/app/admin/<id>/page.tsx,
 * then add (or flip to 'live') one entry here. The hub, role filtering and
 * card animations all pick it up automatically.
 */
export interface AdminSection {
  id:          string
  title:       string
  description: string
  icon:        string          // emoji for now — swap for custom art any time
  href:        string
  roles:       AdminRole[]     // who sees this card
  status:      'live' | 'soon'
  badge?:      'pending'       // shows a live count from admin_dashboard_stats
}

export const ADMIN_SECTIONS: AdminSection[] = [
  {
    id:          'reviews',
    title:       'Review Moderation',
    description: 'Approve, reject, remove or restore reviews',
    icon:        '🛡️',
    href:        '/admin/reviews',
    roles:       ['super_admin', 'moderator'],
    status:      'live',
    badge:       'pending',
  },
  {
    id:          'rink-suggestions',
    title:       'Rink Suggestions',
    description: 'New rinks and edits sent in by families',
    icon:        '🏒',
    href:        '/admin/rink-suggestions',
    roles:       ['super_admin'],
    status:      'live',
  },
  {
    id:          'shop',
    title:       'Shop',
    description: 'Manage shop listings',
    icon:        '🛒',
    href:        '/admin/shop',
    roles:       ['super_admin'],
    status:      'live',
  },
  {
    id:          'users',
    title:       'User Lookup',
    description: 'Reviews, XP and badges for any user — plus bans',
    icon:        '🔎',
    href:        '/admin/users',
    roles:       ['super_admin', 'moderator'],
    status:      'live',
  },
  {
    id:          'blog',
    title:       'Blog',
    description: 'Write, schedule and publish blog posts',
    icon:        '📰',
    href:        '/admin/blog',
    roles:       ['super_admin', 'moderator'],
    status:      'live',
  },
  {
    id:          'partners',
    title:       'Partners',
    description: 'Edit the public Partners page',
    icon:        '🤝',
    href:        '/admin/partners',
    roles:       ['super_admin', 'partner_manager'],
    status:      'live',
  },
  {
    id:          'live',
    title:       'Live Visitors',
    description: 'Who is on Rink Rater right now',
    icon:        '📡',
    href:        '/admin/live',
    roles:       ['super_admin'],
    status:      'live',
  },
  {
    id:          'admins',
    title:       'Admin Team',
    description: 'Add admins and set their roles',
    icon:        '🧑‍✈️',
    href:        '/admin/team',
    roles:       ['super_admin'],
    status:      'live',
  },
]

export const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin:     'Super Admin',
  moderator:       'Moderator',
  partner_manager: 'Partner Manager',
}
