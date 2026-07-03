'use client'
import { useEffect } from 'react'

export default function WhatsTheCallPage() {
  useEffect(function() {
    window.location.href = '/games/whats-the-call.html'
  }, [])

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#14203f', color: '#fff', fontFamily: 'sans-serif' }}>
      Loading...
    </div>
  )
}