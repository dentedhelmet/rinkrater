import type { Metadata, Viewport } from 'next'
import { Nunito } from 'next/font/google'
import { AuthProvider } from '@/context/AuthContext'
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow'
import '../styles/globals.css'
const nunito = Nunito({
  subsets:  ['latin'],
  weight:   ['400', '600', '700', '800', '900'],
  display:  'swap',
  variable: '--font-nunito',
})
export const metadata: Metadata = {
  title: 'Rink Rater — Rate where you skate',
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
            {children}
            <OnboardingFlow />
          </AuthProvider>
        </div>
      </body>
    </html>
  )
}