export type MarkerCategory =
  | 'outpost'
  | 'shelter'
  | 'danger'
  | 'supply'
  | 'medical'
  | 'signal'

export interface MapMarker {
  id: string
  name: string
  description: string
  category: MarkerCategory
  coordinates: [number, number] // [lng, lat]
  radius?: number // infection zone radius in km (danger markers only)
}

export const CATEGORIES: Record<MarkerCategory, { label: string; color: string; icon: string }> = {
  outpost: { label: 'Posto Avançado',  color: '#888888', icon: '▲' },
  shelter: { label: 'Abrigo',          color: '#888888', icon: '⌂' },
  danger:  { label: 'Zona Infectada',  color: '#888888', icon: '✕' },
  supply:  { label: 'Suprimentos',     color: '#888888', icon: '◈' },
  medical: { label: 'Médico',          color: '#888888', icon: '✚' },
  signal:  { label: 'Sinal / Rádio',   color: '#888888', icon: '◎' },
}

export const BASE_CENTER: [number, number] = [-46.633, -23.55]

const OFFSETS: Array<Omit<MapMarker, 'coordinates'> & { offset: [number, number] }> = [
  {
    id: '1',
    name: 'Posto Avançado Central',
    description: 'Grupo de sobreviventes — 12 pessoas',
    category: 'outpost',
    offset: [0, 0],
  },
  {
    id: '2',
    name: 'Abrigo Subterrâneo',
    description: 'Bunker com suprimentos para 30 dias',
    category: 'shelter',
    offset: [-0.022, -0.015],
  },
  {
    id: '3',
    name: 'Zona Infectada Norte',
    description: 'PERIGO — Alta concentração de infectados',
    category: 'danger',
    offset: [-0.007, 0.018],
    radius: 1.2,
  },
  {
    id: '4',
    name: 'Depósito de Suprimentos',
    description: 'Comida, água e equipamentos',
    category: 'supply',
    offset: [0.013, -0.02],
  },
  {
    id: '5',
    name: 'Posto Médico',
    description: 'Médico disponível — antibióticos em estoque',
    category: 'medical',
    offset: [-0.015, -0.008],
  },
  {
    id: '6',
    name: 'Torre de Rádio',
    description: 'Sinal ativo — frequência 89.3 FM',
    category: 'signal',
    offset: [-0.027, 0.002],
  },
  {
    id: '7',
    name: 'Acampamento Leste',
    description: 'Posto de vigilância — 4 sentinelas',
    category: 'outpost',
    offset: [0.008, 0.015],
  },
  {
    id: '8',
    name: 'Abrigo Costeiro',
    description: 'Embarcações disponíveis para fuga',
    category: 'shelter',
    offset: [-0.037, -0.01],
  },
  {
    id: '9',
    name: 'Zona Morta Sul',
    description: 'BLOQUEADO — Passagem comprometida',
    category: 'danger',
    offset: [0.003, -0.025],
    radius: 0.85,
  },
  {
    id: '10',
    name: 'Cache de Recursos',
    description: 'Armamento e mantimentos escondidos',
    category: 'supply',
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
