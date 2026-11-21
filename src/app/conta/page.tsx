'use client'

import Link from 'next/link'
import { useEffect, useState, type FormEvent } from 'react'

import { useToast } from '@/components/ToastProvider'
import { useT } from '@/lib/i18n/useT'
import { executarOtimista } from '@/lib/ui/acao-otimista'

type Perfil = {
  nome: string
  email: string
  empresa: string
  verificado: boolean
  provedor: 'senha' | 'google'
  criadoEm: string
}

export default function PaginaConta() {
  const t = useT()
  const { avisar } = useToast()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [nome, setNome] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [senhaAtual, setSenhaAtual] = useState('')
  const [senhaNova, setSenhaNova] = useState('')

  useEffect(() => {
    void (async () => {
      try {
        const resposta = await fetch('/api/v1/conta')
        if (!resposta.ok) {
          throw new Error(t('contaErro'))
        }
        const dados = (await resposta.json()) as Perfil
        setPerfil(dados)
        setNome(dados.nome)
        setEmpresa(dados.empresa)
      } catch {
        avisar(t('contaErro'), 'erro')
      } finally {
        setCarregando(false)
      }
    })()
  }, [avisar, t])

  async function salvarDados(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    await executarOtimista({
      aplicar: () => undefined,
      executar: async () => {
        const resposta = await fetch('/api/v1/conta', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome, empresa }),
        })
        if (!resposta.ok) {
          throw new Error(t('contaErro'))
        }
        avisar(t('contaSalvo'), 'info')
      },
      aoErro: () => avisar(t('contaErro'), 'erro'),
    })
  }

  async function alterarSenha(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    await executarOtimista({
      aplicar: () => undefined,
      executar: async () => {
        const resposta = await fetch('/api/v1/conta/senha', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            senhaAtual: perfil?.provedor === 'senha' ? senhaAtual : null,
            senhaNova,
          }),
        })
        const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string }
        if (!resposta.ok) {
          throw new Error(corpo.erro ?? t('contaErro'))
        }
        setSenhaAtual('')
        setSenhaNova('')
        avisar(t('contaSalvo'), 'info')
      },
      aoErro: (falha) => avisar(falha instanceof Error ? falha.message : t('contaErro'), 'erro'),
    })
  }

  return (
    <main className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="eyebrow">{t('appNome')}</p>
          <h1>{t('contaTitulo')}</h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted">{t('contaSubtitulo')}</p>
        </div>
        <Link href="/configuracoes" className="btn btn-ghost">
          {t('configuracoes')}
        </Link>
      </header>

      {carregando && (
        <p role="status" className="card p-6 text-sm text-muted">
          {t('carregando')}
        </p>
      )}

      {perfil && (
        <>
          <section className="card reveal space-y-3 p-5 sm:p-8" aria-label={t('contaTitulo')}>
            <p className="text-sm font-semibold">{perfil.nome}</p>
            <p className="text-sm text-muted">{perfil.email}</p>
            <p className="text-sm text-muted">{perfil.empresa}</p>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-strong">
              {perfil.verificado ? t('contaVerificado') : t('contaNaoVerificado')}
            </p>
            <p className="text-xs text-muted">
              {perfil.provedor === 'senha' ? t('contaProvedorSenha') : t('contaProvedorGoogle')}
            </p>
            <p className="text-xs text-muted">
              {t('contaCriado', {
                data: new Date(perfil.criadoEm).toLocaleDateString(),
              })}
            </p>
          </section>

          <form onSubmit={salvarDados} className="card reveal space-y-5 p-5 sm:p-8">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-brand-strong">
              {t('contaTitulo')}
            </h2>
            <div>
              <label htmlFor="nome" className="label">
                {t('contaNome')}
              </label>
              <input
                id="nome"
                className="input"
                value={nome}
                onChange={(evento) => setNome(evento.target.value)}
                required
                autoComplete="name"
              />
            </div>
            <div>
              <label htmlFor="empresa" className="label">
                {t('contaEmpresa')}
              </label>
              <input
                id="empresa"
                className="input"
                value={empresa}
                onChange={(evento) => setEmpresa(evento.target.value)}
                required
                autoComplete="organization"
              />
            </div>
            <button type="submit" className="btn btn-primary min-h-11">
              {t('contaBotaoSalvar')}
            </button>
          </form>

          <form onSubmit={alterarSenha} className="card reveal space-y-5 p-5 sm:p-8">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-brand-strong">
              {t('contaBotaoSenha')}
            </h2>
            {perfil.provedor === 'senha' && (
              <div>
                <label htmlFor="senhaAtual" className="label">
                  {t('contaSenhaAtual')}
                </label>
                <input
                  id="senhaAtual"
                  className="input"
                  type="password"
                  value={senhaAtual}
                  onChange={(evento) => setSenhaAtual(evento.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
            )}
            <div>
              <label htmlFor="senhaNova" className="label">
                {t('contaSenhaNova')}
              </label>
              <input
                id="senhaNova"
                className="input"
                type="password"
                value={senhaNova}
                onChange={(evento) => setSenhaNova(evento.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <button type="submit" className="btn btn-soft min-h-11">
              {t('contaBotaoSenha')}
            </button>
          </form>
        </>
      )}
    </main>
  )
}
