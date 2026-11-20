'use client'

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
    <main>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">{t('loginTitulo')}</h1>
        <p className="mt-1 text-sm text-slate-600">{t('loginSubtitulo')}</p>

        <form onSubmit={entrar} className="mt-6 space-y-4">
          <label className="block text-sm font-medium">
            {t('loginEmail')}
            <input
              type="email"
              value={email}
              onChange={(evento) => setEmail(evento.target.value)}
              required
              autoComplete="email"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
            />
          </label>

          <label className="block text-sm font-medium">
            {t('loginSenha')}
            <input
              type="password"
              value={senha}
              onChange={(evento) => setSenha(evento.target.value)}
              required
              autoComplete="current-password"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
            />
          </label>

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <button
            type="submit"
            className="w-full rounded-md bg-slate-900 px-4 py-2 font-medium text-white"
          >
            {t('loginBotao')}
          </button>
        </form>
      </div>
    </main>
  )
}
