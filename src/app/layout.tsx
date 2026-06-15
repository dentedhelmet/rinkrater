import type { Metadata, Viewport } from 'next'
import '../styles/globals.css'

export const metadata: Metadata = {
  title: 'Rink Rater — Rate where you skate',
  description: 'Real reviews from real hockey families. Find out everything about any rink before you make the drive.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Rink Rater',
  },
  icons: {
    apple: '/assets/icons/apple-touch-icon.png',
    icon:  '/assets/icons/favicon.ico',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#C8102E',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div id="app-shell">
          {children}
        </div>
      </body>
    </html>
  )
}
