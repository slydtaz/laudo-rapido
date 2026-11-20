'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

import { useToast } from '@/components/ToastProvider'
import { IDIOMAS, type Preferencias } from '@/lib/config/preferencias'
import { usePreferencias } from '@/components/ProvedorPreferencias'
import { useT } from '@/lib/i18n/useT'

type Opcao<T extends string> = { valor: T; rotulo: string }

function Grupo<T extends string>({
  titulo,
  dica,
  valor,
  opcoes,
  aoEscolher,
}: {
  titulo: string
  dica?: string
  valor: T
  opcoes: Array<Opcao<T>>
  aoEscolher: (valor: T) => void
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="label">{titulo}</legend>
      <div className="flex flex-wrap gap-2" role="group" aria-label={titulo}>
        {opcoes.map((opcao) => (
          <button
            key={opcao.valor}
            type="button"
            aria-pressed={valor === opcao.valor}
            onClick={() => aoEscolher(opcao.valor)}
            className={
              valor === opcao.valor
                ? 'btn btn-primary min-h-11'
                : 'btn btn-soft min-h-11'
            }
          >
            {opcao.rotulo}
          </button>
        ))}
      </div>
      {dica && <p className="text-xs leading-relaxed text-muted">{dica}</p>}
    </fieldset>
  )
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-5">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-brand-strong">
        {titulo}
      </h2>
      {children}
    </section>
  )
}

export default function ConfiguracoesPage() {
  const t = useT()
  const { avisar } = useToast()
  const { preferencias, atualizar } = usePreferencias()

  function mudar(parcial: Partial<Preferencias>) {
    atualizar(parcial)
    avisar(t('configSalvo'))
  }

  return (
    <main className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="eyebrow">{t('appNome')}</p>
          <h1>{t('configTitulo')}</h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted">
            {t('configSubtitulo')}
          </p>
        </div>
        <Link href="/" className="btn btn-ghost">
          {t('voltarInicio')}
        </Link>
      </header>

      <form
        onSubmit={(evento) => evento.preventDefault()}
        className="card reveal space-y-8 p-5 sm:p-8"
      >
        <Secao titulo={t('tema')}>
          <Grupo
            titulo={t('tema')}
            valor={preferencias.tema}
            aoEscolher={(tema) => mudar({ tema })}
            opcoes={[
              { valor: 'claro', rotulo: t('configTemaClaro') },
              { valor: 'escuro', rotulo: t('configTemaEscuro') },
              { valor: 'sistema', rotulo: t('configTemaSistema') },
            ]}
          />
          <Grupo
            titulo={t('tamanhoTexto')}
            valor={preferencias.tamanhoTexto}
            aoEscolher={(tamanhoTexto) => mudar({ tamanhoTexto })}
            opcoes={[
              { valor: 'normal', rotulo: t('configTextoNormal') },
              { valor: 'grande', rotulo: t('configTextoGrande') },
              { valor: 'extra', rotulo: t('configTextoExtra') },
            ]}
          />
        </Secao>

        <div className="divider" />

        <Secao titulo={t('idioma')}>
          <label htmlFor="idioma" className="label">
            {t('idioma')}
          </label>
          <select
            id="idioma"
            className="select"
            value={preferencias.idioma}
            onChange={(evento) => {
              const idioma = evento.target.value as Preferencias['idioma']
              mudar({ idioma })
            }}
          >
            {IDIOMAS.map((idioma) => (
              <option key={idioma.codigo} value={idioma.codigo}>
                {idioma.nome}
              </option>
            ))}
          </select>
        </Secao>

        <div className="divider" />

        <Secao titulo={t('movimento')}>
          <Grupo
            titulo={t('movimento')}
            valor={preferencias.movimento}
            aoEscolher={(movimento) => mudar({ movimento })}
            opcoes={[
              { valor: 'completo', rotulo: t('configMovimentoCompleto') },
              { valor: 'reduzido', rotulo: t('configMovimentoReduzido') },
            ]}
          />

          <div className="flex items-start gap-3 rounded-xl bg-surface-2 p-4">
            <input
              id="autoSync"
              type="checkbox"
              checked={preferencias.autoSync}
              onChange={(evento) => mudar({ autoSync: evento.target.checked })}
              className="size-11 shrink-0 accent-[var(--brand)]"
            />
            <div className="space-y-1">
              <label htmlFor="autoSync" className="font-medium">
                {t('autoSync')}
              </label>
              <p className="text-xs leading-relaxed text-muted">
                {t('configAutoSyncDica')}
              </p>
            </div>
          </div>
        </Secao>
      </form>
    </main>
  )
}
