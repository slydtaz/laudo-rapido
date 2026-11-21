'use client'

import { useEffect, useRef, useState } from 'react'

import { useToast } from '@/components/ToastProvider'
import { useT } from '@/lib/i18n/useT'

/** Registra o service worker apenas em produção para não poluir o dev. */
export default function RegistradorSW() {
  const { avisar } = useToast()
  const t = useT()
  const [mostrarAtualizar, setMostrarAtualizar] = useState(false)
  const workerRef = useRef<ServiceWorker | null>(null)
  const aceitouAtualizacaoRef = useRef(false)
  const recarregadoRef = useRef(false)
  const avisarRef = useRef(avisar)
  const mensagemRef = useRef(t('pwaAtualizacao'))

  // Os ouvintes vivem fora do ciclo de render: refs evitam religar o SW
  // toda vez que o idioma ou a referência de `avisar` muda.
  avisarRef.current = avisar
  mensagemRef.current = t('pwaAtualizacao')

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

    let cancelado = false
    let registro: ServiceWorkerRegistration | null = null
    let worker: ServiceWorker | null = null

    const aoControllerChange = () => {
      // O clients.claim() da primeira instalação também dispara
      // controllerchange. Só recarrega depois que o usuário aceitou.
      if (!aceitouAtualizacaoRef.current || recarregadoRef.current) return
      recarregadoRef.current = true
      location.reload()
    }

    const aoStateChange = () => {
      if (cancelado || !worker || worker.state !== 'installed' || workerRef.current) return
      workerRef.current = worker
      avisarRef.current(mensagemRef.current, 'info')
      setMostrarAtualizar(true)
    }

    const aoUpdateFound = () => {
      const instalando = registro?.installing
      if (cancelado || !instalando || worker === instalando) return
      worker?.removeEventListener('statechange', aoStateChange)
      worker = instalando
      instalando.addEventListener('statechange', aoStateChange)
      aoStateChange()
    }

    navigator.serviceWorker.addEventListener('controllerchange', aoControllerChange)

    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        if (cancelado) return
        registro = reg
        reg.addEventListener('updatefound', aoUpdateFound)
        if (reg.installing) aoUpdateFound()
      })
      .catch(() => {
        // Instalação do PWA é conveniência: a falha não impede o uso do app.
      })

    return () => {
      cancelado = true
      navigator.serviceWorker.removeEventListener('controllerchange', aoControllerChange)
      registro?.removeEventListener('updatefound', aoUpdateFound)
      worker?.removeEventListener('statechange', aoStateChange)
    }
  }, [])

  if (!mostrarAtualizar) return null

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-20 z-50 flex justify-center sm:bottom-24">
      <button
        type="button"
        onClick={() => {
          aceitouAtualizacaoRef.current = true
          workerRef.current?.postMessage({ type: 'SKIP_WAITING' })
        }}
        className="pop pointer-events-auto rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-fg shadow-lg"
        style={{ boxShadow: 'var(--shadow-lift)' }}
      >
        {t('pwaBotao')}
      </button>
    </div>
  )
}
