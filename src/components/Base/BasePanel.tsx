import { useState } from 'react'
import type { Base, Raid } from '../../types/game'
import './BasePanel.css'

// ── BasePanel ──────────────────────────────────────────────────────────────────

interface BasePanelProps {
  base: Base
  currentUserId: string
  activeRaid: Raid | null
  onClose: () => void
  onOpenStash: () => void
  onStartRaid: () => Promise<void>
}

export function BasePanel({
  base,
  currentUserId,
  activeRaid,
  onClose,
  onOpenStash,
  onStartRaid,
}: BasePanelProps) {
  const [raiding, setRaiding] = useState(false)
  const isOwn = base.owner_id === currentUserId
  const isRuin = base.status === 'RUÍNA'

  async function handleRaid() {
    setRaiding(true)
    try {
      await onStartRaid()
    } finally {
      setRaiding(false)
    }
  }

  const statusLabel = { ATIVA: 'ATIVA', RUÍNA: 'RUÍNA', DESTRUÍDA: 'DESTRUÍDA' }[base.status]

  return (
    <div className={`base-panel base-panel--${base.status.toLowerCase().replace('í', 'i')}`}>
      <div className="base-panel__header">
        <div className="base-panel__title-row">
          <span className="base-panel__icon">⌂</span>
          <span className="base-panel__name">{base.name}</span>
          <span className={`base-panel__status base-panel__status--${base.status === 'ATIVA' ? 'active' : 'ruin'}`}>
            {statusLabel}
          </span>
        </div>
        <button className="base-panel__close" onClick={onClose}>✕</button>
      </div>

      <div className="base-panel__info">
        <div className="base-panel__info-row">
          <span className="base-panel__info-label">DONO</span>
          <span className="base-panel__info-value">
            {isOwn ? '▶ VOCÊ' : (base.owner_username ?? '???')}
          </span>
        </div>
        <div className="base-panel__info-row">
          <span className="base-panel__info-label">NÍVEL</span>
          <span className="base-panel__info-value">{base.level}</span>
        </div>
        {isOwn && (
          <div className="base-panel__info-row">
            <span className="base-panel__info-label">CUSTO</span>
            <span className="base-panel__info-value">{base.daily_cost} RAD/dia</span>
          </div>
        )}
        {isRuin && base.ruin_at && (
          <div className="base-panel__info-row">
            <span className="base-panel__info-label">RUÍNA</span>
            <span className="base-panel__info-value base-panel__info-value--warn">
              {formatDate(base.ruin_at)}
            </span>
          </div>
        )}
      </div>

      <div className="base-panel__actions">
        {isOwn ? (
          <button className="base-panel__action-btn base-panel__action-btn--stash" onClick={onOpenStash}>
            ▣ ABRIR STASH
          </button>
        ) : activeRaid ? (
          <div className="base-panel__raid-active">
            <span className="base-panel__raid-active-icon">⚔</span>
            Raid em andamento
          </div>
        ) : !isRuin ? (
          <button
            className="base-panel__action-btn base-panel__action-btn--raid"
            onClick={handleRaid}
            disabled={raiding}
          >
            {raiding ? 'INICIANDO...' : '⚔ INVADIR · 5H'}
          </button>
        ) : (
          <button className="base-panel__action-btn base-panel__action-btn--loot" onClick={onOpenStash}>
            💀 SAQUEAR RUÍNA
          </button>
        )}
      </div>
    </div>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// ── BasePlantModal ─────────────────────────────────────────────────────────────

interface BasePlantModalProps {
  coords: [number, number]
  onConfirm: (name: string) => Promise<void>
  onCancel: () => void
}

export function BasePlantModal({ coords, onConfirm, onCancel }: BasePlantModalProps) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { setError('Nome obrigatório.'); return }
    if (trimmed.length > 24) { setError('Máximo 24 caracteres.'); return }
    setLoading(true)
    setError('')
    try {
      await onConfirm(trimmed)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao criar base.')
      setLoading(false)
    }
  }

  return (
    <div className="plant-modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="plant-modal">
        <div className="plant-modal__header">
          <span className="plant-modal__icon">⊕</span>
          PLANTAR BASE
        </div>

        <div className="plant-modal__coords">
          {coords[1].toFixed(5)}, {coords[0].toFixed(5)}
        </div>

        <form onSubmit={handleSubmit} className="plant-modal__form">
          <label className="plant-modal__label">NOME DA BASE</label>
          <input
            className="plant-modal__input"
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError('') }}
            placeholder="Ex: Bunker Norte"
            maxLength={24}
            autoFocus
            disabled={loading}
          />
          {error && <p className="plant-modal__error">{error}</p>}

          <div className="plant-modal__cost-row">
            <span className="plant-modal__cost-label">CUSTO</span>
            <span className="plant-modal__cost-value">◈ 50 RAD</span>
          </div>

          <div className="plant-modal__buttons">
            <button
              type="button"
              className="plant-modal__btn plant-modal__btn--cancel"
              onClick={onCancel}
              disabled={loading}
            >
              CANCELAR
            </button>
            <button
              type="submit"
              className="plant-modal__btn plant-modal__btn--confirm"
              disabled={loading || !name.trim()}
            >
              {loading ? 'CRIANDO...' : 'CONFIRMAR'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
