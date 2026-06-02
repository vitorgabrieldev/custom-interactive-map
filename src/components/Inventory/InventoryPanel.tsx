import { useState } from 'react'
import type { InventoryItem, Base } from '../../types/game'
import './InventoryPanel.css'

interface InventoryPanelProps {
  inventory: InventoryItem[]
  maxSlots: number
  selectedBase: Base | null
  onClose: () => void
  onDeposit?: (item: InventoryItem) => Promise<void>
}

export function InventoryPanel({
  inventory,
  maxSlots,
  selectedBase,
  onClose,
  onDeposit,
}: InventoryPanelProps) {
  const [hoveredItem, setHoveredItem] = useState<InventoryItem | null>(null)
  const [depositing, setDepositing] = useState<string | null>(null)

  const canDeposit = !!onDeposit && !!selectedBase

  const slots = Array.from({ length: maxSlots }, (_, i) => inventory[i] ?? null)

  async function handleDeposit(item: InventoryItem) {
    if (!onDeposit) return
    setDepositing(item.id)
    try {
      await onDeposit(item)
    } finally {
      setDepositing(null)
    }
  }

  return (
    <div className="inv-panel">
      <div className="inv-panel__header">
        <div className="inv-panel__title">
          <span className="inv-panel__title-icon">▣</span>
          INVENTÁRIO
        </div>
        <div className="inv-panel__meta">
          <span className="inv-panel__slots">
            {inventory.length}<span className="inv-panel__slots-sep">/</span>{maxSlots}
          </span>
          <button className="inv-panel__close" onClick={onClose}>✕</button>
        </div>
      </div>

      {canDeposit && (
        <div className="inv-panel__base-hint">
          ⊕ STASH ABERTO — clique para depositar
        </div>
      )}

      <div className="inv-panel__grid">
        {slots.map((item, i) =>
          item ? (
            <div
              key={item.id}
              className="inv-slot inv-slot--filled"
              style={{ '--rarity-color': item.item.rarity.color_hex } as React.CSSProperties}
              onMouseEnter={() => setHoveredItem(item)}
              onMouseLeave={() => setHoveredItem(null)}
              onClick={canDeposit ? () => handleDeposit(item) : undefined}
            >
              {depositing === item.id && (
                <div className="inv-slot__loading">↑</div>
              )}
              <span className="inv-slot__icon">{item.item.icon ?? '◈'}</span>
              <span className="inv-slot__name">{item.item.name}</span>
              <span
                className="inv-slot__rarity"
                style={{ color: item.item.rarity.color_hex }}
              >
                {item.item.rarity.label}
              </span>

              {hoveredItem?.id === item.id && (
                <div className="inv-slot__tooltip">
                  <div className="inv-slot__tooltip-name">{item.item.name}</div>
                  <div
                    className="inv-slot__tooltip-rarity"
                    style={{ color: item.item.rarity.color_hex }}
                  >
                    {item.item.rarity.label} · {item.item.item_type.label}
                  </div>
                  {item.item.description && (
                    <div className="inv-slot__tooltip-desc">{item.item.description}</div>
                  )}
                  {canDeposit && (
                    <div className="inv-slot__tooltip-action">↑ Depositar no stash</div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div key={`empty-${i}`} className="inv-slot inv-slot--empty">
              <span className="inv-slot__empty-num">{i + 1}</span>
            </div>
          )
        )}
      </div>

      <div className="inv-panel__footer">
        <span className="inv-panel__source-legend">
          Origem:{' '}
          {inventory.length > 0
            ? [...new Set(inventory.map(it => it.acquired_from).filter(Boolean))].join(' · ')
            : 'vazio'}
        </span>
      </div>
    </div>
  )
}
