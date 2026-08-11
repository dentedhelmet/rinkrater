'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { OnboardingModal } from '@/components/onboarding/OnboardingModal'
import { AuthModal } from '@/components/auth/AuthModal'

const ONBOARDING_KEY = 'rinkrater_onboarding_seen'

export function OnboardingFlow() {
  // IMPORTANT: this used to run its own independent supabase.auth.getUser()
  // call on mount, separate from AuthContext's own session check. That meant
  // it could resolve BEFORE the real session had finished hydrating — landing
  // in the "anonymous visitor" branch, then finally re-checking later and
  // popping the modal open whenever that resolved, wherever the person
  // happened to have already navigated to by then. Tying this to the SAME
  // shared auth state the rest of the app already waits on (useAuth's
  // `loading` flag) removes that race — this now only evaluates once we
  // know for certain whether there's a signed-in user.
  const { user, loading: authLoading } = useAuth()

  const [onboardingOpen, setOnboardingOpen] = useState(false)
  const [showAuth, setShowAuth]             = useState(false)
  const [checked, setChecked]               = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (authLoading || checked) return
    let cancelled = false

    async function checkOnboarding() {
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('has_seen_onboarding')
          .eq('id', user.id)
          .single()
        if (!cancelled && !profile?.has_seen_onboarding) {
          setOnboardingOpen(true)
        }
        if (!cancelled) setChecked(true)
        return
      }
      // Anonymous visitor: fall back to localStorage
      const hasSeenOnboarding = localStorage.getItem(ONBOARDING_KEY)
      if (!cancelled && !hasSeenOnboarding) {
        setOnboardingOpen(true)
      }
      if (!cancelled) setChecked(true)
    }

    checkOnboarding()
    return () => { cancelled = true }
  }, [authLoading, user, checked])

  async function markSeenAndClose() {
    localStorage.setItem(ONBOARDING_KEY, 'true')
    if (user) {
      await supabase.from('profiles').update({ has_seen_onboarding: true }).eq('id', user.id)
    }
    setOnboardingOpen(false)
    router.push('/')
  }

  async function markSeenAndGoToProfile() {
    localStorage.setItem(ONBOARDING_KEY, 'true')
    if (user) {
      await supabase.from('profiles').update({ has_seen_onboarding: true }).eq('id', user.id)
    }
    setOnboardingOpen(false)
    router.push('/profile/edit')
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
        isLoggedIn={!!user}
        onGoToProfile={markSeenAndGoToProfile}
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
