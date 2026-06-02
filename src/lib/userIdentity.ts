const ADJECTIVES = ['Veloz', 'Sombrio', 'Neon', 'Furtivo', 'Épico', 'Brutal', 'Caótico', 'Digital', 'Nômade', 'Lendário']
const NOUNS = ['Piloto', 'Gangsta', 'Agente', 'Sniper', 'Runner', 'Hacker', 'Soldado', 'Fugitivo', 'Detetive']
const COLORS = ['#60a5fa', '#34d399', '#f472b6', '#fb923c', '#a78bfa', '#fbbf24', '#38bdf8', '#f87171', '#4ade80']

const STORAGE_KEY = 'gta-map-identity'

export interface UserIdentity {
  name: string
  color: string
}

export function getUserIdentity(): UserIdentity {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored) as UserIdentity
  } catch {}

  const name = [
    ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)],
    NOUNS[Math.floor(Math.random() * NOUNS.length)],
  ].join(' ')
  const color = COLORS[Math.floor(Math.random() * COLORS.length)]
  const identity: UserIdentity = { name, color }

  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(identity)) } catch {}
  return identity
}
