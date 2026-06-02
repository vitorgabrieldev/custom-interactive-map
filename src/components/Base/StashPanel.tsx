import { useState } from 'react'
import type { StashItem, Base } from '../../types/game'
import { STASH_SLOT_COST, STASH_SLOT_MAX } from '../../lib/game'
import './StashPanel.css'

interface StashPanelProps {
  base: Base
  stashItems: StashItem[]
  playerRad: number
  isOwner: boolean
  onClose: () => void
  onWithdraw?: (item: StashItem) => Promise<void>
  onBuySlot?: () => Promise<void>
}

export function StashPanel({
  base,
  stashItems,
  playerRad,
  isOwner,
  onClose,
  onWithdraw,
  onBuySlot,
}: StashPanelProps) {
  const [hoveredItem, setHoveredItem] = useState<StashItem | null>(null)
  const [withdrawing, setWithdrawing] = useState<string | null>(null)
  const [buyingSlot, setBuyingSlot] = useState(false)

  const canBuy = isOwner && base.status === 'ATIVA' && base.stash_slots < STASH_SLOT_MAX
  const hasRad  = playerRad >= STASH_SLOT_COST

  // Build cell list: one entry per purchased slot + one buy-button cell (if eligible)
  const cells: Array<{ type: 'item'; item: StashItem } | { type: 'empty'; index: number } | { type: 'buy' }> = []

  for (let i = 0; i < base.stash_slots; i++) {
    const item = stashItems[i]
    cells.push(item ? { type: 'item', item } : { type: 'empty', index: i })
  }
  if (canBuy) cells.push({ type: 'buy' })

  async function handleWithdraw(item: StashItem) {
    if (!onWithdraw) return
    setWithdrawing(item.id)
    try { await onWithdraw(item) } finally { setWithdrawing(null) }
  }

  async function handleBuySlot() {
    if (!onBuySlot || buyingSlot) return
    setBuyingSlot(true)
    try { await onBuySlot() } finally { setBuyingSlot(false) }
  }

  return (
    <div className="stash-panel">
      <div className="stash-panel__header">
        <div className="stash-panel__title">
          <span className="stash-panel__title-icon">⌂</span>
          STASH
        </div>
        <div className="stash-panel__meta">
          <span className="stash-panel__slots">
            {stashItems.length}
            <span className="stash-panel__slots-sep">/</span>
            {base.stash_slots}
          </span>
          <button className="stash-panel__close" onClick={onClose}>✕</button>
        </div>
      </div>

      <div className="stash-panel__base-name">{base.name.toUpperCase()}</div>

      {onWithdraw && (
        <div className="stash-panel__hint">↓ INVENTÁRIO ABERTO — clique para retirar</div>
      )}

      <div className="stash-panel__grid">
        {cells.map((cell, _i) => {
          if (cell.type === 'item') {
            const item = cell.item
            return (
              <div
                key={item.id}
                className="stash-slot stash-slot--filled"
                style={{ '--rarity-color': item.item.rarity.color_hex } as React.CSSProperties}
                onMouseEnter={() => setHoveredItem(item)}
                onMouseLeave={() => setHoveredItem(null)}
                onClick={onWithdraw ? () => handleWithdraw(item) : undefined}
              >
                {withdrawing === item.id && <div className="stash-slot__loading">↓</div>}
                <span className="stash-slot__icon">{item.item.icon ?? '◈'}</span>
                <span className="stash-slot__name">{item.item.name}</span>
                <span className="stash-slot__rarity" style={{ color: item.item.rarity.color_hex }}>
                  {item.item.rarity.label}
                </span>
                {hoveredItem?.id === item.id && (
                  <div className="stash-slot__tooltip">
                    <div className="stash-slot__tooltip-name">{item.item.name}</div>
                    <div className="stash-slot__tooltip-rarity" style={{ color: item.item.rarity.color_hex }}>
                      {item.item.rarity.label} · {item.item.item_type.label}
                    </div>
                    {item.item.description && (
                      <div className="stash-slot__tooltip-desc">{item.item.description}</div>
                    )}
                    {onWithdraw && (
                      <div className="stash-slot__tooltip-action">↓ Mover para inventário</div>
                    )}
                  </div>
                )}
              </div>
            )
          }

          if (cell.type === 'empty') {
            return (
              <div key={`empty-${cell.index}`} className="stash-slot stash-slot--empty">
                <span className="stash-slot__empty-num">{cell.index + 1}</span>
              </div>
            )
          }

          // buy button cell
          return (
            <div
              key="buy-slot"
              className={`stash-slot stash-slot--buy${!hasRad ? ' stash-slot--buy-disabled' : ''}`}
              onClick={hasRad && !buyingSlot ? handleBuySlot : undefined}
              title={!hasRad ? `RAD insuficiente (${playerRad}/${STASH_SLOT_COST})` : `Comprar slot por ${STASH_SLOT_COST} RAD`}
            >
              {buyingSlot ? (
                <span className="stash-slot__buy-spinner">...</span>
              ) : (
                <>
                  <span className="stash-slot__buy-plus">+</span>
                  <span className="stash-slot__buy-cost">◈ {STASH_SLOT_COST}</span>
                  {!hasRad && <span className="stash-slot__buy-broke">SEM RAD</span>}
                </>
              )}
            </div>
          )
        })}
      </div>

      <div className="stash-panel__footer">
        <span className="stash-panel__footer-text">
          {base.daily_cost} RAD/dia · Nv.{base.level}
        </span>
        {canBuy && (
          <span className="stash-panel__footer-rad">◈ {playerRad} RAD</span>
        )}
      </div>
    </div>
  )
}
