import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { GTA_STYLE } from '../../styles/gta-style'
import { CATEGORIES, type MapMarker, type MarkerCategory } from '../../data/markers'
import { useUpdateMyPresence, useOthers, useOthersMapped } from '../../lib/liveblocks.config'

interface RouteInfo {
  distance: string
  duration: string
}

interface OsrmResponse {
  code: string
  routes: Array<{
    geometry: { type: 'LineString'; coordinates: [number, number][] }
    distance: number
    duration: number
  }>
}

interface MapViewProps {
  markers: MapMarker[]
  activeCategories: Set<MarkerCategory>
  selectedMarker: MapMarker | null
  onMarkerClick: (marker: MapMarker) => void
  userLocation: [number, number] | null
}

const ROUTE_SOURCE = 'route-source'

function createCursorEl(name: string, color: string): HTMLElement {
  const el = document.createElement('div')
  el.className = 'remote-cursor'
  el.innerHTML = `
    <div class="remote-cursor__dot" style="background:${color}; box-shadow:0 0 6px ${color}88"></div>
    <span class="remote-cursor__name" style="color:${color}">${name}</span>
  `
  return el
}

export function MapView({
  markers,
  activeCategories,
  selectedMarker,
  onMarkerClick,
  userLocation,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map())
  const userMarkerRef = useRef<maplibregl.Marker | null>(null)
  const remoteCursorsRef = useRef<Map<number, maplibregl.Marker>>(new Map())
  const userLocationRef = useRef<[number, number] | null>(null)
  const routeSourceReadyRef = useRef(false)

  const [mapLoaded, setMapLoaded] = useState(false)
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null)
  const [isRouting, setIsRouting] = useState(false)

  // Liveblocks — cursor presence
  const updateMyPresence = useUpdateMyPresence()
  const updatePresenceRef = useRef(updateMyPresence)
  useEffect(() => { updatePresenceRef.current = updateMyPresence }, [updateMyPresence])

  // Remote cursors (re-renders on cursor moves — intentional)
  const cursorData = useOthers((others) =>
    others.map((u) => ({
      id: u.connectionId,
      cursor: u.presence.cursor,
      name: u.presence.name,
      color: u.presence.color,
    }))
  )

  // Others' selections (useOthersMapped = stable, won't re-render on cursor moves)
  const rawSelections = useOthersMapped((user) => ({
    selectedMarkerId: user.presence.selectedMarkerId,
    name: user.presence.name,
    color: user.presence.color,
  }))

  const othersSelectionsMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>()
    for (const [, data] of rawSelections) {
      if (data.selectedMarkerId) {
        map.set(data.selectedMarkerId, { name: data.name, color: data.color })
      }
    }
    return map
  }, [rawSelections])

  // Keep refs in sync
  useEffect(() => { userLocationRef.current = userLocation }, [userLocation])

  // ── Initialize map ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: GTA_STYLE,
      center: [-47.9, -15.8],
      zoom: 5,
      attributionControl: false,
      maxZoom: 18,
      minZoom: 3,
    })

    map.doubleClickZoom.disable()
    map.scrollZoom.enable()

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false, showZoom: true }),
      'bottom-right'
    )
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left')

    map.on('load', () => {
      // Route source + layers
      map.addSource(ROUTE_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: 'route-glow',
        type: 'line',
        source: ROUTE_SOURCE,
        paint: { 'line-color': '#a855f7', 'line-width': 14, 'line-opacity': 0.18, 'line-blur': 8 },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      })
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: ROUTE_SOURCE,
        paint: { 'line-color': '#a855f7', 'line-width': 4, 'line-opacity': 0.95 },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      })
      map.addLayer({
        id: 'route-dash',
        type: 'line',
        source: ROUTE_SOURCE,
        paint: { 'line-color': '#e9d5ff', 'line-width': 1.5, 'line-dasharray': [4, 6], 'line-opacity': 0.6 },
        layout: { 'line-cap': 'butt' },
      })
      routeSourceReadyRef.current = true
      setMapLoaded(true)
    })

    // Cursor tracking → Liveblocks presence
    map.on('mousemove', (e) => {
      updatePresenceRef.current({ cursor: { lng: e.lngLat.lng, lat: e.lngLat.lat } })
    })
    map.on('mouseleave', () => {
      updatePresenceRef.current({ cursor: null })
    })

    // Double-click → route from user location to clicked point
    map.on('dblclick', async (e) => {
      e.preventDefault()
      const loc = userLocationRef.current
      if (!loc) return

      setIsRouting(true)
      try {
        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${loc[0]},${loc[1]};${e.lngLat.lng},${e.lngLat.lat}` +
          `?geometries=geojson&overview=full`

        const res = await fetch(url)
        const data: OsrmResponse = await res.json()

        if (data.code === 'Ok' && data.routes.length > 0) {
          const route = data.routes[0]
          ;(map.getSource(ROUTE_SOURCE) as maplibregl.GeoJSONSource).setData({
            type: 'Feature',
            geometry: route.geometry,
            properties: {},
          })

          const km = (route.distance / 1000).toFixed(1)
          const mins = Math.round(route.duration / 60)
          const h = Math.floor(mins / 60)
          const m = mins % 60
          setRouteInfo({ distance: `${km} km`, duration: h > 0 ? `${h}h ${m}min` : `${mins} min` })

          const coords = route.geometry.coordinates
          if (coords.length > 1) {
            const bounds = coords.reduce(
              (b, c) => b.extend(c as [number, number]),
              new maplibregl.LngLatBounds(coords[0] as [number, number], coords[0] as [number, number])
            )
            map.fitBounds(bounds, { padding: 80, duration: 1000 })
          }
        }
      } catch {}
      finally { setIsRouting(false) }
    })

    mapRef.current = map

    return () => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current.clear()
      remoteCursorsRef.current.forEach((m) => m.remove())
      remoteCursorsRef.current.clear()
      userMarkerRef.current?.remove()
      map.remove()
    }
  }, [])

  // ── User location marker + fly-to ─────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !userLocation) return

    userMarkerRef.current?.remove()
    const el = document.createElement('div')
    el.className = 'user-location-marker'
    el.innerHTML = `<div class="ulm__pulse"></div><div class="ulm__core"></div>`
    userMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat(userLocation)
      .addTo(map)
    map.flyTo({ center: userLocation, zoom: 14, duration: 1800 })
  }, [userLocation])

  // ── Remote cursors ────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const currentIds = new Set(cursorData.map((u) => u.id))

    // Remove disconnected users
    remoteCursorsRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove()
        remoteCursorsRef.current.delete(id)
      }
    })

    // Add or update each cursor
    for (const { id, cursor, name, color } of cursorData) {
      if (!cursor) {
        remoteCursorsRef.current.get(id)?.remove()
        remoteCursorsRef.current.delete(id)
        continue
      }

      const existing = remoteCursorsRef.current.get(id)
      if (existing) {
        existing.setLngLat([cursor.lng, cursor.lat])
      } else {
        const el = createCursorEl(name, color)
        const marker = new maplibregl.Marker({ element: el, anchor: 'top-left' })
          .setLngLat([cursor.lng, cursor.lat])
          .addTo(map)
        remoteCursorsRef.current.set(id, marker)
      }
    }
  }, [cursorData])

  // ── Markers (local + others' selection badges) ────────────────────────────
  const createMarkerEl = useCallback((marker: MapMarker, isSelected: boolean) => {
    const { color, icon } = CATEGORIES[marker.category]
    const size = isSelected ? 30 : 24
    const el = document.createElement('div')
    el.style.cssText = `
      position: relative;
      width: ${size}px;
      height: ${size}px;
      background: ${isSelected ? '#2a2a2a' : '#141414'};
      border: 2px solid ${isSelected ? '#e0e0e0' : color};
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 ${isSelected ? 12 : 5}px ${color}55;
      transition: all 0.2s;
    `
    const inner = document.createElement('span')
    inner.style.cssText = `font-size: ${isSelected ? 15 : 11}px; line-height: 1; user-select: none;`
    inner.textContent = icon
    el.appendChild(inner)
    return el
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const setup = () => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current.clear()

      markers.forEach((marker) => {
        if (!activeCategories.has(marker.category)) return

        const isSelected = selectedMarker?.id === marker.id
        const el = createMarkerEl(marker, isSelected)

        // Badge: another user has this marker selected
        const otherSelector = othersSelectionsMap.get(marker.id)
        if (otherSelector) {
          const badge = document.createElement('div')
          badge.className = 'marker-badge'
          badge.style.cssText = `
            position: absolute;
            top: -3px;
            right: -3px;
            width: 9px;
            height: 9px;
            background: ${otherSelector.color};
            border: 1.5px solid #0d0d0d;
            border-radius: 50%;
            box-shadow: 0 0 5px ${otherSelector.color};
          `
          badge.title = otherSelector.name
          el.appendChild(badge)
        }

        const popup = new maplibregl.Popup({
          offset: 18,
          closeButton: false,
          className: 'gta-popup',
        }).setHTML(`
          <div class="gta-popup-inner">
            <div class="gta-popup-header">
              <span>${CATEGORIES[marker.category].icon}</span>
              <span class="gta-popup-name">${marker.name}</span>
            </div>
            <p class="gta-popup-desc">${marker.description}</p>
            ${otherSelector ? `<p class="gta-popup-other" style="color:${otherSelector.color}">● ${otherSelector.name} está aqui</p>` : ''}
          </div>
        `)

        const ml = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat(marker.coordinates)
          .setPopup(popup)
          .addTo(map)

        el.addEventListener('click', () => onMarkerClick(marker))
        markersRef.current.set(marker.id, ml)
      })
    }

    if (map.isStyleLoaded()) setup()
    else map.once('load', setup)
  }, [markers, activeCategories, selectedMarker, othersSelectionsMap, createMarkerEl, onMarkerClick])

  // Fly to selected marker
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedMarker) return
    map.flyTo({ center: selectedMarker.coordinates, zoom: Math.max(map.getZoom(), 14), duration: 700 })
  }, [selectedMarker])

  const clearRoute = useCallback(() => {
    const map = mapRef.current
    if (!map || !routeSourceReadyRef.current) return
    ;(map.getSource(ROUTE_SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection', features: [],
    })
    setRouteInfo(null)
  }, [])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {!mapLoaded && (
        <div className="map-loading">
          <div className="map-loading__spinner" />
          <span className="map-loading__text">CARREGANDO MAPA...</span>
        </div>
      )}

      {routeInfo && (
        <div className="route-hud">
          <div className="route-hud__body">
            <span className="route-hud__label">TRAJETO</span>
            <div className="route-hud__stats">
              <span className="route-hud__stat">◎ {routeInfo.distance}</span>
              <span className="route-hud__stat">⏱ {routeInfo.duration}</span>
            </div>
          </div>
          <button className="route-hud__clear" onClick={clearRoute} title="Limpar rota">✕</button>
        </div>
      )}

      {isRouting && <div className="routing-loading">CALCULANDO ROTA...</div>}

      {mapLoaded && !routeInfo && userLocation && (
        <div className="map-hint">DUPLO CLIQUE PARA TRAÇAR ROTA</div>
      )}
    </div>
  )
}
