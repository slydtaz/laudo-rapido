'use client'

import Link from 'next/link'
import { useEffect, useState, type FormEvent } from 'react'

import { useToast } from '@/components/ToastProvider'
import { useT } from '@/lib/i18n/useT'
import { executarOtimista } from '@/lib/ui/acao-otimista'

export default function PaginaRedefinirSenha() {
  const t = useT()
  const { avisar } = useToast()
  const [token, setToken] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') ?? '')
  }, [])

  async function redefinir(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (senha !== confirmacao) {
      setErro(t('redefinirDiferente'))
      return
    }
    avisar(t('carregando'), 'info')

    await executarOtimista({
      aplicar: () => {
        setErro('')
        return undefined
      },
      executar: async () => {
        const resposta = await fetch('/api/v1/auth/senha/redefinir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, senha }),
        })
        const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string }
        if (!resposta.ok) {
          throw new Error(corpo.erro ?? t('redefinirErro'))
        }
        setSucesso(true)
      },
      aoErro: (falha) => {
        const mensagem = falha instanceof Error ? falha.message : t('redefinirErro')
        setErro(mensagem)
        avisar(mensagem, 'erro')
      },
    })
  }

  return (
    <main className="grid items-stretch gap-6 py-4 lg:grid-cols-[1fr_minmax(0,32rem)]">
      <section className="hidden flex-col justify-center gap-4 rounded-2xl p-10 lg:flex">
        <p className="eyebrow">{t('appNome')}</p>
        <p className="font-display text-3xl leading-tight tracking-tight">{t('redefinirTitulo')}</p>
      </section>

      <section className="card reveal p-6 sm:p-8">
        <h1>{t('redefinirTitulo')}</h1>

        {erro && (
          <p role="alert" className="mt-6 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
            {erro}
          </p>
        )}
        {sucesso && (
          <p role="status" className="mt-6 rounded-xl bg-surface-2 p-4 text-sm font-medium">
            {t('redefinirSucesso')}
          </p>
        )}

        {!sucesso && (
          <form onSubmit={redefinir} className="mt-8 space-y-5">
            <div>
              <label htmlFor="senha" className="label">
                {t('redefinirSenha')}
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
            <div>
              <label htmlFor="confirmacao" className="label">
                {t('redefinirConfirmacao')}
              </label>
              <input
                id="confirmacao"
                type="password"
                value={confirmacao}
                onChange={(evento) => setConfirmacao(evento.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="input"
              />
            </div>
            <button type="submit" className="btn btn-primary w-full">
              {t('redefinirBotao')}
            </button>
          </form>
        )}

        <div className="divider my-6" />
        <Link href="/login" className="link inline-flex min-h-11 items-center">
          {t('redefinirLogin')}
        </Link>
      </section>
    </main>
  )
}
