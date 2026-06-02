import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RoomProvider } from './lib/liveblocks.config'
import { getUserIdentity } from './lib/userIdentity'
import App from './App'

const identity = getUserIdentity()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RoomProvider
      id="gta-map-global"
      initialPresence={{
        cursor: null,
        selectedMarkerId: null,
        name: identity.name,
        color: identity.color,
      }}
    >
      <App />
    </RoomProvider>
  </StrictMode>,
)
