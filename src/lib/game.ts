import { supabase } from './supabase'
import type { Player, InventoryItem, Base, StashItem, LootSpawn, Raid, RaidHistoryEntry } from '../types/game'

const ITEM_FIELDS = `
  id, name, slug, icon, description, attributes, craftable, lootable,
  item_type:item_types!item_type_id(id, slug, label, icon),
  rarity:item_rarities!rarity_id(id, slug, label, color_hex, utility_level, drop_weight)
`

export const LOOT_RAD_REWARD: Record<string, number> = {
  NORMAL:   15,
  INCOMUM:  25,
  RARO:     40,
  LENDÁRIO: 60,
  ÚNICO:    80,
  ARTEFATO: 100,
}

export const RARITY_COLORS: Record<string, string> = {
  NORMAL:    '#9ca3af',
  INCOMUM:   '#4ade80',
  RARO:      '#60a5fa',
  LENDÁRIO:  '#f59e0b',
  ÚNICO:     '#ec4899',
  ARTEFATO:  '#8b5cf6',
}

export async function recordAndGetPlayer(playerId: string): Promise<Player | null> {
  try { await supabase.rpc('record_login', { p_player_id: playerId }) } catch {}
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('id', playerId)
    .single()
  if (error || !data) return null
  return data as Player
}

export async function savePlayerPosition(playerId: string, lng: number, lat: number): Promise<void> {
  await supabase
    .from('players')
    .update({ last_lng: lng, last_lat: lat })
    .eq('id', playerId)
}

export async function getPlayer(playerId: string): Promise<Player | null> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('id', playerId)
    .single()
  if (error || !data) return null
  return data as Player
}

export async function getInventory(playerId: string): Promise<InventoryItem[]> {
  const { data, error } = await supabase
    .from('player_inventory')
    .select(`*, item:items_catalog!item_catalog_id(${ITEM_FIELDS})`)
    .eq('player_id', playerId)
    .order('created_at', { ascending: true })
  if (error) return []
  return (data || []) as unknown as InventoryItem[]
}

export async function getBases(): Promise<Base[]> {
  const { data, error } = await supabase
    .from('bases')
    .select('*, owner:players!owner_id(username)')
    .neq('status', 'DESTRUÍDA')
  if (error) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data || []).map((b: any) => ({ ...b, owner_username: b.owner?.username })) as Base[]
}

export async function plantBase(
  ownerId: string,
  name: string,
  lat: number,
  lng: number,
): Promise<Base> {
  const { error: debitErr } = await supabase.rpc('debit_rad', {
    p_player_id: ownerId,
    p_type_slug: 'PLANTAR_BASE',
    p_amount: 250,
    p_description: `Plantar base: ${name}`,
  })
  if (debitErr) {
    const msg = debitErr.message.includes('RAD_INSUFICIENTE')
      ? 'RAD insuficiente. Precisa de 250 RAD para plantar uma base.'
      : debitErr.message
    throw new Error(msg)
  }

  const { data, error } = await supabase
    .from('bases')
    .insert({ owner_id: ownerId, name, lat, lng })
    .select()
    .single()
  if (error) {
    try {
      await supabase.rpc('credit_rad', {
        p_player_id: ownerId,
        p_type_slug: 'AJUSTE_SISTEMA',
        p_amount: 250,
        p_description: 'Estorno: falha ao criar base',
      })
    } catch {}
    const msg = error.message.includes('LIMITE_DE_BASES')
      ? 'Você já possui uma base ativa.'
      : error.message
    throw new Error(msg)
  }
  return data as Base
}

export const STASH_SLOT_COST = 20
export const STASH_SLOT_MAX  = 50

export async function buyStashSlot(baseId: string, playerId: string): Promise<number> {
  const { data, error } = await supabase.rpc('buy_stash_slot', {
    p_base_id: baseId,
    p_player_id: playerId,
  })
  if (error) {
    let msg = error.message
    if (msg.includes('RAD_INSUFICIENTE')) msg = `RAD insuficiente. Cada slot custa ${STASH_SLOT_COST} RAD.`
    if (msg.includes('STASH_MÁXIMO'))     msg = `Limite máximo de ${STASH_SLOT_MAX} slots atingido.`
    if (msg.includes('BASE_INATIVA'))     msg = 'Não é possível expandir uma base em ruína.'
    if (msg.includes('ACESSO_NEGADO'))    msg = 'Somente o dono pode expandir o stash.'
    throw new Error(msg)
  }
  return data as number
}

export async function getBaseStash(baseId: string): Promise<StashItem[]> {
  const { data, error } = await supabase
    .from('base_stash')
    .select(`*, item:items_catalog!item_catalog_id(${ITEM_FIELDS})`)
    .eq('base_id', baseId)
  if (error) return []
  return (data || []) as unknown as StashItem[]
}

export async function depositToStash(
  baseId: string,
  inventoryItemId: string,
  playerId: string,
  itemCatalogId: string,
  instanceData: Record<string, unknown>,
): Promise<void> {
  const { error: stashErr } = await supabase.from('base_stash').insert({
    base_id: baseId,
    item_catalog_id: itemCatalogId,
    deposited_by: playerId,
    instance_data: instanceData,
  })
  if (stashErr) {
    const msg = stashErr.message.includes('STASH_CHEIO')
      ? 'Stash da base está cheio.'
      : stashErr.message
    throw new Error(msg)
  }
  const { error: invErr } = await supabase
    .from('player_inventory')
    .delete()
    .eq('id', inventoryItemId)
  if (invErr) throw new Error(invErr.message)
}

export async function withdrawFromStash(
  stashItemId: string,
  playerId: string,
  itemCatalogId: string,
  instanceData: Record<string, unknown>,
): Promise<void> {
  const { error: invErr } = await supabase.from('player_inventory').insert({
    player_id: playerId,
    item_catalog_id: itemCatalogId,
    instance_data: instanceData,
    acquired_from: 'STASH',
  })
  if (invErr) {
    const msg = invErr.message.includes('INVENTÁRIO_CHEIO')
      ? 'Inventário pessoal está cheio.'
      : invErr.message
    throw new Error(msg)
  }
  const { error: stashErr } = await supabase
    .from('base_stash')
    .delete()
    .eq('id', stashItemId)
  if (stashErr) throw new Error(stashErr.message)
}

export async function getLootSpawns(): Promise<LootSpawn[]> {
  const { data, error } = await supabase
    .from('loot_spawns')
    .select(`*, item:items_catalog!item_catalog_id(${ITEM_FIELDS})`)
    .is('collected_at', null)
    .gt('expires_at', new Date().toISOString())
  if (error) return []
  return (data || []) as unknown as LootSpawn[]
}

export async function collectLoot(
  lootId: string,
  playerId: string,
  itemCatalogId: string,
  raritySlug: string,
): Promise<void> {
  const { error: lootErr } = await supabase
    .from('loot_spawns')
    .update({ collected_by: playerId, collected_at: new Date().toISOString() })
    .eq('id', lootId)
    .is('collected_at', null)
  if (lootErr) throw new Error('Loot já foi coletado.')

  const { error: invErr } = await supabase.from('player_inventory').insert({
    player_id: playerId,
    item_catalog_id: itemCatalogId,
    acquired_from: 'LOOT',
  })
  if (invErr) {
    try {
      await supabase
        .from('loot_spawns')
        .update({ collected_by: null, collected_at: null })
        .eq('id', lootId)
    } catch {}
    const msg = invErr.message.includes('INVENTÁRIO_CHEIO')
      ? 'Inventário cheio. Deposite itens na base primeiro.'
      : invErr.message
    throw new Error(msg)
  }

  const radAmount = LOOT_RAD_REWARD[raritySlug] ?? 15
  try {
    await supabase.rpc('credit_rad', {
      p_player_id: playerId,
      p_type_slug: 'COLETAR_LOOT',
      p_amount: radAmount,
      p_description: 'Coletou loot do mapa',
      p_ref_loot_id: lootId,
    })
  } catch {}
}

export async function startRaid(raiderId: string, baseId: string): Promise<Raid> {
  const { data, error } = await supabase
    .from('raids')
    .insert({ raider_id: raiderId, base_id: baseId })
    .select()
    .single()
  if (error) {
    let msg = error.message
    if (msg.includes('RAID_INVÁLIDO')) msg = 'Você não pode invadir sua própria base.'
    if (msg.includes('BASE_EM_RUÍNA')) msg = 'Base em ruína — acesse o loot diretamente.'
    if (msg.includes('unique') || msg.includes('idx_raids_unique_pending'))
      msg = 'Esta base já está sendo invadida.'
    if (msg.includes('RAID_COOLDOWN')) {
      const match = msg.match(/(\d{4}-\d{2}-\d{2}T[\d:.+\-Z]+)/)
      if (match) {
        const when = new Date(match[1])
        msg = `Cooldown ativo. Próximo raid disponível às ${when.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} de ${when.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}.`
      } else {
        msg = 'Cooldown ativo. Aguarde 12h desde o último raid.'
      }
    }
    throw new Error(msg)
  }
  return data as Raid
}

export async function cancelRaid(raidId: string): Promise<void> {
  const { error } = await supabase
    .from('raids')
    .update({ status: 'CANCELADO', cancelled_by: 'RAIDER' })
    .eq('id', raidId)
    .eq('status', 'PENDENTE')
  if (error) throw new Error(error.message)
}

export async function defendBase(raidId: string): Promise<void> {
  const { error } = await supabase
    .from('raids')
    .update({
      status: 'DEFENDIDO',
      cancelled_by: 'OWNER',
      resolved_at: new Date().toISOString(),
    })
    .eq('id', raidId)
    .eq('status', 'PENDENTE')
  if (error) throw new Error(error.message)
}

export async function getMyActiveRaids(raiderId: string): Promise<Raid[]> {
  const { data, error } = await supabase
    .from('raids')
    .select('*')
    .eq('raider_id', raiderId)
    .eq('status', 'PENDENTE')
  if (error) return []
  return (data || []) as Raid[]
}

export async function getActiveRaidsOnMyBase(ownerId: string): Promise<Raid[]> {
  const { data: myBase } = await supabase
    .from('bases')
    .select('id')
    .eq('owner_id', ownerId)
    .eq('status', 'ATIVA')
    .maybeSingle()
  if (!myBase) return []

  const { data, error } = await supabase
    .from('raids')
    .select('*')
    .eq('base_id', myBase.id)
    .eq('status', 'PENDENTE')
  if (error) return []
  return (data || []) as Raid[]
}

export async function getBaseRaidHistory(baseId: string): Promise<RaidHistoryEntry[]> {
  const { data, error } = await supabase
    .from('raids')
    .select('*, raider:players!raider_id(username)')
    .eq('base_id', baseId)
    .order('started_at', { ascending: false })
    .limit(30)
  if (error) return []
  return (data || []) as RaidHistoryEntry[]
}
