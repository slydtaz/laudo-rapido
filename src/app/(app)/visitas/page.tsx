'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'

import Skeleton from '@/components/Skeleton'
import { useToast } from '@/components/ToastProvider'
import { usePreferencias } from '@/components/ProvedorPreferencias'
import type { Idioma } from '@/lib/config/preferencias'
import { useT, type Tradutor } from '@/lib/i18n/useT'
import { executarOtimista } from '@/lib/ui/acao-otimista'
import { filtrarVisitas, type StatusHistorico, type VisitaHistorico } from '@/lib/visita/filtro'

const LOCAIS: Record<Idioma, string> = {
  ptBR: 'pt-BR',
  en: 'en',
  es: 'es',
  fr: 'fr',
  de: 'de',
}

const FILTROS: StatusHistorico[] = ['todos', 'sincronizada', 'entregue', 'rascunho']

function rotuloStatus(status: string, t: Tradutor): string {
  if (status === 'entregue') return t('historicoEntregue')
  if (status === 'rascunho') return t('historicoRascunho')
  return t('historicoSincronizada')
}

function textoCampo(valor: unknown): string {
  return typeof valor === 'string' && valor.trim() ? valor : ''
}

function classeStatus(status: string): string {
  if (status === 'entregue') return 'chip chip-ok'
  if (status === 'rascunho') return 'chip chip-warn'
  return 'chip chip-brand'
}

export default function HistoricoPage() {
  const t = useT()
  const { avisar } = useToast()
  const { preferencias } = usePreferencias()
  const [visitas, setVisitas] = useState<VisitaHistorico[]>([])
  const [termo, setTermo] = useState('')
  const [status, setStatus] = useState<StatusHistorico>('todos')
  const [carregando, setCarregando] = useState(true)
  const [falhou, setFalhou] = useState(false)
  const [tentativa, setTentativa] = useState(0)

  const carregar = useCallback(async (sinal: AbortSignal) => {
    setCarregando(true)
    setFalhou(false)
    try {
      const resposta = await fetch('/api/v1/visitas', { signal: sinal })
      if (!resposta.ok) throw new Error('histórico indisponível')
      const corpo = (await resposta.json()) as { visitas?: VisitaHistorico[] }
      setVisitas(Array.isArray(corpo.visitas) ? corpo.visitas : [])
    } catch (erro) {
      if ((erro as Error).name !== 'AbortError') {
        setFalhou(true)
        setVisitas([])
      }
    } finally {
      if (!sinal.aborted) setCarregando(false)
    }
  }, [])

  useEffect(() => {
    const controle = new AbortController()
    void carregar(controle.signal)
    return () => controle.abort()
  }, [carregar, tentativa])

  const visiveis = useMemo(
    () => filtrarVisitas(visitas, termo, status),
    [visitas, termo, status],
  )

  async function copiarLink(visita: VisitaHistorico) {
    await executarOtimista({
      aplicar: () => undefined,
      executar: async () => {
        await navigator.clipboard.writeText(`${window.location.origin}/o/${visita.token}`)
      },
      aoSucesso: () => avisar(t('historicoCopiado')),
      aoErro: () => avisar(t('historicoErroCopiar'), 'erro'),
    })
  }

  const formatoData = new Intl.DateTimeFormat(LOCAIS[preferencias.idioma], {
    dateStyle: 'medium',
  })

  return (
    <main className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="eyebrow">{t('appNome')}</p>
          <h1>{t('historicoTitulo')}</h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted">
            {t('historicoSubtitulo')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/visitas/nova" className="btn btn-primary">
            {t('homeAcao')}
          </Link>
          <Link href="/" className="btn btn-ghost">
            {t('voltarInicio')}
          </Link>
        </div>
      </header>

      <section className="card space-y-5 p-5 sm:p-7" aria-label={t('historicoBusca')}>
        <div className="space-y-2">
          <label htmlFor="busca-historico" className="label">
            {t('historicoBusca')}
          </label>
          <input
            id="busca-historico"
            type="search"
            className="input"
            value={termo}
            placeholder={t('historicoBuscaPlaceholder')}
            onChange={(evento) => setTermo(evento.target.value)}
          />
        </div>

        <fieldset className="space-y-3">
          <legend className="label">{t('historicoFiltro')}</legend>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('historicoFiltro')}>
            {FILTROS.map((filtro) => (
              <button
                key={filtro}
                type="button"
                aria-pressed={status === filtro}
                onClick={() => setStatus(filtro)}
                className={status === filtro ? 'btn btn-primary min-h-11' : 'btn btn-soft min-h-11'}
              >
                {filtro === 'todos' ? t('historicoTodos') : rotuloStatus(filtro, t)}
              </button>
            ))}
          </div>
        </fieldset>
      </section>

      {carregando ? (
        <section className="card p-5 sm:p-7">
          <Skeleton linhas={4} label={t('carregando')} />
        </section>
      ) : falhou ? (
        <section className="card space-y-4 p-6 text-center sm:p-10">
          <p className="text-sm text-muted">{t('historicoErro')}</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setTentativa((atual) => atual + 1)}
          >
            {t('historicoTentar')}
          </button>
        </section>
      ) : visiveis.length === 0 ? (
        <section className="card p-6 text-center text-sm text-muted sm:p-10">
          <p>{t('historicoVazio')}</p>
        </section>
      ) : (
        <>
          <p className="text-sm font-medium text-muted">
            {t('historicoResultados', { n: visiveis.length })}
          </p>
          <section className="grid gap-4 lg:grid-cols-2">
            {visiveis.map((visita, indice) => {
              const cliente = textoCampo(visita.dados?.cliente) || t('historicoSemCliente')
              const tipo = textoCampo(visita.dados?.tipo)
              const observacoes = textoCampo(visita.dados?.observacoes)
              const data = new Date(visita.capturadoEm)
              const dataValida = !Number.isNaN(data.getTime())

              return (
                <article
                  key={visita.id}
                  className={`card card-lift ${['reveal', 'reveal-2', 'reveal-3', 'reveal-4'][indice % 4]} space-y-3 p-5 sm:p-6`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <h2 className="truncate text-lg">{cliente}</h2>
                      {tipo && <p className="text-sm text-brand-strong">{tipo}</p>}
                    </div>
                    <span className={classeStatus(visita.status)}>
                      {rotuloStatus(visita.status, t)}
                    </span>
                  </div>

                  {dataValida && (
                    <p className="text-xs text-muted">
                      {t('historicoData', { data: formatoData.format(data) })}
                    </p>
                  )}
                  {observacoes && (
                    <p className="line-clamp-2 text-sm leading-relaxed text-muted">{observacoes}</p>
                  )}

                  <div className="divider" />
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`/o/${visita.token}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-soft min-h-11"
                    >
                      {t('historicoAbrir')}
                    </a>
                    <a
                      href={`/api/v1/visitas/${visita.id}/pdf`}
                      className="btn btn-soft min-h-11"
                    >
                      {t('historicoBaixar')}
                    </a>
                    <button
                      type="button"
                      onClick={() => void copiarLink(visita)}
                      className="btn btn-ghost min-h-11"
                    >
                      {t('historicoCopiar')}
                    </button>
                  </div>
                </article>
              )
            })}
          </section>
        </>
      )}
    </main>
  )
}
