import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

function socketBaseUrl() {
  const env = import.meta.env.VITE_API_URL?.trim()
  if (env) return env.replace(/\/$/, '')
  // Bypass Vite’s /socket.io WebSocket proxy (avoids harmless “write EPIPE” noise on reconnect/HMR).
  if (import.meta.env.DEV) {
    const raw = import.meta.env.VITE_DEV_API_ORIGIN?.trim()
    const dev = raw ? raw.replace(/\/$/, '') : ''
    return dev || 'http://localhost:5050'
  }
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

export function useVideoSocket(token, onProgress) {
  const cbRef = useRef(onProgress)
  useEffect(() => {
    cbRef.current = onProgress
  }, [onProgress])

  useEffect(() => {
    if (!token) return undefined

    const socket = io(socketBaseUrl(), {
      auth: { token },
      transports: ['websocket', 'polling'],
    })

    const handler = (payload) => {
      cbRef.current?.(payload)
    }
    socket.on('video:progress', handler)

    return () => {
      socket.off('video:progress', handler)
      socket.close()
    }
  }, [token])
}
