import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { GTA_STYLE } from '../../styles/gta-style'
import { CATEGORIES, type MapMarker, type MarkerCategory } from '../../data/markers'
import { BRAZIL_CITIES } from '../../data/cities'
import { ALL_CITY_MARKERS } from '../../data/cityMarkers'
import { generateZonePolygon, hashStr } from '../../lib/zonePolygon'
import { useUpdateMyPresence, useOthers, useOthersMapped } from '../../lib/liveblocks.config'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RouteInfo { distance: string; duration: string }

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
  onMarkerClick: (marker: MapMarker | null) => void
  userLocation: [number, number] | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ROUTE_SRC        = 'route-src'
const MARKERS_SRC      = 'markers-src'
const CITIES_SRC       = 'cities-src'
const CITY_MARKERS_SRC = 'city-markers-src'
const ZONES_SRC        = 'zones-src'

// Pin canvas dimensions
const PIN_W   = 30
const PIN_H   = 44
const PIN_R   = 11
const PIN_CY  = PIN_R + 2   // circle center Y = 13
const PIN_TIP = PIN_H - 2   // tip Y = 42

// Screen-px from anchor (tip) to pin circle centre at scale 1.0
const PIN_HEAD_OFFSET = PIN_H - PIN_CY  // 31

// ── Module-level static data (computed once at import time) ───────────────────

// 2,300 city detail markers as a GeoJSON FeatureCollection ready to load
const CITY_MARKERS_GEOJSON: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: ALL_CITY_MARKERS.map((m) => ({
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: m.coordinates },
    properties: {
      id: m.id,
      name: m.name,
      description: m.description,
      category: m.category,
    },
  })),
}

// Precomputed zone polygon features for city danger markers — never changes
const CITY_ZONE_FEATURES: GeoJSON.Feature[] = ALL_CITY_MARKERS
  .filter((m) => m.category === 'danger' && m.radius != null)
  .map((m) => ({
    type: 'Feature' as const,
    geometry: {
      type: 'Polygon' as const,
      coordinates: [generateZonePolygon(m.coordinates, m.radius!, hashStr(m.id))],
    },
    properties: { id: m.id },
  }))

// ── Pin icon rendering ────────────────────────────────────────────────────────

function drawPinSymbol(
  ctx: CanvasRenderingContext2D,
  category: MarkerCategory,
  cx: number,
  cy: number,
  color: string,
) {
  const s = 5.5
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 1.7
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  switch (category) {
    case 'outpost':
      ctx.beginPath()
      ctx.moveTo(cx, cy - s)
      ctx.lineTo(cx + s * 0.9, cy + s * 0.65)
      ctx.lineTo(cx - s * 0.9, cy + s * 0.65)
      ctx.closePath()
      ctx.stroke()
      break

    case 'shelter':
      ctx.beginPath()
      ctx.moveTo(cx, cy - s)
      ctx.lineTo(cx + s, cy - s * 0.1)
      ctx.lineTo(cx + s, cy + s * 0.7)
      ctx.lineTo(cx - s, cy + s * 0.7)
      ctx.lineTo(cx - s, cy - s * 0.1)
      ctx.closePath()
      ctx.stroke()
      ctx.strokeRect(cx - s * 0.28, cy + s * 0.1, s * 0.56, s * 0.6)
      break

    case 'danger':
      ctx.lineWidth = 2.2
      ctx.beginPath()
      ctx.moveTo(cx - s * 0.75, cy - s * 0.75)
      ctx.lineTo(cx + s * 0.75, cy + s * 0.75)
      ctx.moveTo(cx + s * 0.75, cy - s * 0.75)
      ctx.lineTo(cx - s * 0.75, cy + s * 0.75)
      ctx.stroke()
      break

    case 'supply':
      ctx.strokeRect(cx - s * 0.8, cy - s * 0.8, s * 1.6, s * 1.6)
      ctx.beginPath()
      ctx.moveTo(cx - s * 0.8, cy); ctx.lineTo(cx + s * 0.8, cy)
      ctx.moveTo(cx, cy - s * 0.8); ctx.lineTo(cx, cy + s * 0.8)
      ctx.stroke()
      break

    case 'medical':
      ctx.lineWidth = 2.4
      ctx.beginPath()
      ctx.moveTo(cx, cy - s); ctx.lineTo(cx, cy + s)
      ctx.moveTo(cx - s, cy); ctx.lineTo(cx + s, cy)
      ctx.stroke()
      break

    case 'signal':
      ctx.beginPath()
      ctx.arc(cx, cy + s * 0.3, 1.8, 0, Math.PI * 2)
      ctx.fill()
      ctx.lineWidth = 1.3
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath()
        ctx.arc(cx, cy + s * 0.3, s * i * 0.42, Math.PI * 1.2, Math.PI * 1.8)
        ctx.stroke()
      }
      break
  }

  ctx.restore()
}

function makePinIcon(
  category: MarkerCategory,
  selected: boolean,
): { width: number; height: number; data: Uint8ClampedArray } {
  const W = PIN_W, H = PIN_H
  const cx = W / 2
  const r = PIN_R
  const cy = PIN_CY
  const tipY = PIN_TIP

  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, W, H)

  const pinPath = () => {
    ctx.beginPath()
    ctx.moveTo(cx - r, cy)
    ctx.bezierCurveTo(cx - r, cy + r * 0.9, cx - 3, tipY - 7, cx, tipY)
    ctx.bezierCurveTo(cx + 3, tipY - 7, cx + r, cy + r * 0.9, cx + r, cy)
    ctx.arc(cx, cy, r, 0, Math.PI, true) // anticlockwise: east → top → west
    ctx.closePath()
  }

  // Drop shadow
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 7; ctx.shadowOffsetY = 2
  pinPath()
  ctx.fillStyle = selected ? '#2e2e2e' : '#181818'
  ctx.fill()
  ctx.restore()

  // Fill + outline
  pinPath()
  ctx.fillStyle = selected ? '#2e2e2e' : '#181818'
  ctx.fill()
  ctx.strokeStyle = selected ? '#dddddd' : '#5a5a5a'
  ctx.lineWidth = selected ? 2 : 1.5
  ctx.stroke()

  // Inner circle detail
  ctx.beginPath()
  ctx.arc(cx, cy, r - 2.5, 0, Math.PI * 2)
  ctx.strokeStyle = selected ? '#888888' : '#333333'
  ctx.lineWidth = 0.8
  ctx.stroke()

  drawPinSymbol(ctx, category, cx, cy, selected ? '#ffffff' : '#cccccc')

  const d = ctx.getImageData(0, 0, W, H)
  return { width: W, height: H, data: d.data }
}

// ── Other helpers ─────────────────────────────────────────────────────────────

function createArrowEl(name: string, color: string): HTMLElement {
  const el = document.createElement('div')
  el.className = 'remote-cursor'
  el.innerHTML = `
    <svg width="18" height="22" viewBox="0 0 18 22" fill="none" xmlns="http://www.w3.org/2000/svg"
         style="display:block;filter:drop-shadow(0 1px 4px rgba(0,0,0,.9))">
      <path d="M9 1L17 19L9 15L1 19L9 1Z"
            fill="${color}" stroke="#0d0d0d" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>
    <span class="remote-cursor__name" style="color:${color}">${name}</span>
  `
  return el
}

// Builds zone GeoJSON: user danger markers + precomputed city danger zones.
// Returns empty collection when 'danger' category is toggled off.
function buildZonesGeoJSON(
  userMarkers: MapMarker[],
  activeCategories: Set<MarkerCategory>,
): GeoJSON.FeatureCollection {
  if (!activeCategories.has('danger')) {
    return { type: 'FeatureCollection', features: [] }
  }
  const userZones: GeoJSON.Feature[] = userMarkers
    .filter((m) => m.category === 'danger' && m.radius != null)
    .map((m) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [generateZonePolygon(m.coordinates, m.radius!, hashStr(m.id))],
      },
      properties: { id: m.id },
    }))
  return {
    type: 'FeatureCollection',
    features: [...userZones, ...CITY_ZONE_FEATURES],
  }
}

function buildGeoJSON(
  markers: MapMarker[],
  activeCategories: Set<MarkerCategory>,
  selectedId: string | null,
  othersMap: Map<string, { name: string; color: string }>,
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: markers
      .filter((m) => activeCategories.has(m.category))
      .map((m) => {
        const other = othersMap.get(m.id)
        return {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: m.coordinates },
          properties: {
            id: m.id,
            name: m.name,
            description: m.description,
            category: m.category,
            selected: m.id === selectedId,
            otherColor: other?.color ?? '',
            otherName: other?.name ?? '',
          },
        }
      }),
  }
}

function citiesToGeoJSON(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: BRAZIL_CITIES.map((city) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: city.coordinates },
      properties: {
        id: city.id,
        name: city.name,
        category: city.category,
        minzoom: city.minzoom,
      },
    })),
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MapView({
  markers,
  activeCategories,
  selectedMarker,
  onMarkerClick,
  userLocation,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const userMarkerRef = useRef<maplibregl.Marker | null>(null)
  const remoteCursorsRef = useRef<Map<number, maplibregl.Marker>>(new Map())
  const activePopupRef = useRef<maplibregl.Popup | null>(null)

  const userLocationRef = useRef<[number, number] | null>(null)
  const markersRef = useRef<MapMarker[]>(markers)
  const onClickRef = useRef(onMarkerClick)

  const [mapLoaded, setMapLoaded] = useState(false)
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null)
  const [isRouting, setIsRouting] = useState(false)

  // ── Liveblocks ──────────────────────────────────────────────────────────────
  const updateMyPresence = useUpdateMyPresence()
  const updatePresenceRef = useRef(updateMyPresence)
  useEffect(() => { updatePresenceRef.current = updateMyPresence }, [updateMyPresence])

  const cursorData = useOthers((others) =>
    others.map((u) => ({
      id: u.connectionId,
      cursor: u.presence.cursor,
      name: u.presence.name,
      color: u.presence.color,
    }))
  )

  const rawSelections = useOthersMapped((user) => ({
    selectedMarkerId: user.presence.selectedMarkerId,
    name: user.presence.name,
    color: user.presence.color,
  }))

  const othersSelectionsMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>()
    for (const [, d] of rawSelections) {
      if (d.selectedMarkerId) map.set(d.selectedMarkerId, { name: d.name, color: d.color })
    }
    return map
  }, [rawSelections])

  useEffect(() => { userLocationRef.current = userLocation }, [userLocation])
  useEffect(() => { markersRef.current = markers }, [markers])
  useEffect(() => { onClickRef.current = onMarkerClick }, [onMarkerClick])

  // ── Map initialization ──────────────────────────────────────────────────────
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
    map.addControl(new maplibregl.NavigationControl({ showCompass: false, showZoom: true }), 'bottom-right')
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left')

    map.on('load', () => {
      // Register pin images for every category (normal + selected)
      for (const cat of Object.keys(CATEGORIES) as MarkerCategory[]) {
        map.addImage(`pin-${cat}`,     makePinIcon(cat, false) as Parameters<typeof map.addImage>[1])
        map.addImage(`pin-${cat}-sel`, makePinIcon(cat, true)  as Parameters<typeof map.addImage>[1])
      }

      // ── 1. Infection zones — rendered below all markers ────────────────────
      map.addSource(ZONES_SRC, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      // Soft outer glow (wide blurred line)
      map.addLayer({
        id: 'zones-glow',
        type: 'line',
        source: ZONES_SRC,
        minzoom: 8,
        paint: {
          'line-color': '#cc0000',
          'line-width': 22,
          'line-opacity': 0.13,
          'line-blur': 18,
        },
      })

      // Semi-transparent fill
      map.addLayer({
        id: 'zones-fill',
        type: 'fill',
        source: ZONES_SRC,
        minzoom: 8,
        paint: {
          'fill-color': '#cc0000',
          'fill-opacity': 0.10,
          'fill-antialias': true,
        },
      })

      // Dashed border
      map.addLayer({
        id: 'zones-border',
        type: 'line',
        source: ZONES_SRC,
        minzoom: 8,
        paint: {
          'line-color': '#ff2222',
          'line-width': 1.5,
          'line-opacity': 0.60,
          'line-dasharray': [4, 3],
        },
      })

      // ── 2. Brazil city-level pins (overview, zoom 5–13) ────────────────────
      map.addSource(CITIES_SRC, {
        type: 'geojson',
        data: citiesToGeoJSON(),
      })

      map.addLayer({
        id: 'cities-blip',
        type: 'symbol',
        source: CITIES_SRC,
        minzoom: 5,
        maxzoom: 13,
        filter: ['<=', ['get', 'minzoom'], ['zoom']],
        layout: {
          'symbol-sort-key': ['get', 'minzoom'],
          'icon-image': ['concat', 'pin-', ['get', 'category']],
          'icon-anchor': 'bottom',
          'icon-size': 0.6,
          'icon-allow-overlap': false,
          'icon-optional': false,
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-size': 9,
          'text-anchor': 'top',
          'text-offset': [0, 0.25],
          'text-optional': true,
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#666666',
          'text-halo-color': '#0d0d0d',
          'text-halo-width': 1.5,
        },
      })

      // ── 3. City detail markers (50 per city, visible from zoom 13) ─────────
      map.addSource(CITY_MARKERS_SRC, {
        type: 'geojson',
        data: CITY_MARKERS_GEOJSON,
      })

      map.addLayer({
        id: 'city-markers-blip',
        type: 'symbol',
        source: CITY_MARKERS_SRC,
        minzoom: 13,
        layout: {
          'icon-image': ['concat', 'pin-', ['get', 'category']],
          'icon-anchor': 'bottom',
          'icon-size': 0.62,
          'icon-allow-overlap': false,
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-size': 8,
          'text-anchor': 'top',
          'text-offset': [0, 0.2],
          'text-optional': true,
          'text-allow-overlap': false,
          'text-max-width': 8,
        },
        paint: {
          'text-color': '#555555',
          'text-halo-color': '#0d0d0d',
          'text-halo-width': 1.5,
        },
      })

      // ── 4. User custom markers (interactive, always visible) ───────────────
      map.addSource(MARKERS_SRC, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      // Colored ring = another user has selected this marker
      map.addLayer({
        id: 'markers-other-ring',
        type: 'circle',
        source: MARKERS_SRC,
        filter: ['!=', ['get', 'otherColor'], ''],
        paint: {
          'circle-radius': 14,
          'circle-color': 'transparent',
          'circle-stroke-width': 2.5,
          'circle-stroke-color': ['get', 'otherColor'],
          'circle-stroke-opacity': 0.95,
          'circle-translate': [0, -25],
        },
      })

      map.addLayer({
        id: 'markers-blip',
        type: 'symbol',
        source: MARKERS_SRC,
        layout: {
          'icon-image': [
            'concat',
            'pin-',
            ['get', 'category'],
            ['case', ['boolean', ['get', 'selected'], false], '-sel', ''],
          ],
          'icon-anchor': 'bottom',
          'icon-size': ['case', ['boolean', ['get', 'selected'], false], 0.95, 0.82],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      })

      // ── 5. Route ───────────────────────────────────────────────────────────
      map.addSource(ROUTE_SRC, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({ id: 'route-glow', type: 'line', source: ROUTE_SRC,
        paint: { 'line-color': '#a855f7', 'line-width': 14, 'line-opacity': 0.18, 'line-blur': 8 },
        layout: { 'line-cap': 'round', 'line-join': 'round' } })
      map.addLayer({ id: 'route-line', type: 'line', source: ROUTE_SRC,
        paint: { 'line-color': '#a855f7', 'line-width': 4, 'line-opacity': 0.95 },
        layout: { 'line-cap': 'round', 'line-join': 'round' } })
      map.addLayer({ id: 'route-dash', type: 'line', source: ROUTE_SRC,
        paint: { 'line-color': '#e9d5ff', 'line-width': 1.5, 'line-dasharray': [4, 6], 'line-opacity': 0.6 },
        layout: { 'line-cap': 'butt' } })

      setMapLoaded(true)
    })

    // ── Cursor presence ─────────────────────────────────────────────────────
    map.on('mousemove', (e) => {
      updatePresenceRef.current({ cursor: { lng: e.lngLat.lng, lat: e.lngLat.lat } })
    })
    map.on('mouseleave', () => { updatePresenceRef.current({ cursor: null }) })

    // ── Click handlers ───────────────────────────────────────────────────────
    let justClickedMarker = false

    // Custom user markers
    map.on('click', 'markers-blip', (e) => {
      justClickedMarker = true
      if (!e.features?.length) return
      const props = e.features[0].properties as {
        id: string; name: string; description: string; category: MarkerCategory;
        otherName: string; otherColor: string;
      }
      const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number]
      const sym = CATEGORIES[props.category]?.icon ?? '◈'

      activePopupRef.current?.remove()
      activePopupRef.current = new maplibregl.Popup({
        offset: [0, -(PIN_HEAD_OFFSET * 0.82)],
        closeButton: true,
        className: 'gta-popup',
      })
        .setLngLat(coords)
        .setHTML(`
          <div class="gta-popup-inner">
            <div class="gta-popup-header">
              <span style="font-size:14px;color:#aaaaaa;font-family:'Courier New',monospace">${sym}</span>
              <span class="gta-popup-name">${props.name}</span>
            </div>
            <p class="gta-popup-desc">${props.description}</p>
            ${props.otherName
              ? `<p class="gta-popup-other" style="color:${props.otherColor}">● ${props.otherName} está aqui</p>`
              : ''}
          </div>
        `)
        .addTo(map)

      const marker = markersRef.current.find((m) => m.id === props.id)
      if (marker) onClickRef.current(marker)
    })

    // City detail markers (informational popup, no presence sync)
    map.on('click', 'city-markers-blip', (e) => {
      justClickedMarker = true
      if (!e.features?.length) return
      const props = e.features[0].properties as {
        id: string; name: string; description: string; category: MarkerCategory;
      }
      const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number]
      const sym = CATEGORIES[props.category]?.icon ?? '◈'

      activePopupRef.current?.remove()
      activePopupRef.current = new maplibregl.Popup({
        offset: [0, -(PIN_HEAD_OFFSET * 0.62)],
        closeButton: true,
        className: 'gta-popup',
      })
        .setLngLat(coords)
        .setHTML(`
          <div class="gta-popup-inner">
            <div class="gta-popup-header">
              <span style="font-size:14px;color:#aaaaaa;font-family:'Courier New',monospace">${sym}</span>
              <span class="gta-popup-name">${props.name}</span>
            </div>
            <p class="gta-popup-desc">${props.description}</p>
          </div>
        `)
        .addTo(map)
    })

    // General click — close popup and deselect
    map.on('click', () => {
      if (!justClickedMarker) {
        activePopupRef.current?.remove()
        activePopupRef.current = null
        onClickRef.current(null)
      }
      justClickedMarker = false
    })

    map.on('mouseenter', 'markers-blip',      () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'markers-blip',      () => { map.getCanvas().style.cursor = '' })
    map.on('mouseenter', 'city-markers-blip', () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'city-markers-blip', () => { map.getCanvas().style.cursor = '' })

    // ── Double-click → route ────────────────────────────────────────────────
    map.on('dblclick', async (e) => {
      e.preventDefault()
      const loc = userLocationRef.current
      if (!loc) return
      setIsRouting(true)
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${loc[0]},${loc[1]};${e.lngLat.lng},${e.lngLat.lat}?geometries=geojson&overview=full`
        const data: OsrmResponse = await (await fetch(url)).json()
        if (data.code === 'Ok' && data.routes.length > 0) {
          const route = data.routes[0]
          ;(map.getSource(ROUTE_SRC) as maplibregl.GeoJSONSource).setData({
            type: 'Feature', geometry: route.geometry, properties: {},
          })
          const km = (route.distance / 1000).toFixed(1)
          const mins = Math.round(route.duration / 60)
          const h = Math.floor(mins / 60)
          setRouteInfo({
            distance: `${km} km`,
            duration: h > 0 ? `${h}h ${mins % 60}min` : `${mins} min`,
          })
          const c = route.geometry.coordinates
          if (c.length > 1) {
            const bounds = c.reduce(
              (b, p) => b.extend(p as [number, number]),
              new maplibregl.LngLatBounds(c[0] as [number, number], c[0] as [number, number]),
            )
            map.fitBounds(bounds, { padding: 80, duration: 1000 })
          }
        }
      } catch {} finally { setIsRouting(false) }
    })

    mapRef.current = map
    return () => {
      remoteCursorsRef.current.forEach((m) => m.remove())
      remoteCursorsRef.current.clear()
      userMarkerRef.current?.remove()
      activePopupRef.current?.remove()
      map.remove()
    }
  }, [])

  // ── Update user markers GeoJSON ─────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return
    ;(map.getSource(MARKERS_SRC) as maplibregl.GeoJSONSource | undefined)
      ?.setData(buildGeoJSON(markers, activeCategories, selectedMarker?.id ?? null, othersSelectionsMap))
  }, [markers, activeCategories, selectedMarker, othersSelectionsMap, mapLoaded])

  // ── Update infection zones GeoJSON ──────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return
    ;(map.getSource(ZONES_SRC) as maplibregl.GeoJSONSource | undefined)
      ?.setData(buildZonesGeoJSON(markers, activeCategories))
  }, [markers, activeCategories, mapLoaded])

  // ── Sync city markers category filter ───────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded || !map.getLayer('city-markers-blip')) return
    const cats = [...activeCategories]
    map.setFilter(
      'city-markers-blip',
      (cats.length === 0
        ? ['==', ['get', 'category'], '']
        : ['match', ['get', 'category'], cats, true, false]
      ) as Parameters<(typeof map)['setFilter']>[1],
    )
  }, [activeCategories, mapLoaded])

  // ── User location marker ────────────────────────────────────────────────────
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

  // ── Remote cursors (update position only, no recreation) ───────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const seen = new Set(cursorData.map((u) => u.id))
    remoteCursorsRef.current.forEach((m, id) => {
      if (!seen.has(id)) { m.remove(); remoteCursorsRef.current.delete(id) }
    })

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
        const m = new maplibregl.Marker({ element: createArrowEl(name, color), anchor: 'top-left' })
          .setLngLat([cursor.lng, cursor.lat])
          .addTo(map)
        remoteCursorsRef.current.set(id, m)
      }
    }
  }, [cursorData])

  // ── Fly to selected marker ──────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedMarker) return
    map.flyTo({ center: selectedMarker.coordinates, zoom: Math.max(map.getZoom(), 14), duration: 700 })
  }, [selectedMarker])

  const clearRoute = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    ;(map.getSource(ROUTE_SRC) as maplibregl.GeoJSONSource | undefined)
      ?.setData({ type: 'FeatureCollection', features: [] })
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
          <button className="route-hud__clear" onClick={clearRoute}>✕</button>
        </div>
      )}

      {isRouting && <div className="routing-loading">CALCULANDO ROTA...</div>}
      {mapLoaded && !routeInfo && userLocation && (
        <div className="map-hint">DUPLO CLIQUE PARA TRAÇAR ROTA</div>
      )}
    </div>
  )
}
