'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'

import { useConfiguracao } from '@/components/ProvedorConfiguracao'
import { usePreferencias } from '@/components/ProvedorPreferencias'
import { useToast } from '@/components/ToastProvider'
import { IDIOMAS, type Preferencias } from '@/lib/config/preferencias'
import { configuracaoPadrao, type PlanoConfig } from '@/lib/configuracao/modelo'
import { ptBR, type ChaveTexto } from '@/lib/i18n/dicionario'
import { useT } from '@/lib/i18n/useT'
import {
  CATALOGO_PLANOS,
  ID_CONFIG_POR_PLANO,
  textoPlanoPermitido,
} from '@/lib/saas/planos'
import { executarOtimista } from '@/lib/ui/acao-otimista'

type Opcao<T extends string> = { valor: T; rotulo: string }
type CampoPlano = 'nome' | 'dica' | 'itens'
type IdPlanoConfig = PlanoConfig['id']
type Edicoes = {
  textos: Partial<Record<ChaveTexto, string>>
  planos: Partial<Record<IdPlanoConfig, Partial<Record<CampoPlano, string>>>>
}

// Aviso legal e preços ficam de fora: pertencem ao catálogo, não ao editor.
const CHAVES_TEXTO_EDITAVEIS: ChaveTexto[] = ['loginBotao', 'homeTitulo', 'planosTitulo']
const CAMPOS_PLANO: CampoPlano[] = ['nome', 'dica', 'itens']

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

/**
 * Um plano editado é reconstruído a partir do que está publicado ou, se ainda
 * não houver publicação, do catálogo PT-BR. O preço é sempre recalculado pelo
 * catálogo: nem o idioma ativo nem uma configuração antiga podem alterá-lo.
 */
function planoEditado(
  planoCatalogo: (typeof CATALOGO_PLANOS)[number],
  id: IdPlanoConfig,
  publicado: PlanoConfig | undefined,
  edicao: Partial<Record<CampoPlano, string>>,
): PlanoConfig {
  const base: PlanoConfig = publicado ?? {
    id,
    nome: ptBR[planoCatalogo.nome],
    preco: ptBR[planoCatalogo.preco],
    dica: ptBR[planoCatalogo.dica],
    itens: ptBR[planoCatalogo.itens],
  }
  const resultado: PlanoConfig = { ...base, preco: ptBR[planoCatalogo.preco] }
  for (const campo of CAMPOS_PLANO) {
    const valor = edicao[campo]
    if (valor !== undefined) resultado[campo] = textoPlanoPermitido(valor, base[campo])
  }
  return resultado
}

/** Planos sem publicação e sem edição não entram no PUT. */
function montarPlanos(publicados: PlanoConfig[], edicoes: Edicoes['planos']): PlanoConfig[] {
  return CATALOGO_PLANOS.flatMap((planoCatalogo) => {
    const id = ID_CONFIG_POR_PLANO[planoCatalogo.id]
    const publicado = publicados.find((item) => item.id === id)
    const edicao = edicoes[id]
    if (edicao) return [planoEditado(planoCatalogo, id, publicado, edicao)]
    return publicado ? [publicado] : []
  })
}

function EditorConteudo() {
  const t = useT()
  const { configuracao, salvar } = useConfiguracao()
  const { avisar } = useToast()
  // Os campos começam vazios: t(...) é apenas placeholder, nunca valor. Assim
  // trocar de idioma não transforma o texto ativo em sobrescrição global.
  const [edicoes, setEdicoes] = useState<Edicoes>(() => ({ textos: {}, planos: {} }))

  function mudarTexto(chave: ChaveTexto, valor: string) {
    setEdicoes((atual) => {
      const textos = { ...atual.textos }
      if (valor.trim() === '') delete textos[chave]
      else textos[chave] = valor
      return { ...atual, textos }
    })
  }

  function mudarPlano(id: IdPlanoConfig, campo: CampoPlano, valor: string) {
    setEdicoes((atual) => {
      const campos = { ...(atual.planos[id] ?? {}) }
      if (valor.trim() === '') delete campos[campo]
      else campos[campo] = valor
      const planos = { ...atual.planos }
      if (Object.keys(campos).length === 0) delete planos[id]
      else planos[id] = campos
      return { ...atual, planos }
    })
  }

  async function salvarConteudo() {
    try {
      const publicada = configuracao ?? configuracaoPadrao()
      const textos = { ...publicada.textos }
      for (const [chave, valor] of Object.entries(edicoes.textos) as Array<
        [ChaveTexto, string]
      >) {
        textos[chave] = textoPlanoPermitido(valor, publicada.textos[chave] ?? ptBR[chave])
      }
      await salvar({
        versao: publicada.versao,
        textos,
        planos: montarPlanos(publicada.planos, edicoes.planos),
      })
      avisar(t('configConteudoSalvo'))
    } catch {
      avisar(t('loginErroServidor'), 'erro')
    }
  }

  const rotuloCampo: Record<CampoPlano, string> = {
    nome: t('configCampoNome'),
    dica: t('configCampoDica'),
    itens: t('configCampoItens'),
  }

  return (
    <section className="card reveal space-y-6 p-5 sm:p-8" aria-label={t('configConteudo')}>
      <Secao titulo={t('configConteudo')}>
        <p className="rounded-xl bg-surface-2 p-3 text-xs leading-relaxed text-muted" role="note">
          {t('configTextosAvisoGlobal')}
        </p>

        <div className="space-y-4">
          <h3 className="font-medium">{t('configTextos')}</h3>
          {CHAVES_TEXTO_EDITAVEIS.map((chave) => (
            <div key={chave} className="space-y-2">
              <label htmlFor={`config-texto-${chave}`} className="label">
                {t(chave)}
              </label>
              <input
                id={`config-texto-${chave}`}
                className="input"
                placeholder={t(chave)}
                value={edicoes.textos[chave] ?? ''}
                onChange={(evento) => mudarTexto(chave, evento.target.value)}
              />
              <p className="text-xs text-muted">{chave}</p>
            </div>
          ))}
        </div>

        <div className="divider" />

        <div className="space-y-4">
          <h3 className="font-medium">{t('configPlanos')}</h3>
          {CATALOGO_PLANOS.map((plano) => {
            const id = ID_CONFIG_POR_PLANO[plano.id]
            const publicado = configuracao?.planos?.find((item) => item.id === id)
            return (
              <fieldset key={id} className="space-y-3 rounded-xl bg-surface-2 p-4">
                <legend className="px-1 font-medium">{t(plano.nome)}</legend>
                {CAMPOS_PLANO.map((campo) => (
                  <div key={campo} className="space-y-2">
                    <label htmlFor={`config-${id}-${campo}`} className="label">
                      {t(plano.nome)} · {rotuloCampo[campo]}
                    </label>
                    {campo === 'itens' ? (
                      <textarea
                        id={`config-${id}-${campo}`}
                        className="textarea"
                        placeholder={textoPlanoPermitido(publicado?.[campo], t(plano[campo]))}
                        value={edicoes.planos[id]?.[campo] ?? ''}
                        onChange={(evento) => mudarPlano(id, campo, evento.target.value)}
                      />
                    ) : (
                      <input
                        id={`config-${id}-${campo}`}
                        className="input"
                        placeholder={textoPlanoPermitido(publicado?.[campo], t(plano[campo]))}
                        value={edicoes.planos[id]?.[campo] ?? ''}
                        onChange={(evento) => mudarPlano(id, campo, evento.target.value)}
                      />
                    )}
                  </div>
                ))}
              </fieldset>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => void salvarConteudo()}
          className="btn btn-primary min-h-11"
        >
          {t('configSalvar')}
        </button>
      </Secao>
    </section>
  )
}

export default function ConfiguracoesPage() {
  const router = useRouter()
  const t = useT()
  const { avisar } = useToast()
  const { preferencias, atualizar } = usePreferencias()

  function mudar(parcial: Partial<Preferencias>) {
    atualizar(parcial)
    avisar(t('configSalvo'))
  }

  function sair() {
    void executarOtimista({
      aplicar: () => undefined,
      executar: async () => {
        const resposta = await fetch('/api/v1/auth/logout', { method: 'POST' })
        if (!resposta.ok) throw new Error('logout falhou')
      },
      aoSucesso: () => {
        avisar(t('configSaiu'))
        router.push('/login')
        router.refresh()
      },
      aoErro: () => avisar(t('loginErroServidor'), 'erro'),
    })
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

      <EditorConteudo />

      <section className="card reveal space-y-4 p-5 sm:p-8" aria-label={t('configSessao')}>
        <Secao titulo={t('configSessao')}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="max-w-md text-sm leading-relaxed text-muted">
              {t('configSairDica')}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/conta" className="link inline-flex min-h-11 items-center">
                {t('contaLinkConfig')}
              </Link>
              <button type="button" onClick={sair} className="btn btn-soft min-h-11">
                {t('configSair')}
              </button>
            </div>
          </div>
        </Secao>
      </section>

      <section className="card reveal space-y-3 p-5 sm:p-8">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-brand-strong">
          {t('configPrivacidadeTitulo')}
        </h2>
        <p className="text-sm leading-relaxed text-muted">
          {t('configPrivacidadeTexto')}{' '}
          <Link href="/privacidade" className="link">
            {t('legalRodapePrivacidade')}
          </Link>
        </p>
      </section>
    </main>
  )
}
