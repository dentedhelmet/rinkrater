import type { Metadata, Viewport } from 'next'
import { Nunito } from 'next/font/google'
import { Suspense } from 'react'
import { GoogleAnalytics } from '@next/third-parties/google'
import { GaRouteTracker } from '@/components/analytics/GaRouteTracker'
import { AuthProvider } from '@/context/AuthContext'
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow'
import '../styles/globals.css'
import { GlobalHeader } from '@/components/layout/GlobalHeader'

// Google Analytics 4 — only loads on production builds so local dev traffic stays out of reports.
const GA_MEASUREMENT_ID = 'G-LZGG27K01P'
const isProduction = process.env.NODE_ENV === 'production'

const nunito = Nunito({
  subsets:  ['latin'],
  weight:   ['400', '600', '700', '800', '900'],
  display:  'swap',
  variable: '--font-nunito',
})
export const metadata: Metadata = {
  // Each section sets its own title (e.g. "Ask TJ"), shown as "Ask TJ — Rink Rater".
  title: {
    default:  'Rink Rater — Rate where you skate',
    template: '%s — Rink Rater',
  },
  description: 'Real reviews from real hockey families. Find out everything about any rink before you make the drive.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable:         true,
    statusBarStyle:  'black-translucent',
    title:           'Rink Rater',
  },
  icons: {
    apple: '/assets/icons/apple-touch-icon.png',
    icon:  '/assets/icons/favicon.ico',
  },
}
export const viewport: Viewport = {
  width:         'device-width',
  initialScale:  1,
  maximumScale:  1,
  userScalable:  false,
  themeColor:    '#C8102E',
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={nunito.variable}>
      <body className={nunito.className}>
        <div id="app-shell">
          <AuthProvider>
            <GlobalHeader />
            <div style={{ height: 100 }} />
            {children}
            <OnboardingFlow />
          </AuthProvider>
        </div>
        {isProduction && (
          <Suspense fallback={null}>
            <GaRouteTracker />
          </Suspense>
        )}
      </body>
      {isProduction && <GoogleAnalytics gaId={GA_MEASUREMENT_ID} />}
    </html>
  )
}
