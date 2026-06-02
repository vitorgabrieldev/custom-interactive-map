import { useState } from 'react'
import type { Base, StashItem, InventoryItem, Player, RaidHistoryEntry } from '../../types/game'
import { STASH_SLOT_COST, STASH_SLOT_MAX } from '../../lib/game'
import './StashPanel.css'
import './BaseView.css'

interface BaseViewProps {
  base: Base
  stashItems: StashItem[]
  inventory: InventoryItem[]
  player: Player
  isOwner: boolean
  raids: RaidHistoryEntry[]
  onClose: () => void
  onWithdraw?: (item: StashItem) => Promise<void>
  onDeposit?: (item: InventoryItem) => Promise<void>
  onBuySlot?: () => Promise<void>
}

export function BaseView({
  base, stashItems, inventory, player, isOwner, raids,
  onClose, onWithdraw, onDeposit, onBuySlot,
}: BaseViewProps) {
  const [hoveredStash, setHoveredStash] = useState<StashItem | null>(null)
  const [hoveredInv, setHoveredInv]     = useState<InventoryItem | null>(null)
  const [withdrawing, setWithdrawing]   = useState<string | null>(null)
  const [depositing, setDepositing]     = useState<string | null>(null)
  const [buyingSlot, setBuyingSlot]     = useState(false)

  const canBuy     = isOwner && base.status === 'ATIVA' && base.stash_slots < STASH_SLOT_MAX
  const hasRadSlot = player.rad_balance >= STASH_SLOT_COST

  type StashCell =
    | { type: 'item';  item: StashItem }
    | { type: 'empty'; index: number }
    | { type: 'buy' }

  const stashCells: StashCell[] = []
  for (let i = 0; i < base.stash_slots; i++) {
    const item = stashItems[i]
    stashCells.push(item ? { type: 'item', item } : { type: 'empty', index: i })
  }
  if (canBuy) stashCells.push({ type: 'buy' })

  async function handleWithdraw(item: StashItem) {
    if (!onWithdraw) return
    setWithdrawing(item.id)
    try { await onWithdraw(item) } finally { setWithdrawing(null) }
  }

  async function handleDeposit(item: InventoryItem) {
    if (!onDeposit) return
    setDepositing(item.id)
    try { await onDeposit(item) } finally { setDepositing(null) }
  }

  async function handleBuySlot() {
    if (!onBuySlot || buyingSlot) return
    setBuyingSlot(true)
    try { await onBuySlot() } finally { setBuyingSlot(false) }
  }

  const statusClass = base.status === 'ATIVA' ? 'active' : 'ruin'

  return (
    <div className="base-view">
      <div className="base-view__header">
        <div className="base-view__header-left">
          <span className="base-view__icon">⌂</span>
          <span className="base-view__name">{base.name.toUpperCase()}</span>
          <span className={`base-view__status base-view__status--${statusClass}`}>{base.status}</span>
        </div>
        <button className="base-view__close" onClick={onClose}>✕</button>
      </div>

      <div className="base-view__body">

        {/* ── Informações ── */}
        <section className="base-view__section">
          <div className="base-view__section-title">INFORMAÇÕES</div>
          <div className="base-view__info-grid">
            <div className="base-view__stat">
              <span className="base-view__stat-label">CRIADA</span>
              <span className="base-view__stat-value">{fmt(base.created_at)}</span>
            </div>
            <div className="base-view__stat">
              <span className="base-view__stat-label">NÍVEL</span>
              <span className="base-view__stat-value">{base.level}</span>
            </div>
            <div className="base-view__stat">
              <span className="base-view__stat-label">CUSTO/DIA</span>
              <span className="base-view__stat-value">{base.daily_cost} RAD</span>
            </div>
            <div className="base-view__stat">
              <span className="base-view__stat-label">STASH</span>
              <span className="base-view__stat-value">{stashItems.length}/{base.stash_slots}</span>
            </div>
            <div className="base-view__stat base-view__stat--wide">
              <span className="base-view__stat-label">COORDENADAS</span>
              <span className="base-view__stat-value base-view__stat-value--mono">
                {base.lat.toFixed(5)}, {base.lng.toFixed(5)}
              </span>
            </div>
            {base.ruin_at && (
              <div className="base-view__stat base-view__stat--wide">
                <span className="base-view__stat-label">EM RUÍNA DESDE</span>
                <span className="base-view__stat-value base-view__stat-value--warn">{fmt(base.ruin_at)}</span>
              </div>
            )}
          </div>
        </section>

        {/* ── Stash ── (owner only) */}
        {isOwner && (
          <section className="base-view__section">
            <div className="base-view__section-header">
              <span className="base-view__section-title">
                STASH
                <span className="base-view__section-count"> · {stashItems.length}/{base.stash_slots}</span>
              </span>
              {onWithdraw && (
                <span className="base-view__section-hint">↓ clique para retirar</span>
              )}
            </div>
            <div className="base-view__grid">
              {stashCells.map((cell, _i) => {
                if (cell.type === 'item') {
                  const item = cell.item
                  return (
                    <div
                      key={item.id}
                      className="stash-slot stash-slot--filled"
                      style={{ '--rarity-color': item.item.rarity.color_hex } as React.CSSProperties}
                      onMouseEnter={() => setHoveredStash(item)}
                      onMouseLeave={() => setHoveredStash(null)}
                      onClick={onWithdraw ? () => handleWithdraw(item) : undefined}
                    >
                      {withdrawing === item.id && <div className="stash-slot__loading">↓</div>}
                      <span className="stash-slot__icon">{item.item.icon ?? '◈'}</span>
                      <span className="stash-slot__name">{item.item.name}</span>
                      <span className="stash-slot__rarity" style={{ color: item.item.rarity.color_hex }}>
                        {item.item.rarity.label}
                      </span>
                      {hoveredStash?.id === item.id && (
                        <div className="stash-slot__tooltip">
                          <div className="stash-slot__tooltip-name">{item.item.name}</div>
                          <div className="stash-slot__tooltip-rarity" style={{ color: item.item.rarity.color_hex }}>
                            {item.item.rarity.label} · {item.item.item_type.label}
                          </div>
                          {item.item.description && (
                            <div className="stash-slot__tooltip-desc">{item.item.description}</div>
                          )}
                          {onWithdraw && <div className="stash-slot__tooltip-action">↓ Mover para inventário</div>}
                        </div>
                      )}
                    </div>
                  )
                }
                if (cell.type === 'empty') {
                  return (
                    <div key={`se-${cell.index}`} className="stash-slot stash-slot--empty">
                      <span className="stash-slot__empty-num">{cell.index + 1}</span>
                    </div>
                  )
                }
                return (
                  <div
                    key="buy-slot"
                    className={`stash-slot stash-slot--buy${!hasRadSlot ? ' stash-slot--buy-disabled' : ''}`}
                    onClick={hasRadSlot && !buyingSlot ? handleBuySlot : undefined}
                    title={!hasRadSlot ? `RAD insuficiente` : `Comprar slot por ${STASH_SLOT_COST} RAD`}
                  >
                    {buyingSlot ? (
                      <span className="stash-slot__buy-spinner">...</span>
                    ) : (
                      <>
                        <span className="stash-slot__buy-plus">+</span>
                        <span className="stash-slot__buy-cost">◈ {STASH_SLOT_COST}</span>
                        {!hasRadSlot && <span className="stash-slot__buy-broke">SEM RAD</span>}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Inventário Pessoal ── (owner only) */}
        {isOwner && (
          <section className="base-view__section">
            <div className="base-view__section-header">
              <span className="base-view__section-title">
                INVENTÁRIO
                <span className="base-view__section-count"> · {inventory.length}/{player.inventory_slots}</span>
              </span>
              <span className="base-view__section-rad">◈ {player.rad_balance} RAD</span>
            </div>
            {onDeposit && (
              <div className="base-view__deposit-hint">⊕ clique para depositar no stash</div>
            )}
            <div className="base-view__grid">
              {Array.from({ length: player.inventory_slots }, (_, i) => {
                const item = inventory[i]
                if (item) {
                  return (
                    <div
                      key={item.id}
                      className="stash-slot stash-slot--filled"
                      style={{ '--rarity-color': item.item.rarity.color_hex } as React.CSSProperties}
                      onMouseEnter={() => setHoveredInv(item)}
                      onMouseLeave={() => setHoveredInv(null)}
                      onClick={onDeposit ? () => handleDeposit(item) : undefined}
                    >
                      {depositing === item.id && <div className="stash-slot__loading">↑</div>}
                      <span className="stash-slot__icon">{item.item.icon ?? '◈'}</span>
                      <span className="stash-slot__name">{item.item.name}</span>
                      <span className="stash-slot__rarity" style={{ color: item.item.rarity.color_hex }}>
                        {item.item.rarity.label}
                      </span>
                      {hoveredInv?.id === item.id && (
                        <div className="stash-slot__tooltip">
                          <div className="stash-slot__tooltip-name">{item.item.name}</div>
                          <div className="stash-slot__tooltip-rarity" style={{ color: item.item.rarity.color_hex }}>
                            {item.item.rarity.label} · {item.item.item_type.label}
                          </div>
                          {item.item.description && (
                            <div className="stash-slot__tooltip-desc">{item.item.description}</div>
                          )}
                          {onDeposit && <div className="stash-slot__tooltip-action">↑ Depositar no stash</div>}
                        </div>
                      )}
                    </div>
                  )
                }
                return (
                  <div key={`ie-${i}`} className="stash-slot stash-slot--empty">
                    <span className="stash-slot__empty-num">{i + 1}</span>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Histórico de Raids ── */}
        <section className="base-view__section base-view__section--last">
          <div className="base-view__section-title">HISTÓRICO DE RAIDS</div>
          {raids.length === 0 ? (
            <div className="base-view__raids-empty">Nenhum raid registrado.</div>
          ) : (
            <div className="base-view__raids-list">
              {raids.map(raid => (
                <div key={raid.id} className="base-view__raid-row">
                  <div className="base-view__raid-left">
                    <span className={`base-view__raid-status base-view__raid-status--${raid.status.toLowerCase()}`}>
                      {raidLabel(raid.status)}
                    </span>
                    <span className="base-view__raid-attacker">
                      {raid.raider?.username ?? `#${raid.raider_id.slice(0, 6)}`}
                    </span>
                  </div>
                  <div className="base-view__raid-right">
                    {raid.status === 'CONCLUÍDO' && (
                      <span className="base-view__raid-items">{(raid.items_taken as unknown[]).length} itens</span>
                    )}
                    <span className="base-view__raid-date">{fmt(raid.started_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  )
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  })
}

function raidLabel(status: string): string {
  return (
    { PENDENTE: '⏱ PENDENTE', CONCLUÍDO: '✓ SAQUEADA', CANCELADO: '✕ CANCELADO', DEFENDIDO: '⊕ DEFENDIDA' }[status]
    ?? status
  )
}
