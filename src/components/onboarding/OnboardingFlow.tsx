'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { OnboardingModal } from '@/components/onboarding/OnboardingModal'
import { AuthModal } from '@/components/auth/AuthModal'

const ONBOARDING_KEY = 'rinkrater_onboarding_seen'

export function OnboardingFlow() {
  const [onboardingOpen, setOnboardingOpen] = useState(false)
  const [showAuth, setShowAuth]             = useState(false)
  const [userId, setUserId]                 = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    async function checkOnboarding() {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        setUserId(user.id)

        const { data: profile } = await supabase
          .from('profiles')
          .select('has_seen_onboarding')
          .eq('id', user.id)
          .single()

        if (!cancelled && !profile?.has_seen_onboarding) {
          setOnboardingOpen(true)
        }
        return
      }

      // Anonymous visitor: fall back to localStorage
      const hasSeenOnboarding = localStorage.getItem(ONBOARDING_KEY)
      if (!cancelled && !hasSeenOnboarding) {
        setOnboardingOpen(true)
      }
    }

    checkOnboarding()
    return () => { cancelled = true }
  }, [])

  async function markSeenAndClose() {
    localStorage.setItem(ONBOARDING_KEY, 'true')

    if (userId) {
      // Fire-and-forget — same client-side pattern AuthModal already uses
      await supabase
        .from('profiles')
        .update({ has_seen_onboarding: true })
        .eq('id', userId)
    }

    setOnboardingOpen(false)
    router.push('/')
  }

  function handleCreateAccount() {
    setOnboardingOpen(false)
    setShowAuth(true)
    // AuthModal's own signup insert sets has_seen_onboarding: true directly
    // via cameFromOnboarding once signup completes — that's the source of
    // truth for the new account. We still set localStorage so a guest who
    // abandons the signup form doesn't see onboarding again on refresh.
    localStorage.setItem(ONBOARDING_KEY, 'true')
  }

  return (
    <>
      <OnboardingModal
        isOpen={onboardingOpen}
        onDismiss={markSeenAndClose}
        onCreateAccount={handleCreateAccount}
      />
      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          defaultTab="signup"
          cameFromOnboarding={true}
        />
      )}
    </>
  )
}
