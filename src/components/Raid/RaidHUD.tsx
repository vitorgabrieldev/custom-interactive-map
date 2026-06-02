import { useEffect, useState, useCallback } from 'react'
import type { Raid, Base } from '../../types/game'
import './RaidHUD.css'

interface RaidHUDProps {
  myRaids: Raid[]
  incomingRaids: Raid[]
  bases: Base[]
  onCancelRaid: (raidId: string) => Promise<void>
  onDefendBase: (raidId: string) => Promise<void>
}

export function RaidHUD({ myRaids, incomingRaids, bases, onCancelRaid, onDefendBase }: RaidHUDProps) {
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [defending, setDefending] = useState<string | null>(null)

  if (myRaids.length === 0 && incomingRaids.length === 0) return null

  async function handleCancel(raidId: string) {
    setCancelling(raidId)
    try { await onCancelRaid(raidId) }
    finally { setCancelling(null) }
  }

  async function handleDefend(raidId: string) {
    setDefending(raidId)
    try { await onDefendBase(raidId) }
    finally { setDefending(null) }
  }

  function baseName(baseId: string) {
    return bases.find(b => b.id === baseId)?.name ?? '???'
  }

  return (
    <div className="raid-hud">
      {incomingRaids.map(raid => (
        <RaidTimer
          key={raid.id}
          resolves_at={raid.resolves_at}
          render={({ time, expired }) => (
            <div className="raid-hud__card raid-hud__card--incoming">
              <div className="raid-hud__card-header">
                <span className="raid-hud__alert">⚠</span>
                <span className="raid-hud__title">SUA BASE ESTÁ SENDO INVADIDA!</span>
              </div>
              <div className="raid-hud__body">
                <div className="raid-hud__info">
                  <span className="raid-hud__base-name">{baseName(raid.base_id)}</span>
                  <span className="raid-hud__time raid-hud__time--danger">
                    {expired ? 'RESOLUÇÃO PENDENTE' : `Acesso em: ${time}`}
                  </span>
                </div>
                <button
                  className="raid-hud__btn raid-hud__btn--defend"
                  onClick={() => handleDefend(raid.id)}
                  disabled={defending === raid.id}
                >
                  {defending === raid.id ? '...' : '🛡 DEFENDER'}
                </button>
              </div>
            </div>
          )}
        />
      ))}

      {myRaids.map(raid => (
        <RaidTimer
          key={raid.id}
          resolves_at={raid.resolves_at}
          render={({ time, expired }) => (
            <div className="raid-hud__card raid-hud__card--outgoing">
              <div className="raid-hud__card-header">
                <span className="raid-hud__icon">⚔</span>
                <span className="raid-hud__title">RAID EM ANDAMENTO</span>
              </div>
              <div className="raid-hud__body">
                <div className="raid-hud__info">
                  <span className="raid-hud__base-name">{baseName(raid.base_id)}</span>
                  <span className="raid-hud__time">
                    {expired ? 'RESOLUÇÃO PENDENTE' : `Resolução em: ${time}`}
                  </span>
                </div>
                <button
                  className="raid-hud__btn raid-hud__btn--cancel"
                  onClick={() => handleCancel(raid.id)}
                  disabled={cancelling === raid.id}
                >
                  {cancelling === raid.id ? '...' : '✕ CANCELAR'}
                </button>
              </div>
            </div>
          )}
        />
      ))}
    </div>
  )
}

// ── RaidTimer — countdown clock ────────────────────────────────────────────────

interface RaidTimerProps {
  resolves_at: string
  render: (state: { time: string; expired: boolean }) => React.ReactNode
}

function RaidTimer({ resolves_at, render }: RaidTimerProps) {
  const getState = useCallback(() => {
    const diff = new Date(resolves_at).getTime() - Date.now()
    if (diff <= 0) return { time: '00:00:00', expired: true }
    const h = Math.floor(diff / 3_600_000)
    const m = Math.floor((diff % 3_600_000) / 60_000)
    const s = Math.floor((diff % 60_000) / 1_000)
    const pad = (n: number) => String(n).padStart(2, '0')
    return { time: `${pad(h)}:${pad(m)}:${pad(s)}`, expired: false }
  }, [resolves_at])

  const [state, setState] = useState(getState)

  useEffect(() => {
    const id = setInterval(() => setState(getState()), 1000)
    return () => clearInterval(id)
  }, [getState])

  return <>{render(state)}</>
}
