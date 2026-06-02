import { useState } from 'react'
import { CATEGORIES, type MapMarker, type MarkerCategory } from '../../data/markers'
import { useSelf, useOthersMapped } from '../../lib/liveblocks.config'
import './Sidebar.css'

interface SidebarProps {
  activeCategories: Set<MarkerCategory>
  markers: MapMarker[]
  selectedMarker: MapMarker | null
  onToggleCategory: (cat: MarkerCategory) => void
  onSelectMarker: (marker: MapMarker | null) => void
}

export function Sidebar({
  activeCategories,
  markers,
  selectedMarker,
  onToggleCategory,
  onSelectMarker,
}: SidebarProps) {
  const [search, setSearch] = useState('')
  const [isCollapsed, setIsCollapsed] = useState(false)

  const self = useSelf()
  const othersIdentity = useOthersMapped((user) => ({
    name: user.presence.name,
    color: user.presence.color,
  }))

  const filtered = markers.filter((m) => {
    const matchesSearch =
      search === '' ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.description.toLowerCase().includes(search.toLowerCase())
    return matchesSearch && activeCategories.has(m.category)
  })

  return (
    <aside className={`sidebar ${isCollapsed ? 'sidebar--collapsed' : ''}`}>
      <button className="sidebar__toggle" onClick={() => setIsCollapsed((v) => !v)}>
        {isCollapsed ? '▶' : '◀'}
      </button>

      {!isCollapsed && (
        <>
          <div className="sidebar__header">
            <div className="sidebar__logo">
              <span className="sidebar__logo-icon">◈</span>
              <span className="sidebar__logo-text">GTA MAP</span>
            </div>
          </div>

          {/* Connected users */}
          <div className="sidebar__section">
            <h3 className="sidebar__section-title">
              ONLINE <span className="sidebar__count">{othersIdentity.length + 1}</span>
            </h3>
            <div className="online-users">
              {self && (
                <div className="online-user online-user--self">
                  <span
                    className="online-user__dot"
                    style={{ background: self.presence.color, boxShadow: `0 0 5px ${self.presence.color}` }}
                  />
                  <span className="online-user__name">{self.presence.name}</span>
                  <span className="online-user__you">VOCÊ</span>
                </div>
              )}
              {othersIdentity.map(([id, { name, color }]) => (
                <div key={id} className="online-user">
                  <span
                    className="online-user__dot"
                    style={{ background: color, boxShadow: `0 0 5px ${color}` }}
                  />
                  <span className="online-user__name">{name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="sidebar__section">
            <h3 className="sidebar__section-title">BUSCAR</h3>
            <div className="search-box">
              <span className="search-box__icon">⌕</span>
              <input
                className="search-box__input"
                type="text"
                placeholder="Buscar local..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button className="search-box__clear" onClick={() => setSearch('')}>✕</button>
              )}
            </div>
          </div>

          <div className="sidebar__section">
            <h3 className="sidebar__section-title">CAMADAS</h3>
            <div className="layers">
              {(Object.keys(CATEGORIES) as MarkerCategory[]).map((cat) => {
                const { label, color, icon } = CATEGORIES[cat]
                const count = markers.filter((m) => m.category === cat).length
                const active = activeCategories.has(cat)
                return (
                  <button
                    key={cat}
                    className={`layer-btn ${active ? 'layer-btn--active' : ''}`}
                    style={{ '--layer-color': color } as React.CSSProperties}
                    onClick={() => onToggleCategory(cat)}
                  >
                    <span className="layer-btn__icon">{icon}</span>
                    <span className="layer-btn__label">{label}</span>
                    <span className="layer-btn__count">{count}</span>
                    <span className={`layer-btn__dot ${active ? 'layer-btn__dot--on' : ''}`} />
                  </button>
                )
              })}
            </div>
          </div>

          <div className="sidebar__section sidebar__section--grow">
            <h3 className="sidebar__section-title">
              PONTOS <span className="sidebar__count">{filtered.length}</span>
            </h3>
            <ul className="marker-list">
              {filtered.length === 0 && (
                <li className="marker-list__empty">Nenhum resultado encontrado</li>
              )}
              {filtered.map((m) => {
                const { color, icon } = CATEGORIES[m.category]
                const isSelected = selectedMarker?.id === m.id
                return (
                  <li key={m.id}>
                    <button
                      className={`marker-item ${isSelected ? 'marker-item--selected' : ''}`}
                      style={{ '--marker-color': color } as React.CSSProperties}
                      onClick={() => onSelectMarker(isSelected ? null : m)}
                    >
                      <span className="marker-item__icon">{icon}</span>
                      <div className="marker-item__info">
                        <span className="marker-item__name">{m.name}</span>
                        <span className="marker-item__desc">{m.description}</span>
                      </div>
                      <span className="marker-item__arrow">{isSelected ? '▼' : '▶'}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      )}
    </aside>
  )
}
