import { useState } from 'react'
import type { StashItem, Base } from '../../types/game'
import './StashPanel.css'

interface StashPanelProps {
  base: Base
  stashItems: StashItem[]
  onClose: () => void
  onWithdraw?: (item: StashItem) => Promise<void>
}

export function StashPanel({ base, stashItems, onClose, onWithdraw }: StashPanelProps) {
  const [hoveredItem, setHoveredItem] = useState<StashItem | null>(null)
  const [withdrawing, setWithdrawing] = useState<string | null>(null)

  const slots = Array.from({ length: base.stash_slots }, (_, i) => stashItems[i] ?? null)

  async function handleWithdraw(item: StashItem) {
    if (!onWithdraw) return
    setWithdrawing(item.id)
    try {
      await onWithdraw(item)
    } finally {
      setWithdrawing(null)
    }
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
        <div className="stash-panel__hint">
          ↓ INVENTÁRIO ABERTO — clique para retirar
        </div>
      )}

      <div className="stash-panel__grid">
        {slots.map((item, i) =>
          item ? (
            <div
              key={item.id}
              className="stash-slot stash-slot--filled"
              style={{ '--rarity-color': item.item.rarity.color_hex } as React.CSSProperties}
              onMouseEnter={() => setHoveredItem(item)}
              onMouseLeave={() => setHoveredItem(null)}
              onClick={onWithdraw ? () => handleWithdraw(item) : undefined}
            >
              {withdrawing === item.id && (
                <div className="stash-slot__loading">↓</div>
              )}
              <span className="stash-slot__icon">{item.item.icon ?? '◈'}</span>
              <span className="stash-slot__name">{item.item.name}</span>
              <span
                className="stash-slot__rarity"
                style={{ color: item.item.rarity.color_hex }}
              >
                {item.item.rarity.label}
              </span>

              {hoveredItem?.id === item.id && (
                <div className="stash-slot__tooltip">
                  <div className="stash-slot__tooltip-name">{item.item.name}</div>
                  <div
                    className="stash-slot__tooltip-rarity"
                    style={{ color: item.item.rarity.color_hex }}
                  >
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
          ) : (
            <div key={`empty-${i}`} className="stash-slot stash-slot--empty">
              <span className="stash-slot__empty-num">{i + 1}</span>
            </div>
          )
        )}
      </div>

      <div className="stash-panel__footer">
        <span className="stash-panel__footer-text">
          {base.daily_cost} RAD/dia · Nv.{base.level}
        </span>
      </div>
    </div>
  )
}
