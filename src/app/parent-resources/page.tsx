import type { Metadata } from 'next'
import ParentResourcesClient from './ParentResourcesClient'

export const metadata: Metadata = {
  title: 'Hockey Parent Resources',
  description:
    "New to hockey? TJ's Mom walks first-time hockey parents through trying it, signing up, gearing up and staying safe, with links to USA Hockey's official parent resources.",
  alternates: { canonical: 'https://rinkrater.com/parent-resources' },
  openGraph: {
    title: 'Hockey Parent Resources — Rink Rater',
    description:
      "A rookie hockey parent's game plan from TJ's Mom, with links to USA Hockey's official parent resources.",
    url: 'https://rinkrater.com/parent-resources',
    siteName: 'Rink Rater',
    type: 'website',
  },
}

export default function ParentResourcesPage() {
  return <ParentResourcesClient />
}
