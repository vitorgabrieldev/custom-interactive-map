import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { GTA_STYLE } from '../../styles/gta-style'
import { CATEGORIES, type MapMarker, type MarkerCategory } from '../../data/markers'
import { BRAZIL_CITIES } from '../../data/cities'
import { ALL_CITY_MARKERS } from '../../data/cityMarkers'
import { generateZonePolygon, hashStr } from '../../lib/zonePolygon'
import { useUpdateMyPresence, useOthers, useOthersMapped } from '../../lib/liveblocks.config'
import type { Base, LootSpawn } from '../../types/game'
import { RARITY_COLORS } from '../../lib/game'

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
  bases: Base[]
  lootSpawns: LootSpawn[]
  currentUserId: string
  onBaseClick: (base: Base) => void
  onLootClick: (loot: LootSpawn) => void
  onMapClick?: (lng: number, lat: number) => void
  plantingMode?: boolean
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ROUTE_SRC        = 'route-src'
const MARKERS_SRC      = 'markers-src'
const CITIES_SRC       = 'cities-src'
const CITY_MARKERS_SRC = 'city-markers-src'
const ZONES_SRC        = 'zones-src'
const BASES_SRC        = 'bases-src'
const LOOT_SRC         = 'loot-src'
const PLAYER_SRC       = 'player-src'

const WALK_SPEED   = 0.000030
const SPRINT_SPEED = 0.000070

const RARITY_SLUGS = ['NORMAL', 'INCOMUM', 'RARO', 'LENDÁRIO', 'ÚNICO', 'ARTEFATO']

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

// ── Base pin icon ─────────────────────────────────────────────────────────────

function makeBasePin(
  type: 'own' | 'other' | 'ruin',
): { width: number; height: number; data: Uint8ClampedArray } {
  const W = 34, H = 34
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, W, H)
  const cx = W / 2, cy = H / 2, size = 12

  const palette = {
    own:   { border: '#f59e0b', fill: '#150f00', symbol: '#f59e0b' },
    other: { border: '#ea7c1a', fill: '#120a00', symbol: '#ea7c1a' },
    ruin:  { border: '#7f2020', fill: '#1a0d0d', symbol: '#6b2222' },
  }
  const c = palette[type]

  const diamond = () => {
    ctx.beginPath()
    ctx.moveTo(cx, cy - size - 2)
    ctx.lineTo(cx + size + 2, cy)
    ctx.lineTo(cx, cy + size + 2)
    ctx.lineTo(cx - size - 2, cy)
    ctx.closePath()
  }

  ctx.save()
  ctx.shadowColor = type === 'own' ? 'rgba(245,158,11,0.6)' : 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = type === 'own' ? 12 : 8
  diamond(); ctx.fillStyle = c.fill; ctx.fill()
  ctx.restore()

  diamond()
  ctx.fillStyle = c.fill
  ctx.fill()
  ctx.strokeStyle = c.border
  ctx.lineWidth = type === 'own' ? 2.5 : 1.8
  ctx.stroke()

  ctx.font = '13px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = c.symbol
  ctx.fillText(type === 'ruin' ? '✕' : '⌂', cx, cy + 1)

  return { width: W, height: H, data: ctx.getImageData(0, 0, W, H).data }
}

// ── Loot pin icon ─────────────────────────────────────────────────────────────

function makeLootPin(raritySlug: string): { width: number; height: number; data: Uint8ClampedArray } {
  const color = RARITY_COLORS[raritySlug] ?? '#9ca3af'
  const W = 22, H = 22
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, W, H)
  const cx = W / 2, cy = H / 2, r = 8

  ctx.save()
  ctx.shadowColor = color; ctx.shadowBlur = 10
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = '#0d0d0d'; ctx.fill()
  ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.stroke()
  ctx.restore()

  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = '#0d0d0d'; ctx.fill()
  ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.stroke()

  ctx.font = '10px monospace'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillStyle = color
  ctx.fillText('★', cx, cy + 0.5)

  return { width: W, height: H, data: ctx.getImageData(0, 0, W, H).data }
}

// ── GeoJSON builders ─────────────────────────────────────────────────────────

function buildBasesGeoJSON(bases: Base[], currentUserId: string): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: bases.map((b) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [b.lng, b.lat] },
      properties: {
        id: b.id,
        name: b.name,
        status: b.status,
        level: b.level,
        isOwn: b.owner_id === currentUserId ? 1 : 0,
        owner_username: b.owner_username ?? '',
      },
    })),
  }
}

function buildLootGeoJSON(loot: LootSpawn[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: loot.map((l) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [l.lng, l.lat] },
      properties: {
        id: l.id,
        item_name: l.item?.name ?? '?',
        rarity_slug: l.item?.rarity?.slug ?? 'NORMAL',
        icon: l.item?.icon ?? '★',
        spawn_reason: l.spawn_reason,
      },
    })),
  }
}

function buildPlayerGeoJSON(center: [number, number]): GeoJSON.FeatureCollection {
  const r = 0.000028 // ~3m radius
  const pts = 20
  const ring = Array.from({ length: pts }, (_, i) => {
    const a = (i / pts) * Math.PI * 2
    return [center[0] + Math.cos(a) * r, center[1] + Math.sin(a) * r] as [number, number]
  })
  ring.push(ring[0])
  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: {} }],
  }
}

function emptyGeoJSON(): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: [] }
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
  bases,
  lootSpawns,
  currentUserId,
  onBaseClick,
  onLootClick,
  onMapClick,
  plantingMode = false,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const userMarkerRef = useRef<maplibregl.Marker | null>(null)
  const remoteCursorsRef = useRef<Map<number, maplibregl.Marker>>(new Map())
  const activePopupRef = useRef<maplibregl.Popup | null>(null)

  const userLocationRef = useRef<[number, number] | null>(null)
  const markersRef = useRef<MapMarker[]>(markers)
  const onClickRef = useRef(onMarkerClick)
  const basesRef = useRef<Base[]>(bases)
  const lootRef = useRef<LootSpawn[]>(lootSpawns)
  const currentUserIdRef = useRef(currentUserId)
  const onBaseClickRef = useRef(onBaseClick)
  const onLootClickRef = useRef(onLootClick)
  const onMapClickRef = useRef(onMapClick)
  const plantingModeRef = useRef(plantingMode)

  // Walk refs
  const walkPosRef  = useRef<[number, number] | null>(null)
  const walkKeysRef = useRef({ w: false, a: false, s: false, d: false, q: false, e: false, shift: false })
  const walkAnimRef = useRef<number | null>(null)

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
  useEffect(() => { basesRef.current = bases }, [bases])
  useEffect(() => { lootRef.current = lootSpawns }, [lootSpawns])
  useEffect(() => { currentUserIdRef.current = currentUserId }, [currentUserId])
  useEffect(() => { onBaseClickRef.current = onBaseClick }, [onBaseClick])
  useEffect(() => { onLootClickRef.current = onLootClick }, [onLootClick])
  useEffect(() => { onMapClickRef.current = onMapClick }, [onMapClick])
  useEffect(() => { plantingModeRef.current = plantingMode }, [plantingMode])

  // ── Map initialization ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: GTA_STYLE,
      center: [-51.1696, -23.3045],
      zoom: 14,
      pitch: 55,
      maxPitch: 85,
      attributionControl: false,
      maxZoom: 20,
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

      // Register base pin images
      map.addImage('base-own',   makeBasePin('own')   as Parameters<typeof map.addImage>[1])
      map.addImage('base-other', makeBasePin('other') as Parameters<typeof map.addImage>[1])
      map.addImage('base-ruin',  makeBasePin('ruin')  as Parameters<typeof map.addImage>[1])

      // Register loot pin images (one per rarity)
      for (const slug of RARITY_SLUGS) {
        map.addImage(`loot-${slug}`, makeLootPin(slug) as Parameters<typeof map.addImage>[1])
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

      // ── 5. Bases ───────────────────────────────────────────────────────────
      map.addSource(BASES_SRC, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      // Glow ring for own base
      map.addLayer({
        id: 'bases-own-glow',
        type: 'circle',
        source: BASES_SRC,
        filter: ['==', ['get', 'isOwn'], 1],
        paint: {
          'circle-radius': 20,
          'circle-color': 'transparent',
          'circle-stroke-width': 0,
          'circle-opacity': 0,
          'circle-blur': 1,
        },
      })

      map.addLayer({
        id: 'bases-blip',
        type: 'symbol',
        source: BASES_SRC,
        layout: {
          'icon-image': [
            'case',
            ['==', ['get', 'status'], 'RUÍNA'], 'base-ruin',
            ['==', ['get', 'isOwn'], 1], 'base-own',
            'base-other',
          ],
          'icon-anchor': 'center',
          'icon-size': 0.9,
          'icon-allow-overlap': true,
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-size': 10,
          'text-anchor': 'top',
          'text-offset': [0, 1.2],
          'text-optional': true,
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': [
            'case',
            ['==', ['get', 'status'], 'RUÍNA'], '#7f2020',
            ['==', ['get', 'isOwn'], 1], '#f59e0b',
            '#ea7c1a',
          ],
          'text-halo-color': '#0d0d0d',
          'text-halo-width': 2,
        },
      })

      // ── 6. Loot spawns ────────────────────────────────────────────────────
      map.addSource(LOOT_SRC, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      map.addLayer({
        id: 'loot-blip',
        type: 'symbol',
        source: LOOT_SRC,
        layout: {
          'icon-image': ['concat', 'loot-', ['get', 'rarity_slug']],
          'icon-anchor': 'center',
          'icon-size': 1.0,
          'icon-allow-overlap': true,
          'text-field': ['get', 'item_name'],
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-size': 9,
          'text-anchor': 'top',
          'text-offset': [0, 1.0],
          'text-optional': true,
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#888888',
          'text-halo-color': '#0d0d0d',
          'text-halo-width': 1.5,
        },
      })

      // ── 7. Route ───────────────────────────────────────────────────────────
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

      // ── 8. Player 3D (walk mode) ──────────────────────────────────────────
      map.addSource(PLAYER_SRC, {
        type: 'geojson',
        data: emptyGeoJSON(),
      })

      // Glow ring at ground level
      map.addLayer({
        id: 'player-glow',
        type: 'fill-extrusion',
        source: PLAYER_SRC,
        paint: {
          'fill-extrusion-color': '#f59e0b',
          'fill-extrusion-height': 0.3,
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.35,
        },
      })

      // Player body — amber cylinder
      map.addLayer({
        id: 'player-3d',
        type: 'fill-extrusion',
        source: PLAYER_SRC,
        paint: {
          'fill-extrusion-color': '#f59e0b',
          'fill-extrusion-height': 1.9,
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 1,
        },
      })

      setMapLoaded(true)
    })

    // ── Cursor presence ─────────────────────────────────────────────────────
    map.on('mousemove', (e) => {
      updatePresenceRef.current({ cursor: { lng: e.lngLat.lng, lat: e.lngLat.lat } })
    })
    map.on('mouseleave', () => { updatePresenceRef.current({ cursor: null }) })

    // ── Click handlers ───────────────────────────────────────────────────────
    let justClickedSpecial = false

    // Base markers
    map.on('click', 'bases-blip', (e) => {
      justClickedSpecial = true
      if (!e.features?.length) return
      const props = e.features[0].properties as { id: string }
      const base = basesRef.current.find(b => b.id === props.id)
      if (base) onBaseClickRef.current(base)
    })

    // Loot markers
    map.on('click', 'loot-blip', (e) => {
      justClickedSpecial = true
      if (!e.features?.length) return
      const props = e.features[0].properties as { id: string }
      const loot = lootRef.current.find(l => l.id === props.id)
      if (loot) onLootClickRef.current(loot)
    })

    // Custom user markers
    map.on('click', 'markers-blip', (e) => {
      justClickedSpecial = true
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
      justClickedSpecial = true
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

    // General click — close popup, deselect, or place base
    map.on('click', (e) => {
      if (!justClickedSpecial) {
        if (plantingModeRef.current) {
          onMapClickRef.current?.(e.lngLat.lng, e.lngLat.lat)
        } else {
          activePopupRef.current?.remove()
          activePopupRef.current = null
          onClickRef.current(null)
        }
      }
      justClickedSpecial = false
    })

    map.on('mouseenter', 'markers-blip',      () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'markers-blip',      () => { map.getCanvas().style.cursor = '' })
    map.on('mouseenter', 'city-markers-blip', () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'city-markers-blip', () => { map.getCanvas().style.cursor = '' })
    map.on('mouseenter', 'bases-blip',        () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'bases-blip',        () => { map.getCanvas().style.cursor = '' })
    map.on('mouseenter', 'loot-blip',         () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'loot-blip',         () => { map.getCanvas().style.cursor = '' })

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

  // ── Update bases GeoJSON ─────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return
    ;(map.getSource(BASES_SRC) as maplibregl.GeoJSONSource | undefined)
      ?.setData(buildBasesGeoJSON(bases, currentUserId))
  }, [bases, currentUserId, mapLoaded])

  // ── Update loot GeoJSON ──────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return
    ;(map.getSource(LOOT_SRC) as maplibregl.GeoJSONSource | undefined)
      ?.setData(buildLootGeoJSON(lootSpawns))
  }, [lootSpawns, mapLoaded])

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
    // Place player at detected location and keep 3D pitch
    walkPosRef.current = userLocation
    ;(map.getSource(PLAYER_SRC) as maplibregl.GeoJSONSource | undefined)
      ?.setData(buildPlayerGeoJSON(userLocation))
    map.flyTo({ center: userLocation, zoom: 15, pitch: 55, duration: 1800 })
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

  // ── WASD always active: keyboard listeners ───────────────────────────────────
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return
      const k = walkKeysRef.current
      if (e.code === 'KeyW' || e.code === 'ArrowUp')    { k.w = true; e.preventDefault() }
      if (e.code === 'KeyS' || e.code === 'ArrowDown')  { k.s = true; e.preventDefault() }
      if (e.code === 'KeyA' || e.code === 'ArrowLeft')  { k.a = true; e.preventDefault() }
      if (e.code === 'KeyD' || e.code === 'ArrowRight') { k.d = true; e.preventDefault() }
      if (e.code === 'KeyQ') { k.q = true; e.preventDefault() }
      if (e.code === 'KeyE') { k.e = true; e.preventDefault() }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') k.shift = true
    }
    const onUp = (e: KeyboardEvent) => {
      const k = walkKeysRef.current
      if (e.code === 'KeyW' || e.code === 'ArrowUp')    k.w = false
      if (e.code === 'KeyS' || e.code === 'ArrowDown')  k.s = false
      if (e.code === 'KeyA' || e.code === 'ArrowLeft')  k.a = false
      if (e.code === 'KeyD' || e.code === 'ArrowRight') k.d = false
      if (e.code === 'KeyQ') k.q = false
      if (e.code === 'KeyE') k.e = false
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') k.shift = false
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      walkKeysRef.current = { w: false, a: false, s: false, d: false, q: false, e: false, shift: false }
    }
  }, [])

  // ── Walk RAF loop: always running when map is loaded ─────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    // Init player at map center
    const initC = map.getCenter()
    const initPos: [number, number] = [initC.lng, initC.lat]
    walkPosRef.current = initPos
    ;(map.getSource(PLAYER_SRC) as maplibregl.GeoJSONSource | undefined)
      ?.setData(buildPlayerGeoJSON(initPos))

    const tick = () => {
      const m = mapRef.current
      if (!m) return
      const keys = walkKeysRef.current

      if (keys.q) m.setBearing(m.getBearing() - 2.2)
      if (keys.e) m.setBearing(m.getBearing() + 2.2)

      if (keys.w || keys.a || keys.s || keys.d) {
        const rad = (m.getBearing() * Math.PI) / 180
        const spd = keys.shift ? SPRINT_SPEED : WALK_SPEED
        let dLng = 0, dLat = 0
        if (keys.w) { dLng += Math.sin(rad) * spd; dLat += Math.cos(rad) * spd }
        if (keys.s) { dLng -= Math.sin(rad) * spd; dLat -= Math.cos(rad) * spd }
        if (keys.a) { dLng -= Math.cos(rad) * spd; dLat += Math.sin(rad) * spd }
        if (keys.d) { dLng += Math.cos(rad) * spd; dLat -= Math.sin(rad) * spd }

        const cur = walkPosRef.current
        if (cur) {
          const newPos: [number, number] = [cur[0] + dLng, cur[1] + dLat]
          walkPosRef.current = newPos
          ;(m.getSource(PLAYER_SRC) as maplibregl.GeoJSONSource | undefined)
            ?.setData(buildPlayerGeoJSON(newPos))
          m.setCenter(newPos)
        }
      }

      walkAnimRef.current = requestAnimationFrame(tick)
    }

    walkAnimRef.current = requestAnimationFrame(tick)
    return () => {
      if (walkAnimRef.current) cancelAnimationFrame(walkAnimRef.current)
    }
  }, [mapLoaded])

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

      {mapLoaded && (
        <div className="walk-hint">
          <span className="walk-hint__key">W A S D</span> MOVER
          <span className="walk-hint__sep">·</span>
          <span className="walk-hint__key">Q E</span> GIRAR
          <span className="walk-hint__sep">·</span>
          <span className="walk-hint__key">SHIFT</span> CORRER
          <span className="walk-hint__sep">·</span>
          <span className="walk-hint__key">DRAG</span> CÂMERA
        </div>
      )}
    </div>
  )
}
