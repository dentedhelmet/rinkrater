'use client'

import { useState } from 'react'

interface LocationState {
  lat: number | null
  lng: number | null
  status: 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported'
  error: string | null
}

export function useLocation() {
  const [state, setState] = useState<LocationState>({
    lat: null,
    lng: null,
    status: 'idle',
    error: null,
  })

  function requestLocation() {
    if (!navigator.geolocation) {
      setState(s => ({ ...s, status: 'unsupported', error: 'Location is not supported in this browser.' }))
      return
    }

    setState(s => ({ ...s, status: 'requesting', error: null }))

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          status: 'granted',
          error: null,
        })
      },
      (err) => {
        setState(s => ({
          ...s,
          status: 'denied',
          error: err.code === err.PERMISSION_DENIED
            ? 'Location access was denied. You can still search by typing a rink name or city.'
            : 'Could not get your location right now.',
        }))
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    )
  }

  return { ...state, requestLocation }
}