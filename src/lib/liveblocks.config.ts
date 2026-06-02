import { createClient } from '@liveblocks/client'
import { createRoomContext } from '@liveblocks/react'

export type Presence = {
  cursor: { lng: number; lat: number } | null
  selectedMarkerId: string | null
  name: string
  color: string
}

const client = createClient({
  publicApiKey: import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY ?? '',
  throttle: 50, // cap cursor updates to ~20fps
})

export const {
  RoomProvider,
  useMyPresence,
  useUpdateMyPresence,
  useOthers,
  useOthersMapped,
  useSelf,
} = createRoomContext<Presence>(client)
