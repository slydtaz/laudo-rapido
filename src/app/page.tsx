'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { useT } from '@/lib/i18n/useT'
import { entregasSalvas, pendenciasRestantes } from '@/lib/offline/queue'

export default function HomePage() {
  const t = useT()
  const [online, setOnline] = useState(true)
  const [resumo, setResumo] = useState({ pendentes: 0, entregues: 0 })

  useEffect(() => {
    const atualizar = () => setOnline(navigator.onLine)
    atualizar()
    window.addEventListener('online', atualizar)
    window.addEventListener('offline', atualizar)
    return () => {
      window.removeEventListener('online', atualizar)
      window.removeEventListener('offline', atualizar)
    }
  }, [])

  useEffect(() => {
    let ativo = true

    void (async () => {
      try {
        const resposta = await fetch('/api/v1/sessao')
        if (!resposta.ok) return
        const { empresaId } = (await resposta.json()) as { empresaId?: string }
        if (!empresaId || !ativo) return

        const [pendentes, entregas] = await Promise.all([
          pendenciasRestantes(empresaId),
          entregasSalvas(empresaId),
        ])
        if (ativo) setResumo({ pendentes, entregues: entregas.length })
      } catch {
        // Sem sessão ou sem IndexedDB, o resumo permanece em zero.
      }
    })()

    return () => {
      ativo = false
    }
  }, [])

  return (
    <main className="space-y-6 sm:space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-11 place-items-center rounded-xl bg-brand font-display text-sm font-bold text-on-brand shadow-sm"
          >
            LR
          </span>
          <div>
            <p className="font-display font-semibold leading-tight">{t('appNome')}</p>
            <p className="text-xs text-muted">{t('homeEyebrow')}</p>
          </div>
        </div>
        <span className="chip max-w-full text-right">
          <span aria-hidden="true" className={`status-dot ${online ? 'online' : 'offline'}`} />
          <span className="truncate">{online ? t('homeOnline') : t('homeOffline')}</span>
        </span>
      </header>

      <section className="card reveal p-6 sm:p-10">
        <h1 className="max-w-xl">{t('homeTitulo')}</h1>
        <p className="reveal-2 mt-4 max-w-lg text-base leading-relaxed text-muted sm:text-lg">
          {t('homeSubtitulo')}
        </p>
        <Link href="/visitas/nova" className="btn btn-primary reveal-3 mt-8">
          {t('homeAcao')}
          <span aria-hidden="true">→</span>
        </Link>
      </section>

      <section className="space-y-3" aria-label={t('homeResumo')}>
        <h2 className="reveal-2 text-sm font-medium text-muted">{t('homeResumo')}</h2>
        <div className="card reveal-3 grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
          <div className="flex items-center gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent-soft font-display text-2xl font-semibold text-accent">
              {resumo.pendentes}
            </span>
            <p className="text-sm leading-snug text-muted">{t('homePendentes')}</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-success-soft font-display text-2xl font-semibold text-success">
              {resumo.entregues}
            </span>
            <p className="text-sm leading-snug text-muted">{t('homeEntregas')}</p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="reveal-2 text-sm font-medium text-muted">{t('homeMaisTarde')}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/configuracoes" className="card card-lift reveal-3 block p-6">
            <span
              aria-hidden="true"
              className="mb-4 grid size-10 place-items-center rounded-lg bg-brand-soft text-lg text-brand-strong"
            >
              ⚙
            </span>
            <h3>{t('configuracoes')}</h3>
            <p className="mt-1 text-sm text-muted">{t('configSubtitulo')}</p>
          </Link>
          <Link href="/visitas" className="card card-lift reveal-3 block p-6">
            <span
              aria-hidden="true"
              className="mb-4 grid size-10 place-items-center rounded-lg bg-success-soft text-lg text-success"
            >
              ◷
            </span>
            <h3>{t('historicoHome')}</h3>
            <p className="mt-1 text-sm text-muted">{t('historicoHomeDica')}</p>
          </Link>
          <Link href="/planos" className="card card-lift reveal-4 block p-6">
            <span
              aria-hidden="true"
              className="mb-4 grid size-10 place-items-center rounded-lg bg-accent-soft text-lg text-accent"
            >
              ◇
            </span>
            <h3>{t('planos')}</h3>
            <p className="mt-1 text-sm text-muted">{t('planosSubtitulo')}</p>
          </Link>
        </div>
      </section>
    </main>
  )
}
