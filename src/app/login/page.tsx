'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

import { useToast } from '@/components/ToastProvider'
import { useT } from '@/lib/i18n/useT'
import { executarOtimista } from '@/lib/ui/acao-otimista'

export default function PaginaLogin() {
  const router = useRouter()
  const t = useT()
  const { avisar } = useToast()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')

  async function entrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    avisar(t('carregando'), 'info')

    await executarOtimista({
      aplicar: () => {
        setErro('')
        return erro
      },
      executar: async () => {
        const resposta = await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, senha }),
        })
        if (!resposta.ok) {
          const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string }
          throw new Error(corpo.erro ?? t('loginErroCredenciais'))
        }
      },
      desfazer: (erroAnterior) => setErro(erroAnterior),
      aoSucesso: () => {
        router.push('/')
        router.refresh()
      },
      aoErro: (falha) => {
        const mensagem = falha instanceof Error ? falha.message : t('loginErroServidor')
        setErro(mensagem)
        avisar(mensagem, 'erro')
      },
    })
  }

  return (
    <main className="grid items-stretch gap-6 lg:min-h-[80dvh] lg:grid-cols-[1fr_minmax(0,28rem)]">
      <section
        className="relative hidden overflow-hidden rounded-2xl p-10 text-on-brand lg:flex lg:flex-col lg:justify-between"
        style={{ background: 'var(--brand)' }}
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-11 place-items-center rounded-xl bg-on-brand/15 font-display text-sm font-bold"
          >
            LR
          </span>
          <span className="font-display font-semibold">{t('appNome')}</span>
        </div>
        <div className="max-w-md">
          <p className="font-display text-3xl leading-tight tracking-tight">
            {t('homeTitulo')}
          </p>
          <p className="mt-4 text-sm leading-relaxed opacity-90">{t('homeSubtitulo')}</p>
        </div>
        <p className="text-xs opacity-70">{t('planosAviso')}</p>
      </section>

      <section className="card reveal p-6 sm:p-8">
        <h1>{t('loginTitulo')}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t('loginSubtitulo')}</p>

        <form onSubmit={entrar} className="mt-8 space-y-5">
          <div>
            <label htmlFor="email" className="label">
              {t('loginEmail')}
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

          <div>
            <label htmlFor="senha" className="label">
              {t('loginSenha')}
            </label>
            <input
              id="senha"
              type="password"
              value={senha}
              onChange={(evento) => setSenha(evento.target.value)}
              required
              autoComplete="current-password"
              className="input"
            />
          </div>

          {erro && (
            <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
              {erro}
            </p>
          )}

          <button type="submit" className="btn btn-primary w-full">
            {t('loginBotao')}
          </button>
        </form>

        <div className="divider my-6" />
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <Link href="/" className="link inline-flex min-h-11 items-center">
            {t('voltarInicio')}
          </Link>
          <Link href="/planos" className="link inline-flex min-h-11 items-center">
            {t('planos')}
          </Link>
        </div>
      </section>
    </main>
  )
}
