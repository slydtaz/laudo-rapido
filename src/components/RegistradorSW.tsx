'use client'

import { useEffect } from 'react'

/** Registra o service worker apenas em produção para não poluir o dev. */
export default function RegistradorSW() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return
    }

    if (process.env.NODE_ENV !== 'production') {
      // Um SW instalado em produção permanece no mesmo origin quando o dev
      // server sobe. Ele precisa sair daqui, senão serve chunks antigos.
      navigator.serviceWorker
        .getRegistrations()
        .then((registracoes) => registracoes.forEach((reg) => reg.unregister()))
        .catch(() => {})
      if ('caches' in window) {
        caches
          .keys()
          .then((chaves) =>
            Promise.all(
              chaves
                .filter((chave) => chave.startsWith('laudo-rapido-'))
                .map((chave) => caches.delete(chave)),
            ),
          )
          .catch(() => {})
      }
      return
    }

    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {
      // Instalação do PWA é conveniência: a falha não impede o uso do app.
    })
  }, [])

  return null
}
