import type { MapMarker, MarkerCategory } from './markers'
import { BRAZIL_CITIES } from './cities'
import type { CityMarker } from './cities'

// Seeded LCG pseudo-random number generator
function seededRng(seed: number): () => number {
  let s = (seed ^ 0xdeadbeef) >>> 0
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0
    return s / 4294967296
  }
}

// FNV-1a hash
function hashStr(str: string): number {
  let h = 0x811c9dc5 >>> 0
  for (let i = 0; i < str.length; i++) {
    h = (h ^ str.charCodeAt(i)) >>> 0
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

// ── Name / description pools ───────────────────────────────────────────────────

const NAMES: Record<MarkerCategory, string[]> = {
  outpost: [
    'Posto Delta', 'Base Alfa', 'Torre de Guarda', 'Checkpoint', 'Ninho de Corvos',
    'Acampamento', 'Fortaleza Improvisada', 'Trincheira', 'Barricada', 'Vigia da Colina',
    'Sentinela', 'Ponto de Controle', 'Búnker de Campo', 'Bastião', 'Forte Improvisado',
  ],
  shelter: [
    'Bunker', 'Refúgio', 'Escola Abandonada', 'Convento Isolado', 'Fábrica Selada',
    'Estação de Metrô', 'Porão Secreto', 'Silo de Grãos', 'Igreja Fortalecida',
    'Subsolo Seguro', 'Galpão Fechado', 'Armazém Blindado', 'Cofre Humano',
    'Reserva Oculta', 'Túnel da Paz',
  ],
  danger: [
    'Zona Quente', 'Foco de Contaminação', 'Área de Exclusão', 'Epicentro',
    'Corredor da Morte', 'Bolsão de Infecção', 'Território Perdido', 'Zona Negra',
    'Cemitério Vivo', 'Rua dos Mortos', 'Ninho de Infectados', 'Campo de Ruínas',
    'Zona de Quarentena', 'Perímetro Infectado', 'Vala Comum',
  ],
  supply: [
    'Supermercado Saqueado', 'Depósito Secreto', 'Arsenal Improvisado', 'Farmácia Pilhada',
    'Armazém', 'Contêiner Lacrado', 'Cache de Recursos', 'Estoque de Emergência',
    'Posto de Gasolina', 'Mercado Negro', 'Loja de Ferragens', 'Caixa-Forte',
    'Depósito de Água', 'Celeiro Abandonado', 'Base de Troca',
  ],
  medical: [
    'UPA Improvisada', 'Posto Médico', 'Farmácia', 'Centro de Triagem',
    'Hospital de Campanha', 'Enfermaria', 'Clínica Clandestina', 'Tenda Médica',
    'Lab de Vacina', 'Triagem de Campo', 'Pronto-Socorro Selvagem',
    'Posto de Sangue', 'Cirurgia de Emergência', 'Quarentena Médica',
  ],
  signal: [
    'Antena VHF', 'Torre de Rádio', 'Estação AM', 'Repetidor de Sinal',
    'Ponto de Contato', 'Rádio Pirata', 'Satélite Hackeado', 'Beacon de Emergência',
    'Frequência Militar', 'Centro de Comunicação', 'Transmissor Oculto',
    'Interceptador', 'Farol de Socorro', 'Antena Parabólica',
  ],
}

const DESCS: Record<MarkerCategory, string[]> = {
  outpost: [
    'Grupo armado de sobreviventes', 'Vigilância 24h — armados', 'Barricadas reforçadas',
    'Último bastião da região', 'Aceitam trocas de recursos', 'Rota de suprimentos protegida',
    '8 combatentes em turno', 'Arsenal moderado disponível', 'Patrulha ativa na área',
    'Comunicação com base central', 'Troca de vigia a cada 4h',
  ],
  shelter: [
    'Capacidade para 50 pessoas', 'Água filtrada disponível', 'Gerador funcionando',
    'Entrada camuflada', 'Provisões para 2 semanas', 'Crianças e idosos protegidos',
    'Sem infectados — verificado', 'Dormitórios improvisados', 'Ventilação selada',
    'Saída de emergência no fundo', 'Rações militares disponíveis',
  ],
  danger: [
    'PERIGO — infectados em massa', 'Alta concentração de zumbis', 'Sem retorno possível',
    'Último registro: 3 dias atrás', 'Evitar a todo custo', 'Quarentena ativa',
    'Odor forte detectado', 'Área instável — risco de colapso', 'Movimentação intensa',
    'Armadilhas naturais — cuidado', 'Visibilidade zero à noite',
  ],
  supply: [
    'Comida e água disponíveis', 'Munição em abundância', 'Ferramentas e medicamentos',
    'Pilhado parcialmente', 'Protegido por armadilhas', 'Acesso pelo fundo',
    'Combustível disponível', 'Trocas aceitas', 'Escondido sob escombros',
    'Requer chave para acesso', 'Estoque para 15 dias',
  ],
  medical: [
    'Médico disponível', 'Antibióticos em estoque', 'Cirurgias de emergência',
    'Vacina experimental', 'Cura básica: gratuita', 'Equipamentos limitados',
    'Sangue tipo O+ disponível', 'Anestesia em falta', 'Atendimento 24h',
    'Mortalidade: 12%', 'Anti-soro em desenvolvimento',
  ],
  signal: [
    'Sinal ativo — 89.3 FM', 'Transmite a cada 6 horas', 'Coordenadas de resgates',
    'Mensagens codificadas', 'Frequência de emergência ativa', 'Conecta 3 bases',
    'Alcance: 80km', 'Cifra militar em uso', 'Transmissão intermitente',
    'Bateria: 40% restante', 'Sinal de socorro ativo',
  ],
}

const ALL_CATEGORIES: MarkerCategory[] = ['outpost', 'shelter', 'danger', 'supply', 'medical', 'signal']

// Scatter radius in degrees — larger for bigger cities (lower minzoom = more important)
function cityRadius(minzoom: number): number {
  if (minzoom <= 5) return 0.055
  if (minzoom <= 6) return 0.038
  if (minzoom <= 7) return 0.025
  if (minzoom <= 8) return 0.018
  return 0.012
}

// Zone radius for danger markers — smaller to bigger based on seeded random
function genZoneRadius(rng: () => number): number {
  const roll = rng()
  if (roll < 0.6) return 0.15 + rng() * 0.15  // small:  0.15–0.30 km
  if (roll < 0.9) return 0.30 + rng() * 0.30  // medium: 0.30–0.60 km
  return 0.60 + rng() * 0.40                   // large:  0.60–1.00 km
}

// Generate 50 markers scattered around a city using a deterministic seed
function generateCityMarkers(city: CityMarker): MapMarker[] {
  const rng = seededRng(hashStr(city.id))
  const radius = cityRadius(city.minzoom)
  const [baseLng, baseLat] = city.coordinates
  const markers: MapMarker[] = []

  for (let i = 0; i < 50; i++) {
    const category = ALL_CATEGORIES[Math.floor(rng() * 6)] as MarkerCategory
    const angle = rng() * Math.PI * 2
    // sqrt distribution = even area density (avoids clustering at center)
    const dist = Math.sqrt(rng()) * radius
    const coords: [number, number] = [
      baseLng + Math.cos(angle) * dist,
      baseLat + Math.sin(angle) * dist,
    ]

    const namePool = NAMES[category]
    const descPool = DESCS[category]
    const name = namePool[Math.floor(rng() * namePool.length)]
    const desc = descPool[Math.floor(rng() * descPool.length)]

    markers.push({
      id: `${city.id}-m${i}`,
      name,
      description: desc,
      category,
      coordinates: coords,
      radius: category === 'danger' ? genZoneRadius(rng) : undefined,
    })
  }

  return markers
}

// 46 cities × 50 markers = 2,300 fixed markers, generated deterministically at module load
export const ALL_CITY_MARKERS: MapMarker[] = BRAZIL_CITIES.flatMap(generateCityMarkers)
