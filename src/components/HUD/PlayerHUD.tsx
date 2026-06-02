import type { Player } from '../../types/game'
import './PlayerHUD.css'

interface PlayerHUDProps {
  player: Player
  showInventory: boolean
  plantingMode: boolean
  onToggleInventory: () => void
  onStartPlanting: () => void
  onCancelPlanting: () => void
}

export function PlayerHUD({
  player,
  showInventory,
  plantingMode,
  onToggleInventory,
  onStartPlanting,
  onCancelPlanting,
}: PlayerHUDProps) {
  return (
    <div className="player-hud">
      <div className="player-hud__stats">
        <div className="player-hud__rad">
          <span className="player-hud__rad-icon">◈</span>
          <span className="player-hud__rad-value">
            {player.rad_balance.toLocaleString('pt-BR')}
          </span>
          <span className="player-hud__rad-label">RAD</span>
        </div>

        {player.streak_days > 0 && (
          <div className="player-hud__streak">
            <span className="player-hud__streak-icon">🔥</span>
            <span className="player-hud__streak-value">{player.streak_days}</span>
          </div>
        )}
      </div>

      <div className="player-hud__actions">
        <button
          className={`player-hud__btn ${showInventory ? 'player-hud__btn--active' : ''}`}
          onClick={onToggleInventory}
          title="Inventário"
        >
          ▣ INV
        </button>

        {plantingMode ? (
          <button
            className="player-hud__btn player-hud__btn--cancel"
            onClick={onCancelPlanting}
          >
            ✕ CANCELAR
          </button>
        ) : (
          <button
            className="player-hud__btn player-hud__btn--plant"
            onClick={onStartPlanting}
            title="Plantar base — custa 50 RAD"
          >
            ⊕ BASE
            <span className="player-hud__btn-cost">50 RAD</span>
          </button>
        )}

      </div>

      {plantingMode && (
        <div className="player-hud__plant-hint">
          CLIQUE NO MAPA PARA POSICIONAR SUA BASE
        </div>
      )}
    </div>
  )
}
