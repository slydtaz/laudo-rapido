'use client'

import Link from 'next/link'

import type { ChaveTexto } from '@/lib/i18n/dicionario'
import { useT } from '@/lib/i18n/useT'

type Plano = {
  nome: ChaveTexto
  preco: ChaveTexto
  dica: ChaveTexto
  itens: ChaveTexto
  destaque?: boolean
}

const PLANOS: Plano[] = [
  {
    nome: 'planoGratuito',
    preco: 'planoGratuitoPreco',
    dica: 'planoGratuitoDica',
    itens: 'planoGratuitoItens',
  },
  {
    nome: 'planoPro',
    preco: 'planoProPreco',
    dica: 'planoProDica',
    itens: 'planoProItens',
    destaque: true,
  },
  {
    nome: 'planoEmpresas',
    preco: 'planoEmpresasPreco',
    dica: 'planoEmpresasDica',
    itens: 'planoEmpresasItens',
  },
]

const FAQ: Array<[ChaveTexto, ChaveTexto]> = [
  ['planosFaq1P', 'planosFaq1R'],
  ['planosFaq2P', 'planosFaq2R'],
]

export default function PlanosPage() {
  const t = useT()

  return (
    <main className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <p className="eyebrow">{t('appNome')}</p>
          <h1 className="max-w-2xl">{t('planosTitulo')}</h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted">
            {t('planosSubtitulo')}
          </p>
        </div>
        <Link href="/" className="btn btn-ghost">
          {t('voltarInicio')}
        </Link>
      </header>

      <section className="grid gap-5 lg:grid-cols-3">
        {PLANOS.map((plano, indice) => (
          <article
            key={plano.nome}
            className={`card card-lift ${['reveal', 'reveal-2', 'reveal-3'][indice]} relative flex flex-col p-6 sm:p-7 ${
              plano.destaque ? 'border-brand' : ''
            }`}
          >
            {plano.destaque && (
              <span className="chip chip-brand absolute -top-3 right-5">
                {t('planoMais')}
              </span>
            )}
            <h2>{t(plano.nome)}</h2>
            <p className="mt-4 flex items-baseline gap-1">
              <span className="font-display text-3xl font-semibold tracking-tight">
                {t(plano.preco)}
              </span>
              {plano.nome !== 'planoEmpresas' && (
                <span className="text-sm text-muted">{t('planoPorMes')}</span>
              )}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              {t(plano.dica)}
            </p>
            <div className="divider my-6" />
            <ul className="flex-1 space-y-3 text-sm">
              {t(plano.itens)
                .split(';')
                .filter(Boolean)
                .map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span aria-hidden="true" className="mt-0.5 font-bold text-success">
                      ✓
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
            </ul>
            <Link
              href="/login"
              className={`btn mt-8 ${plano.destaque ? 'btn-primary' : 'btn-soft'}`}
            >
              {t('planosCta')}
            </Link>
          </article>
        ))}
      </section>

      <section className="card space-y-4 p-5 sm:p-8">
        <h2>{t('planosFaq')}</h2>
        {FAQ.map(([pergunta, resposta]) => (
          <details key={pergunta} className="group border-b border-line pb-4 last:border-0">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-medium">
              {t(pergunta)}
              <span aria-hidden="true" className="text-brand transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted">{t(resposta)}</p>
          </details>
        ))}
      </section>

      <p className="text-center text-xs leading-relaxed text-muted">{t('planosAviso')}</p>
    </main>
  )
}
