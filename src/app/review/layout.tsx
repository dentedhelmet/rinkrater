import type { Metadata } from 'next'

export const metadata: Metadata = { title: "Leave a Review" }

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
