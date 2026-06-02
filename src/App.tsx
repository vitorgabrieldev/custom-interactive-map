import { useState, useCallback, useEffect, useMemo } from 'react'
import { MapView } from './components/Map/MapView'
import { Sidebar } from './components/Sidebar/Sidebar'
import { AuthScreen } from './components/Auth/AuthScreen'
import { MARKERS, relocateMarkers, type MapMarker, type MarkerCategory } from './data/markers'
import { useUpdateMyPresence } from './lib/liveblocks.config'
import { supabase, type AuthResult } from './lib/supabase'
import './App.css'

const ALL_CATEGORIES = new Set<MarkerCategory>([
  'outpost', 'shelter', 'danger', 'supply', 'medical', 'signal',
])

const PRESENCE_COLORS = ['#60a5fa', '#34d399', '#f472b6', '#fb923c', '#a78bfa', '#fbbf24', '#38bdf8', '#f87171', '#4ade80']

function usernameColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return PRESENCE_COLORS[Math.abs(hash) % PRESENCE_COLORS.length]
}

function AppInner({ username }: { username: string }) {
  const [activeCategories, setActiveCategories] = useState<Set<MarkerCategory>>(ALL_CATEGORIES)
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null)
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
  const updateMyPresence = useUpdateMyPresence()

  useEffect(() => {
    updateMyPresence({ name: username, color: usernameColor(username) })
  }, [username, updateMyPresence])

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation([pos.coords.longitude, pos.coords.latitude]),
      () => {},
      { timeout: 15000, maximumAge: 0, enableHighAccuracy: true }
    )
  }, [])

  const markers = useMemo(
    () => (userLocation ? relocateMarkers(userLocation) : MARKERS),
    [userLocation]
  )

  const handleToggleCategory = useCallback((cat: MarkerCategory) => {
    setActiveCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }, [])

  const handleSelectMarker = useCallback(
    (marker: MapMarker | null) => {
      setSelectedMarker(marker)
      updateMyPresence({ selectedMarkerId: marker?.id ?? null })
    },
    [updateMyPresence]
  )

  return (
    <div className="app">
      <Sidebar
        username={username}
        activeCategories={activeCategories}
        markers={markers}
        selectedMarker={selectedMarker}
        onToggleCategory={handleToggleCategory}
        onSelectMarker={handleSelectMarker}
      />
      <main className="app__map">
        <MapView
          markers={markers}
          activeCategories={activeCategories}
          selectedMarker={selectedMarker}
          onMarkerClick={handleSelectMarker}
          userLocation={userLocation}
        />
      </main>
    </div>
  )
}

export default function App() {
  const [authUser, setAuthUser] = useState<AuthResult | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)

  // Restore session from Supabase on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const username =
          (session.user.user_metadata?.username as string | undefined) ||
          session.user.email?.split('@')[0] ||
          'Sobrevivente'
        setAuthUser({ username, userId: session.user.id, isNew: false })
      }
      setSessionLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user) {
        const username =
          (session.user.user_metadata?.username as string | undefined) ||
          session.user.email?.split('@')[0] ||
          'Sobrevivente'
        setAuthUser({ username, userId: session.user.id, isNew: false })
      } else {
        setAuthUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (sessionLoading) {
    return (
      <div className="map-loading">
        <div className="map-loading__spinner" />
        <span className="map-loading__text">CARREGANDO...</span>
      </div>
    )
  }

  if (!authUser) {
    return <AuthScreen onAuth={setAuthUser} />
  }

  return <AppInner username={authUser.username} />
}
