import type { Metadata } from 'next'

export const metadata: Metadata = { title: "Ask TJ" }

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
