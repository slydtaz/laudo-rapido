'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type FormEvent } from 'react'

import { useToast } from '@/components/ToastProvider'
import { useT } from '@/lib/i18n/useT'
import { executarOtimista } from '@/lib/ui/acao-otimista'

export default function PaginaVerificarEmail() {
  const t = useT()
  const { avisar } = useToast()
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'erro' | 'sem-token'>('carregando')
  const [email, setEmail] = useState('')
  const [reenviado, setReenviado] = useState(false)
  // No StrictMode de desenvolvimento o efeito monta duas vezes; um token de
  // uso único não pode ser consumido duas vezes sob pena de virar "erro".
  const processado = useRef(false)

  useEffect(() => {
    if (processado.current) {
      return
    }
    processado.current = true
    const token = new URLSearchParams(window.location.search).get('token')
    if (!token) {
      setEstado('sem-token')
      return
    }

    void executarOtimista({
      aplicar: () => undefined,
      executar: async () => {
        const resposta = await fetch('/api/v1/auth/verificar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        if (!resposta.ok) {
          throw new Error(t('verificarErro'))
        }
        setEstado('ok')
      },
      aoErro: () => setEstado('erro'),
    })
  }, [t])

  async function reenviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    await executarOtimista({
      aplicar: () => undefined,
      executar: async () => {
        const resposta = await fetch('/api/v1/auth/verificar/reenviar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
        if (!resposta.ok) {
          throw new Error(t('verificarErro'))
        }
        setReenviado(true)
        avisar(t('verificarReenviado'), 'info')
      },
      aoErro: () => avisar(t('verificarErro'), 'erro'),
    })
  }

  return (
    <main className="grid items-stretch gap-6 py-4 lg:grid-cols-[1fr_minmax(0,32rem)]">
      <section className="hidden flex-col justify-center gap-4 rounded-2xl p-10 lg:flex">
        <p className="eyebrow">{t('appNome')}</p>
        <p className="font-display text-3xl leading-tight tracking-tight">{t('verificarTitulo')}</p>
      </section>

      <section className="card reveal p-6 sm:p-8">
        <h1>{t('verificarTitulo')}</h1>

        {estado === 'carregando' && (
          <p role="status" className="mt-6 text-sm text-muted">
            {t('carregando')}
          </p>
        )}
        {estado === 'ok' && (
          <p role="status" className="mt-6 rounded-xl bg-surface-2 p-4 text-sm font-medium">
            {t('verificarSucesso')}
          </p>
        )}
        {(estado === 'erro' || estado === 'sem-token') && (
          <p role="alert" className="mt-6 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
            {t('verificarErro')}
          </p>
        )}

        <form onSubmit={reenviar} className="mt-8 space-y-5">
          <div>
            <label htmlFor="email" className="label">
              {t('verificarEmailLabel')}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(evento) => setEmail(evento.target.value)}
              required
              autoComplete="email"
              className="input"
            />
          </div>
          <button type="submit" className="btn btn-soft w-full">
            {t('verificarReenviar')}
          </button>
          {reenviado && (
            <p role="status" className="text-xs leading-relaxed text-muted">
              {t('verificarReenviado')}
            </p>
          )}
        </form>

        <div className="divider my-6" />
        <Link href="/login" className="link inline-flex min-h-11 items-center">
          {t('verificarLogin')}
        </Link>
      </section>
    </main>
  )
}
