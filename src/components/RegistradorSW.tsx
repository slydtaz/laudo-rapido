'use client'

import { useEffect } from 'react'

/** Registra o service worker apenas em produção para não poluir o dev. */
export default function RegistradorSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) {
      return
    }
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Instalação do PWA é conveniência: a falha não impede o uso do app.
    })
  }, [])

  return null
}
