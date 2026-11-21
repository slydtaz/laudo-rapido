'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'

import { useToast } from '@/components/ToastProvider'
import type { LinkDemo } from '@/lib/auth/email'
import { useT } from '@/lib/i18n/useT'
import { executarOtimista } from '@/lib/ui/acao-otimista'

export default function PaginaEsqueciSenha() {
  const t = useT()
  const { avisar } = useToast()
  const [email, setEmail] = useState('')
  const [respondido, setRespondido] = useState(false)
  const [links, setLinks] = useState<LinkDemo[]>([])

  async function solicitar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    avisar(t('carregando'), 'info')

    await executarOtimista({
      aplicar: () => undefined,
      executar: async () => {
        const resposta = await fetch('/api/v1/auth/senha/esqueci', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
        if (!resposta.ok) {
          throw new Error(t('redefinirErro'))
        }
        setRespondido(true)

        // A caixa demo não recebe e-mail como parâmetro: a resposta do POST
        // continua genérica e idêntica para qualquer endereço.
        const caixa = await fetch('/api/v1/auth/demo-links').catch(() => null)
        if (caixa?.ok) {
          const corpo = (await caixa.json().catch(() => ({}))) as { links?: LinkDemo[] }
          setLinks(Array.isArray(corpo.links) ? corpo.links : [])
        }
      },
      aoErro: () => avisar(t('redefinirErro'), 'erro'),
    })
  }

  const linksRedefinicao = links.filter((link) => link.tipo === 'redefinir_senha')

  return (
    <main className="grid items-stretch gap-6 py-4 lg:grid-cols-[1fr_minmax(0,32rem)]">
      <section className="hidden flex-col justify-center gap-4 rounded-2xl p-10 lg:flex">
        <p className="eyebrow">{t('appNome')}</p>
        <p className="font-display text-3xl leading-tight tracking-tight">{t('esqueciTitulo')}</p>
        <p className="max-w-md text-sm leading-relaxed text-muted">{t('esqueciSubtitulo')}</p>
      </section>

      <section className="card reveal p-6 sm:p-8">
        <h1>{t('esqueciTitulo')}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t('esqueciSubtitulo')}</p>

        <form onSubmit={solicitar} className="mt-8 space-y-5">
          <div>
            <label htmlFor="email" className="label">
              {t('esqueciEmailLabel')}
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
          <button type="submit" className="btn btn-primary w-full">
            {t('esqueciBotao')}
          </button>
        </form>

        {respondido && (
          <div className="mt-6 space-y-3 rounded-xl bg-surface-2 p-4">
            <p role="status" className="text-sm font-medium">
              {t('esqueciResposta')}
            </p>
            {linksRedefinicao.length > 0 && (
              <>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                  {t('esqueciDemoTitulo')}
                </p>
                <p className="text-xs leading-relaxed text-muted">{t('esqueciDemoDica')}</p>
                {linksRedefinicao.map((link) => (
                  <Link
                    key={link.token}
                    href={link.link}
                    className="link block min-h-11 break-all py-2"
                  >
                    {link.link}
                  </Link>
                ))}
              </>
            )}
          </div>
        )}

        <div className="divider my-6" />
        <Link href="/login" className="link inline-flex min-h-11 items-center">
          {t('esqueciLogin')}
        </Link>
      </section>
    </main>
  )
}
