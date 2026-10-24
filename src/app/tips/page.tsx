import type { Metadata } from 'next'
import TipsBoardClient from './TipsBoardClient'

export const metadata: Metadata = {
  title: 'Parent Tips',
  description:
    'Tips from hockey parents, for hockey parents: nutrition, off-ice workouts, skills, camps, gear and rink life. Share what worked for your family.',
  alternates: { canonical: 'https://rinkrater.com/tips' },
  openGraph: {
    title: 'Parent Tips — Rink Rater',
    description: 'Tips from hockey parents, for hockey parents. Share what worked for your family.',
    url: 'https://rinkrater.com/tips',
    siteName: 'Rink Rater',
    type: 'website',
  },
}

export default function TipsPage() {
  return <TipsBoardClient />
}
