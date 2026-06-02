export type MarkerCategory =
  | 'weapons'
  | 'vehicles'
  | 'missions'
  | 'safehouses'
  | 'services'
  | 'events'

export interface MapMarker {
  id: string
  name: string
  description: string
  category: MarkerCategory
  coordinates: [number, number] // [lng, lat]
}

export const CATEGORIES: Record<MarkerCategory, { label: string; color: string; icon: string }> = {
  weapons:    { label: 'Armas',    color: '#aaaaaa', icon: '🔫' },
  vehicles:   { label: 'Veículos', color: '#cccccc', icon: '🚗' },
  missions:   { label: 'Missões',  color: '#e0e0e0', icon: '⭐' },
  safehouses: { label: 'Abrigos',  color: '#777777', icon: '🏠' },
  services:   { label: 'Serviços', color: '#999999', icon: '🔧' },
  events:     { label: 'Eventos',  color: '#bbbbbb', icon: '❗' },
}

// Base center used to calculate relative offsets for each marker.
// When the user's geolocation is known, markers are relocated around it.
export const BASE_CENTER: [number, number] = [-46.633, -23.55]

// Coordinates stored as offsets from BASE_CENTER so they stay relative
// to whatever center we end up using (user's location).
const OFFSETS: Array<Omit<MapMarker, 'coordinates'> & { offset: [number, number] }> = [
  {
    id: '1',
    name: 'Loja de Armas - Centro',
    description: 'Armamento completo disponível 24h',
    category: 'weapons',
    offset: [0, 0],
  },
  {
    id: '2',
    name: 'Oficina Mecânica',
    description: 'Reparos e modificações de veículos',
    category: 'vehicles',
    offset: [-0.022, -0.015],
  },
  {
    id: '3',
    name: 'Missão: O Grande Roubo',
    description: 'Nível recomendado: 15+',
    category: 'missions',
    offset: [-0.007, 0.005],
  },
  {
    id: '4',
    name: 'Abrigo Seguro - Norte',
    description: 'Save point e armazenamento',
    category: 'safehouses',
    offset: [0.008, 0.015],
  },
  {
    id: '5',
    name: 'Hospital Central',
    description: 'Recuperação total: $500',
    category: 'services',
    offset: [-0.015, -0.008],
  },
  {
    id: '6',
    name: 'Evento: Corrida Noturna',
    description: 'Todo sábado às 22h',
    category: 'events',
    offset: [-0.027, 0.002],
  },
  {
    id: '7',
    name: 'Depósito de Armas',
    description: 'Item raro: Sniper disponível',
    category: 'weapons',
    offset: [0.013, -0.02],
  },
  {
    id: '8',
    name: 'Porto de Veículos',
    description: 'Barcos e motos aquáticas',
    category: 'vehicles',
    offset: [-0.037, -0.01],
  },
  {
    id: '9',
    name: 'Missão: Perseguição',
    description: 'Recompensa: $10.000',
    category: 'missions',
    offset: [0.003, -0.025],
  },
  {
    id: '10',
    name: 'Abrigo - Zona Sul',
    description: 'Garagem para 3 veículos',
    category: 'safehouses',
    offset: [-0.012, -0.03],
  },
]

function buildMarkers(center: [number, number]): MapMarker[] {
  return OFFSETS.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    category: m.category,
    coordinates: [
      center[0] + m.offset[0],
      center[1] + m.offset[1],
    ] as [number, number],
  }))
}

export const MARKERS: MapMarker[] = buildMarkers(BASE_CENTER)

export function relocateMarkers(userCenter: [number, number]): MapMarker[] {
  return buildMarkers(userCenter)
}
