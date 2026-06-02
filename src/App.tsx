import { useState, useCallback, useEffect, useMemo } from 'react'
import { MapView } from './components/Map/MapView'
import { Sidebar } from './components/Sidebar/Sidebar'
import { MARKERS, relocateMarkers, type MapMarker, type MarkerCategory } from './data/markers'
import { useUpdateMyPresence } from './lib/liveblocks.config'
import './App.css'

const ALL_CATEGORIES = new Set<MarkerCategory>([
  'weapons', 'vehicles', 'missions', 'safehouses', 'services', 'events',
])

export default function App() {
  const [activeCategories, setActiveCategories] = useState<Set<MarkerCategory>>(ALL_CATEGORIES)
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null)
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
  const updateMyPresence = useUpdateMyPresence()

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation([pos.coords.longitude, pos.coords.latitude]),
      () => {},
      { timeout: 10000, maximumAge: 60000 }
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
