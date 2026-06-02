export interface Player {
  id: string
  username: string
  rad_balance: number
  inventory_slots: number
  streak_days: number
  last_login_at: string
  created_at?: string
}

export interface ItemRarity {
  id: number
  slug: string
  label: string
  color_hex: string
  utility_level: number
  drop_weight: number
}

export interface ItemType {
  id: number
  slug: string
  label: string
  icon: string
}

export interface ItemCatalog {
  id: string
  name: string
  slug: string
  item_type_id: number
  rarity_id: number
  description: string | null
  icon: string | null
  attributes: Record<string, unknown>
  craftable: boolean
  lootable: boolean
  item_type: ItemType
  rarity: ItemRarity
}

export interface InventoryItem {
  id: string
  player_id: string
  item_catalog_id: string
  instance_data: Record<string, unknown>
  acquired_from: string | null
  created_at: string
  item: ItemCatalog
}

export interface Base {
  id: string
  owner_id: string
  name: string
  lat: number
  lng: number
  level: number
  status: 'ATIVA' | 'RUÍNA' | 'DESTRUÍDA'
  stash_slots: number
  daily_cost: number
  last_active_at: string
  ruin_at: string | null
  destroyed_at: string | null
  attributes: Record<string, unknown>
  created_at: string
  updated_at: string
  owner_username?: string
}

export interface StashItem {
  id: string
  base_id: string
  item_catalog_id: string
  deposited_by: string
  instance_data: Record<string, unknown>
  deposited_at: string
  item: ItemCatalog
}

export interface LootSpawn {
  id: string
  item_catalog_id: string
  lat: number
  lng: number
  spawned_at: string
  expires_at: string
  collected_by: string | null
  collected_at: string | null
  spawn_reason: 'RANDOM' | 'EVENTO' | 'HORDA' | 'MISSÃO'
  item: ItemCatalog
}

export interface Raid {
  id: string
  raider_id: string
  base_id: string
  status: 'PENDENTE' | 'CONCLUÍDO' | 'CANCELADO' | 'DEFENDIDO'
  started_at: string
  resolves_at: string
  resolved_at: string | null
  items_taken: unknown[]
  cancelled_by: string | null
  cancel_reason: string | null
  attributes: Record<string, unknown>
  created_at: string
}
