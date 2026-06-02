import type { MarkerCategory } from './markers'

export interface CityMarker {
  id: string
  name: string
  coordinates: [number, number] // [lng, lat]
  category: MarkerCategory
  minzoom: number // only show at this zoom level or closer
}

// Brazilian cities with real coordinates.
// minzoom: the minimum map zoom level at which each city becomes visible.
// Lower minzoom = more important city (appears when more zoomed out).
export const BRAZIL_CITIES: CityMarker[] = [
  // ── Metrópoles (aparecem no zoom 5+) ─────────────────────────────────────
  { id: 'sao-paulo',      name: 'São Paulo',         coordinates: [-46.6333, -23.5505], category: 'danger',  minzoom: 5 },
  { id: 'rio',            name: 'Rio de Janeiro',    coordinates: [-43.1729, -22.9068], category: 'danger',  minzoom: 5 },
  { id: 'brasilia',       name: 'Brasília',           coordinates: [-47.9292, -15.7801], category: 'outpost', minzoom: 5 },
  { id: 'salvador',       name: 'Salvador',           coordinates: [-38.5016, -12.9714], category: 'shelter', minzoom: 5 },
  { id: 'fortaleza',      name: 'Fortaleza',          coordinates: [-38.5434, -3.7172],  category: 'danger',  minzoom: 5 },
  { id: 'bh',             name: 'Belo Horizonte',     coordinates: [-43.9378, -19.9191], category: 'medical', minzoom: 5 },
  { id: 'manaus',         name: 'Manaus',             coordinates: [-60.0212, -3.1019],  category: 'danger',  minzoom: 5 },

  // ── Capitais estaduais grandes (zoom 6+) ─────────────────────────────────
  { id: 'curitiba',       name: 'Curitiba',           coordinates: [-49.2654, -25.4284], category: 'shelter', minzoom: 6 },
  { id: 'recife',         name: 'Recife',             coordinates: [-34.8630, -8.0476],  category: 'supply',  minzoom: 6 },
  { id: 'goiania',        name: 'Goiânia',            coordinates: [-49.2539, -16.6864], category: 'outpost', minzoom: 6 },
  { id: 'belem',          name: 'Belém',              coordinates: [-48.5044, -1.4558],  category: 'danger',  minzoom: 6 },
  { id: 'porto-alegre',   name: 'Porto Alegre',       coordinates: [-51.2177, -30.0346], category: 'shelter', minzoom: 6 },
  { id: 'sao-luis',       name: 'São Luís',           coordinates: [-44.3028, -2.5307],  category: 'supply',  minzoom: 6 },
  { id: 'maceio',         name: 'Maceió',             coordinates: [-35.7172, -9.6658],  category: 'signal',  minzoom: 6 },
  { id: 'natal',          name: 'Natal',              coordinates: [-35.2094, -5.7945],  category: 'signal',  minzoom: 6 },
  { id: 'campo-grande',   name: 'Campo Grande',       coordinates: [-54.6461, -20.4697], category: 'outpost', minzoom: 6 },
  { id: 'teresina',       name: 'Teresina',           coordinates: [-42.8019, -5.0892],  category: 'medical', minzoom: 6 },
  { id: 'guarulhos',      name: 'Guarulhos',          coordinates: [-46.5333, -23.4628], category: 'danger',  minzoom: 6 },

  // ── Demais capitais (zoom 7+) ─────────────────────────────────────────────
  { id: 'joao-pessoa',    name: 'João Pessoa',        coordinates: [-34.8641, -7.1195],  category: 'supply',  minzoom: 7 },
  { id: 'aracaju',        name: 'Aracaju',            coordinates: [-37.0731, -10.9472], category: 'signal',  minzoom: 7 },
  { id: 'porto-velho',    name: 'Porto Velho',        coordinates: [-63.9004, -8.7612],  category: 'outpost', minzoom: 7 },
  { id: 'cuiaba',         name: 'Cuiabá',             coordinates: [-56.0979, -15.5961], category: 'shelter', minzoom: 7 },
  { id: 'macapa',         name: 'Macapá',             coordinates: [-51.0664, 0.0389],   category: 'signal',  minzoom: 7 },
  { id: 'boa-vista',      name: 'Boa Vista',          coordinates: [-60.6712, 2.8235],   category: 'outpost', minzoom: 7 },
  { id: 'palmas',         name: 'Palmas',             coordinates: [-48.3243, -10.2128], category: 'signal',  minzoom: 7 },
  { id: 'rio-branco',     name: 'Rio Branco',         coordinates: [-67.8099, -9.9754],  category: 'outpost', minzoom: 7 },
  { id: 'florianopolis',  name: 'Florianópolis',      coordinates: [-48.5482, -27.5954], category: 'shelter', minzoom: 7 },
  { id: 'vitoria',        name: 'Vitória',            coordinates: [-40.3128, -20.3155], category: 'medical', minzoom: 7 },

  // ── Cidades importantes (zoom 8+) ─────────────────────────────────────────
  { id: 'campinas',       name: 'Campinas',           coordinates: [-47.0626, -22.9099], category: 'supply',  minzoom: 8 },
  { id: 'ribeirao-preto', name: 'Ribeirão Preto',     coordinates: [-47.8099, -21.1704], category: 'medical', minzoom: 8 },
  { id: 'uberlandia',     name: 'Uberlândia',         coordinates: [-48.2882, -18.9186], category: 'supply',  minzoom: 8 },
  { id: 'londrina',       name: 'Londrina',           coordinates: [-51.1669, -23.3045], category: 'shelter', minzoom: 8 },
  { id: 'sorocaba',       name: 'Sorocaba',           coordinates: [-47.4581, -23.5015], category: 'outpost', minzoom: 8 },
  { id: 'feira-santana',  name: 'Feira de Santana',   coordinates: [-38.9661, -12.2664], category: 'supply',  minzoom: 8 },
  { id: 'joinville',      name: 'Joinville',          coordinates: [-48.8496, -26.3044], category: 'outpost', minzoom: 8 },
  { id: 'juiz-fora',      name: 'Juiz de Fora',       coordinates: [-43.3496, -21.7642], category: 'medical', minzoom: 8 },
  { id: 'caxias-sul',     name: 'Caxias do Sul',      coordinates: [-51.1737, -29.1681], category: 'supply',  minzoom: 8 },
  { id: 'maringa',        name: 'Maringá',            coordinates: [-51.9331, -23.4273], category: 'supply',  minzoom: 8 },
  { id: 'sao-jose-campos',name: 'São José dos Campos',coordinates: [-45.8872, -23.1896], category: 'signal',  minzoom: 8 },
  { id: 'santos',         name: 'Santos',             coordinates: [-46.3308, -23.9608], category: 'shelter', minzoom: 8 },
  { id: 'contagem',       name: 'Contagem',           coordinates: [-44.0528, -19.9317], category: 'outpost', minzoom: 8 },
  { id: 'blumenau',       name: 'Blumenau',           coordinates: [-49.0661, -26.9194], category: 'shelter', minzoom: 9 },
  { id: 'pelotas',        name: 'Pelotas',            coordinates: [-52.3382, -31.7654], category: 'supply',  minzoom: 9 },
  { id: 'caucaia',        name: 'Caucaia',            coordinates: [-38.6533, -3.7338],  category: 'danger',  minzoom: 9 },
  { id: 'caruaru',        name: 'Caruaru',            coordinates: [-36.0249, -8.2760],  category: 'signal',  minzoom: 9 },
  { id: 'imperatriz',     name: 'Imperatriz',         coordinates: [-47.4916, -5.5260],  category: 'outpost', minzoom: 9 },
  { id: 'anapolis',       name: 'Anápolis',           coordinates: [-48.9528, -16.3281], category: 'supply',  minzoom: 9 },
]
