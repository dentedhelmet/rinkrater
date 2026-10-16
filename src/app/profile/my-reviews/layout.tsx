import type { Metadata } from 'next'

export const metadata: Metadata = { title: "My Reviews" }

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
