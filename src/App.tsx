import { useState, useCallback, useEffect, useMemo } from 'react'
import { MapView } from './components/Map/MapView'
import { Sidebar } from './components/Sidebar/Sidebar'
import { AuthScreen } from './components/Auth/AuthScreen'
import { PlayerHUD } from './components/HUD/PlayerHUD'
import { InventoryPanel } from './components/Inventory/InventoryPanel'
import { BasePanel, BasePlantModal } from './components/Base/BasePanel'
import { StashPanel } from './components/Base/StashPanel'
import { RaidHUD } from './components/Raid/RaidHUD'
import { MARKERS, relocateMarkers, type MapMarker, type MarkerCategory } from './data/markers'
import { useUpdateMyPresence } from './lib/liveblocks.config'
import { supabase, type AuthResult } from './lib/supabase'
import {
  recordAndGetPlayer,
  getPlayer,
  getInventory,
  getBases,
  getLootSpawns,
  getBaseStash,
  plantBase,
  depositToStash,
  withdrawFromStash,
  collectLoot,
  startRaid,
  cancelRaid,
  defendBase,
  getMyActiveRaids,
  getActiveRaidsOnMyBase,
} from './lib/game'
import type { Player, InventoryItem, Base, StashItem, LootSpawn, Raid } from './types/game'
import './App.css'

const ALL_CATEGORIES = new Set<MarkerCategory>([
  'outpost', 'shelter', 'danger', 'supply', 'medical', 'signal',
])

const PRESENCE_COLORS = ['#60a5fa', '#34d399', '#f472b6', '#fb923c', '#a78bfa', '#fbbf24', '#38bdf8', '#f87171', '#4ade80']

function usernameColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return PRESENCE_COLORS[Math.abs(hash) % PRESENCE_COLORS.length]
}

// ── Toast ─────────────────────────────────────────────────────────────────────

interface ToastState { msg: string; type: 'error' | 'success' }

function Toast({ toast }: { toast: ToastState }) {
  return (
    <div className={`game-toast game-toast--${toast.type}`}>
      {toast.type === 'error' ? '✕' : '✓'} {toast.msg}
    </div>
  )
}

// ── AppInner ──────────────────────────────────────────────────────────────────

function AppInner({ username, userId }: { username: string; userId: string }) {
  // ── Map state ──────────────────────────────────────────────────────────────
  const [activeCategories, setActiveCategories] = useState<Set<MarkerCategory>>(ALL_CATEGORIES)
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null)
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
  const updateMyPresence = useUpdateMyPresence()

  // ── Game state ─────────────────────────────────────────────────────────────
  const [player, setPlayer] = useState<Player | null>(null)
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [bases, setBases] = useState<Base[]>([])
  const [lootSpawns, setLootSpawns] = useState<LootSpawn[]>([])
  const [myRaids, setMyRaids] = useState<Raid[]>([])
  const [incomingRaids, setIncomingRaids] = useState<Raid[]>([])
  const [stashItems, setStashItems] = useState<StashItem[]>([])

  // ── UI state ───────────────────────────────────────────────────────────────
  const [selectedBase, setSelectedBase] = useState<Base | null>(null)
  const [showInventory, setShowInventory] = useState(false)
  const [showStash, setShowStash] = useState(false)
  const [plantingMode, setPlantingMode] = useState(false)
  const [pendingPlantCoords, setPendingPlantCoords] = useState<[number, number] | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  // ── Toast helper ───────────────────────────────────────────────────────────
  const showToast = useCallback((msg: string, type: ToastState['type'] = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

  // ── Presence ───────────────────────────────────────────────────────────────
  useEffect(() => {
    updateMyPresence({ name: username, color: usernameColor(username) })
  }, [username, updateMyPresence])

  // ── Geolocation ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation([pos.coords.longitude, pos.coords.latitude]),
      () => {},
      { timeout: 15000, maximumAge: 0, enableHighAccuracy: true },
    )
  }, [])

  // ── Data refresh helpers ───────────────────────────────────────────────────
  const refreshPlayer = useCallback(async () => {
    const p = await getPlayer(userId)
    if (p) setPlayer(p)
  }, [userId])

  const refreshInventory = useCallback(async () => {
    setInventory(await getInventory(userId))
  }, [userId])

  const refreshBases = useCallback(async () => {
    setBases(await getBases())
  }, [])

  const refreshLoot = useCallback(async () => {
    setLootSpawns(await getLootSpawns())
  }, [])

  const refreshRaids = useCallback(async () => {
    const [my, incoming] = await Promise.all([
      getMyActiveRaids(userId),
      getActiveRaidsOnMyBase(userId),
    ])
    setMyRaids(my)
    setIncomingRaids(incoming)
  }, [userId])

  // ── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    recordAndGetPlayer(userId).then((p) => p && setPlayer(p))
    refreshInventory()
    refreshBases()
    refreshLoot()
    refreshRaids()
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Markers ────────────────────────────────────────────────────────────────
  const markers = useMemo(
    () => (userLocation ? relocateMarkers(userLocation) : MARKERS),
    [userLocation],
  )

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleToggleCategory = useCallback((cat: MarkerCategory) => {
    setActiveCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }, [])

  const handleSelectMarker = useCallback(
    (marker: MapMarker | null) => {
      setSelectedMarker(marker)
      updateMyPresence({ selectedMarkerId: marker?.id ?? null })
    },
    [updateMyPresence],
  )

  const handleBaseClick = useCallback((base: Base) => {
    setSelectedBase(base)
    setShowStash(false)
  }, [])

  const handleOpenStash = useCallback(async () => {
    if (!selectedBase) return
    const items = await getBaseStash(selectedBase.id)
    setStashItems(items)
    setShowStash(true)
    setShowInventory(true)
    setSelectedBase(null)
  }, [selectedBase])

  const handleCloseStash = useCallback(() => {
    setShowStash(false)
    setStashItems([])
  }, [])

  const handleLootClick = useCallback(async (loot: LootSpawn) => {
    if (!player) return
    if (inventory.length >= player.inventory_slots) {
      showToast('Inventário cheio. Deposite itens na base primeiro.', 'error')
      return
    }
    try {
      await collectLoot(loot.id, userId, loot.item_catalog_id, loot.item.rarity.slug)
      showToast(`+${loot.item.name} coletado!`)
      await Promise.all([refreshInventory(), refreshPlayer(), refreshLoot()])
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erro ao coletar.', 'error')
    }
  }, [player, inventory, userId, refreshInventory, refreshPlayer, refreshLoot, showToast])

  const handleMapClick = useCallback((lng: number, lat: number) => {
    setPendingPlantCoords([lng, lat])
    setPlantingMode(false)
  }, [])

  const handlePlantConfirm = useCallback(async (name: string) => {
    if (!pendingPlantCoords) return
    await plantBase(userId, name, pendingPlantCoords[1], pendingPlantCoords[0])
    setPendingPlantCoords(null)
    showToast(`Base "${name}" plantada!`)
    await Promise.all([refreshBases(), refreshPlayer()])
  }, [pendingPlantCoords, userId, refreshBases, refreshPlayer, showToast])

  const handleDeposit = useCallback(async (item: InventoryItem) => {
    if (!selectedBase && !showStash) return
    const stashBase = stashItems[0]?.base_id
      ? bases.find(b => b.id === stashItems[0].base_id)
      : null
    const targetBase = stashBase ?? bases.find(b => b.owner_id === userId && b.status === 'ATIVA')
    if (!targetBase) return
    try {
      await depositToStash(
        targetBase.id, item.id, userId, item.item_catalog_id, item.instance_data,
      )
      showToast(`${item.item.name} depositado no stash.`)
      await Promise.all([refreshInventory(), refreshPlayer()])
      // Refresh stash if open
      if (showStash) {
        const updated = await getBaseStash(targetBase.id)
        setStashItems(updated)
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erro ao depositar.', 'error')
    }
  }, [selectedBase, showStash, stashItems, bases, userId, refreshInventory, refreshPlayer, showToast])

  const handleWithdraw = useCallback(async (item: StashItem) => {
    try {
      await withdrawFromStash(item.id, userId, item.item_catalog_id, item.instance_data)
      showToast(`${item.item.name} retirado do stash.`)
      const updated = await getBaseStash(item.base_id)
      setStashItems(updated)
      await refreshInventory()
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erro ao retirar.', 'error')
    }
  }, [userId, refreshInventory, showToast])

  const handleStartRaid = useCallback(async () => {
    if (!selectedBase) return
    try {
      await startRaid(userId, selectedBase.id)
      showToast(`Raid iniciado em "${selectedBase.name}"!`)
      setSelectedBase(null)
      await refreshRaids()
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erro ao iniciar raid.', 'error')
    }
  }, [selectedBase, userId, refreshRaids, showToast])

  const handleCancelRaid = useCallback(async (raidId: string) => {
    try {
      await cancelRaid(raidId)
      showToast('Raid cancelado.')
      await refreshRaids()
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erro ao cancelar.', 'error')
    }
  }, [refreshRaids, showToast])


  const handleDefendBase = useCallback(async (raidId: string) => {
    try {
      await defendBase(raidId)
      showToast('Base defendida com sucesso!')
      await refreshRaids()
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erro ao defender.', 'error')
    }
  }, [refreshRaids, showToast])

  // Active raid on selected base (for BasePanel)
  const activeRaidOnSelected = selectedBase
    ? [...myRaids, ...incomingRaids].find(r => r.base_id === selectedBase.id && r.status === 'PENDENTE') ?? null
    : null

  // Can deposit: stash is open and inventory is open and the stash base is own
  const canDeposit = showStash && showInventory

  return (
    <div className="app">
      <Sidebar
        username={username}
        activeCategories={activeCategories}
        markers={markers}
        selectedMarker={selectedMarker}
        onToggleCategory={handleToggleCategory}
        onSelectMarker={handleSelectMarker}
      />

      <main className={`app__map ${plantingMode ? 'app__map--planting' : ''}`}>
        <MapView
          markers={markers}
          activeCategories={activeCategories}
          selectedMarker={selectedMarker}
          onMarkerClick={handleSelectMarker}
          userLocation={userLocation}
          bases={bases}
          lootSpawns={lootSpawns}
          currentUserId={userId}
          onBaseClick={handleBaseClick}
          onLootClick={handleLootClick}
          onMapClick={handleMapClick}
          plantingMode={plantingMode}
        />

        {/* Player HUD — top right */}
        {player && (
          <PlayerHUD
            player={player}
            showInventory={showInventory}
            plantingMode={plantingMode}
            onToggleInventory={() => setShowInventory((v) => !v)}
            onStartPlanting={() => setPlantingMode(true)}
            onCancelPlanting={() => setPlantingMode(false)}
          />
        )}

        {/* Inventory panel — right side */}
        {showInventory && player && (
          <InventoryPanel
            inventory={inventory}
            maxSlots={player.inventory_slots}
            selectedBase={canDeposit ? (bases.find(b => b.id === stashItems[0]?.base_id) ?? null) : null}
            onClose={() => setShowInventory(false)}
            onDeposit={canDeposit ? handleDeposit : undefined}
          />
        )}

        {/* Stash panel — left side */}
        {showStash && stashItems.length >= 0 && bases.find(b => b.id === stashItems[0]?.base_id) ? (
          <StashPanel
            base={bases.find(b => b.id === stashItems[0]?.base_id)!}
            stashItems={stashItems}
            onClose={handleCloseStash}
            onWithdraw={showInventory ? handleWithdraw : undefined}
          />
        ) : showStash && player ? (
          // Stash open but we need to find base differently (own base with stash)
          <StashPanel
            base={bases.find(b => b.owner_id === userId && b.status === 'ATIVA') ?? bases[0]}
            stashItems={stashItems}
            onClose={handleCloseStash}
            onWithdraw={showInventory ? handleWithdraw : undefined}
          />
        ) : null}

        {/* Base info panel — bottom center */}
        {selectedBase && (
          <BasePanel
            base={selectedBase}
            currentUserId={userId}
            activeRaid={activeRaidOnSelected}
            onClose={() => setSelectedBase(null)}
            onOpenStash={handleOpenStash}
            onStartRaid={handleStartRaid}
          />
        )}

        {/* Raid timers — above base panel */}
        <RaidHUD
          myRaids={myRaids}
          incomingRaids={incomingRaids}
          bases={bases}
          onCancelRaid={handleCancelRaid}
          onDefendBase={handleDefendBase}
        />

        {/* Base plant modal */}
        {pendingPlantCoords && (
          <BasePlantModal
            coords={pendingPlantCoords}
            onConfirm={handlePlantConfirm}
            onCancel={() => setPendingPlantCoords(null)}
          />
        )}

        {/* Toast notifications */}
        {toast && <Toast toast={toast} />}
      </main>
    </div>
  )
}

// ── Root App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [authUser, setAuthUser] = useState<AuthResult | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const username =
          (session.user.user_metadata?.username as string | undefined) ||
          session.user.email?.split('@')[0] ||
          'Sobrevivente'
        setAuthUser({ username, userId: session.user.id, isNew: false })
      }
      setSessionLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user) {
        const username =
          (session.user.user_metadata?.username as string | undefined) ||
          session.user.email?.split('@')[0] ||
          'Sobrevivente'
        setAuthUser({ username, userId: session.user.id, isNew: false })
      } else {
        setAuthUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (sessionLoading) {
    return (
      <div className="map-loading">
        <div className="map-loading__spinner" />
        <span className="map-loading__text">CARREGANDO...</span>
      </div>
    )
  }

  if (!authUser) {
    return <AuthScreen onAuth={setAuthUser} />
  }

  return <AppInner username={authUser.username} userId={authUser.userId} />
}
