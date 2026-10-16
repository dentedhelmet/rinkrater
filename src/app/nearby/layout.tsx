import type { Metadata } from 'next'

export const metadata: Metadata = { title: "Rinks Near You" }

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
