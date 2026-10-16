import type { Metadata } from 'next'

export const metadata: Metadata = { title: "Game Tracker" }

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
