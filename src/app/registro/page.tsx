'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'

import BotaoGoogle from '@/components/BotaoGoogle'
import { useToast } from '@/components/ToastProvider'
import { useT } from '@/lib/i18n/useT'
import { executarOtimista } from '@/lib/ui/acao-otimista'

type RespostaRegistro = {
  ok?: boolean
  erro?: string
  mensagem?: string
  link?: string
}

export default function PaginaRegistro() {
  const t = useT()
  const { avisar } = useToast()
  const [nome, setNome] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [linkDemo, setLinkDemo] = useState('')

  async function registrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    avisar(t('carregando'), 'info')

    await executarOtimista({
      aplicar: () => {
        setErro('')
        setLinkDemo('')
        return undefined
      },
      executar: async () => {
        const resposta = await fetch('/api/v1/auth/registro', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome, empresa, email, senha }),
        })
        const corpo = (await resposta.json().catch(() => ({}))) as RespostaRegistro
        if (!resposta.ok || !corpo.ok) {
          throw new Error(corpo.erro ?? t('registroErro'))
        }
        setLinkDemo(corpo.link ?? '')
      },
      aoErro: (falha) => {
        const mensagem = falha instanceof Error ? falha.message : t('registroErro')
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
            {t('registroTitulo')}
          </p>
          <p className="mt-4 text-sm leading-relaxed opacity-90">{t('registroSubtitulo')}</p>
        </div>
        <p className="text-xs opacity-70">{t('planosAviso')}</p>
      </section>

      <section className="card reveal p-6 sm:p-8">
        <h1>{t('registroTitulo')}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t('registroSubtitulo')}</p>

        {erro && (
          <p role="alert" className="mt-6 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
            {erro}
          </p>
        )}

        {linkDemo ? (
          <div className="mt-6 space-y-3 rounded-xl bg-surface-2 p-4">
            <p role="status" className="text-sm font-medium">
              {t('registroSucesso')}
            </p>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">
              {t('registroDemoTitulo')}
            </p>
            <Link href={linkDemo} className="link inline-flex min-h-11 items-center">
              {t('registroAbrirLink')}
            </Link>
          </div>
        ) : (
          <form onSubmit={registrar} className="mt-8 space-y-5">
            <div>
              <label htmlFor="nome" className="label">
                {t('registroNome')}
              </label>
              <input
                id="nome"
                type="text"
                value={nome}
                onChange={(evento) => setNome(evento.target.value)}
                required
                autoComplete="name"
                className="input"
              />
            </div>

            <div>
              <label htmlFor="empresa" className="label">
                {t('registroEmpresa')}
              </label>
              <input
                id="empresa"
                type="text"
                value={empresa}
                onChange={(evento) => setEmpresa(evento.target.value)}
                required
                autoComplete="organization"
                className="input"
              />
            </div>

            <div>
              <label htmlFor="email" className="label">
                {t('registroEmailLabel')}
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
                {t('registroSenha')}
              </label>
              <input
                id="senha"
                type="password"
                value={senha}
                onChange={(evento) => setSenha(evento.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="input"
              />
            </div>

            <button type="submit" className="btn btn-primary w-full">
              {t('registroBotao')}
            </button>
          </form>
        )}

        <div className="divider my-6" />
        <div className="space-y-3">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-muted">
            {t('googleOu')}
          </p>
          <BotaoGoogle />
          <p className="text-center text-xs leading-relaxed text-muted">
            {t('googleDemoAviso')}
          </p>
        </div>

        <div className="divider my-6" />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">{t('registroJaConta')}</span>
          <Link href="/login" className="link inline-flex min-h-11 items-center">
            {t('loginBotao')}
          </Link>
        </div>
      </section>
    </main>
  )
}
