'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react'

import AssinaturaCanvas from '@/components/AssinaturaCanvas'
import { useToast } from '@/components/ToastProvider'
import { useT } from '@/lib/i18n/useT'
import { reduzirFoto } from '@/lib/offline/fotos'
import { excedeLimite, TAMANHO_MAXIMO_MIDIA } from '@/lib/offline/imagem'
import {
  enfileirarVisita,
  entregasSalvas,
  pendenciasRestantes,
  sincronizarFila,
} from '@/lib/offline/queue'
import { proximoRascunho, rascunhoVazio, type RascunhoVisita } from '@/lib/offline/rascunho'
import { executarOtimista } from '@/lib/ui/acao-otimista'

type Modelo = { id: string; nome: string }
type FotoSelecionada = RascunhoVisita['fotos'][number]
type Entrega = Awaited<ReturnType<typeof entregasSalvas>>[number]
type ResultadoSync = Awaited<ReturnType<typeof sincronizarFila>>

const LIMITE_MB = Math.round(TAMANHO_MAXIMO_MIDIA / 1024 / 1024)

export default function NovaVisitaPage() {
  const t = useT()
  const { avisar } = useToast()
  const [clientId, setClientId] = useState('')
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [rascunho, setRascunho] = useState<RascunhoVisita>(() => rascunhoVazio())
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [pendentes, setPendentes] = useState(0)
  const [entregas, setEntregas] = useState<Entrega[]>([])
  const [resultado, setResultado] = useState<ResultadoSync | null>(null)

  const { cliente, tipo, observacoes, modeloId, fotos, assinatura, assinaturaChave } = rascunho

  const atualizarEstado = useCallback(async (tenant: string) => {
    setPendentes(await pendenciasRestantes(tenant))
    setEntregas(await entregasSalvas(tenant))
  }, [])

  const carregarModelos = useCallback(async () => {
    try {
      const resposta = await fetch('/api/v1/modelos')
      if (!resposta.ok) {
        return
      }
      const corpo = (await resposta.json()) as { modelos: Modelo[] }
      setModelos(corpo.modelos)
    } catch {
      // Modelos são opcionais: o técnico pode digitar o tipo manualmente.
    }
  }, [])

  const carregarSessao = useCallback(async () => {
    try {
      const resposta = await fetch('/api/v1/sessao')
      if (!resposta.ok) {
        setErro(t('visitaErroSessao'))
        return
      }
      const corpo = (await resposta.json()) as { empresaId: string }
      if (corpo.empresaId) {
        setEmpresaId(corpo.empresaId)
      } else {
        setErro(t('visitaErroEmpresa'))
      }
    } catch {
      setErro(t('visitaErroEmpresa'))
    }
  }, [t])

  const sincronizar = useCallback(async () => {
    if (!empresaId) {
      return
    }
    setErro(null)
    setMensagem(null)
    avisar(t('visitaEnviando'), 'info')

    await executarOtimista({
      aplicar: () => pendentes,
      executar: async () => {
        const obtido = await sincronizarFila(empresaId)
        setResultado(obtido)
        await atualizarEstado(empresaId)
        return obtido
      },
      desfazer: (anterior) => setPendentes(anterior),
      aoSucesso: (valor) => {
        const obtido = valor as ResultadoSync
        if (obtido.enviadas > 0) {
          const texto = t('visitaEnviadasToast', { n: obtido.enviadas })
          setMensagem(texto)
          avisar(texto)
        }
        const avisos: string[] = []
        if (obtido.errosTamanho > 0) {
          avisos.push(t('visitaAvisoTamanho', { n: obtido.errosTamanho, limite: LIMITE_MB }))
        }
        if (obtido.falhas > 0) {
          avisos.push(t('visitaAvisoFalhas', { n: obtido.falhas }))
        }
        if (avisos.length > 0) {
          setErro(avisos.join(' '))
          avisar(avisos.join(' '), 'erro')
        }
      },
      aoErro: () => {
        const texto = t('visitaErroSync')
        setErro(texto)
        avisar(texto, 'erro')
      },
    })
  }, [empresaId, pendentes, atualizarEstado, avisar, t])

  useEffect(() => {
    // UUIDv4 gerado no navegador: chave de idempotência da visita (RF-08).
    setClientId(crypto.randomUUID())
    void carregarSessao()
    void carregarModelos()
  }, [carregarSessao, carregarModelos])

  useEffect(() => {
    // Fila e links só são lidos quando o tenant é conhecido: nunca mostramos
    // pendências/links de outra conta num aparelho compartilhado.
    if (empresaId) {
      void atualizarEstado(empresaId)
    }
  }, [empresaId, atualizarEstado])

  useEffect(() => {
    const aoFicarOnline = () => {
      void sincronizar()
    }
    window.addEventListener('online', aoFicarOnline)
    return () => window.removeEventListener('online', aoFicarOnline)
  }, [sincronizar])

  async function aoSelecionarFotos(event: ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(event.target.files ?? [])
    event.target.value = '' // permite selecionar o mesmo arquivo novamente
    if (arquivos.length === 0) {
      return
    }
    setErro(null)
    try {
      const reduzidas: FotoSelecionada[] = []
      for (const arquivo of arquivos) {
        if (!arquivo.type.startsWith('image/')) {
          throw new Error(t('visitaErroImagem', { nome: arquivo.name }))
        }
        const capturadoEm = new Date()
        const blob = await reduzirFoto(arquivo)
        reduzidas.push({ blob, capturadoEm, nome: arquivo.name })
      }
      setRascunho((atual) => ({ ...atual, fotos: [...atual.fotos, ...reduzidas] }))
    } catch (falha) {
      const texto = falha instanceof Error ? falha.message : t('visitaErroSalvar')
      setErro(texto)
      avisar(texto, 'erro')
    }
  }

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErro(null)
    setMensagem(null)

    if (!empresaId) {
      setErro(t('visitaAguarde'))
      return
    }

    const id = clientId || crypto.randomUUID()
    const tipoFinal = tipo.trim() || modelos.find((modelo) => modelo.id === modeloId)?.nome.trim() || ''
    if (!cliente.trim()) {
      setErro(t('visitaErroCliente'))
      return
    }
    if (!tipoFinal) {
      setErro(t('visitaErroTipo'))
      return
    }
    const tamanhos = [...fotos.map((foto) => foto.blob.size), ...(assinatura ? [assinatura.size] : [])]
    if (excedeLimite(tamanhos)) {
      setErro(t('visitaErroTamanho', { limite: LIMITE_MB }))
      return
    }

    const rascunhoAnterior = rascunho
    const clientIdAnterior = clientId
    const pendentesAnteriores = pendentes

    await executarOtimista({
      aplicar: () => {
        // Uma única transição atômica limpa TODOS os campos, inclusive a
        // assinatura, e avança a chave: o canvas remonta em branco e notifica
        // `null`, mantendo pai e componente sincronizados para a próxima visita.
        setRascunho(proximoRascunho(assinaturaChave))
        setClientId(crypto.randomUUID())
        setPendentes((atual) => atual + 1)
        setResultado(null)
        avisar(t('visitaSalva'))
      },
      executar: async () => {
        await enfileirarVisita(
          {
            clientId: id,
            modeloId: modeloId || undefined,
            dados: {
              cliente: cliente.trim(),
              tipo: tipoFinal,
              observacoes,
            },
            capturadoEm: new Date(),
            fotos: fotos.map(({ blob, capturadoEm }) => ({ blob, capturadoEm })),
            assinatura: assinatura ?? undefined,
          },
          empresaId,
        )
        await atualizarEstado(empresaId)
      },
      desfazer: () => {
        setRascunho(rascunhoAnterior)
        setClientId(clientIdAnterior)
        setPendentes(pendentesAnteriores)
      },
      aoErro: () => {
        const texto = t('visitaErroSalvar')
        setErro(texto)
        avisar(texto, 'erro')
      },
    })
  }

  async function copiarLink(entrega: Entrega) {
    await executarOtimista({
      aplicar: () => undefined,
      executar: async () => {
        await navigator.clipboard.writeText(`${window.location.origin}/o/${entrega.token}`)
      },
      aoSucesso: () => avisar(t('visitaCopiado')),
      aoErro: () => {
        const texto = 'Não foi possível copiar. Selecione o link e copie manualmente.'
        setErro(texto)
        avisar(texto, 'erro')
      },
    })
  }

  return (
    <main className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="eyebrow">{t('homeEyebrow')}</p>
          <h1>{t('visitaTitulo')}</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted">{t('visitaSubtitulo')}</p>
        </div>
        <Link href="/" className="btn btn-ghost">
          {t('voltarInicio')}
        </Link>
      </header>

      <form onSubmit={salvar} className="card space-y-6 p-5 sm:p-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="cliente" className="label">
              {t('visitaCliente')}
            </label>
            <input
              id="cliente"
              value={cliente}
              onChange={(event) => setRascunho((atual) => ({ ...atual, cliente: event.target.value }))}
              required
              className="input"
              placeholder={t('visitaClientePlaceholder')}
            />
          </div>

          <div>
            <label htmlFor="tipo" className="label">
              {t('visitaTipo')}
            </label>
            <input
              id="tipo"
              value={tipo}
              onChange={(event) => setRascunho((atual) => ({ ...atual, tipo: event.target.value }))}
              className="input"
              placeholder={t('visitaTipoPlaceholder')}
            />
          </div>

          <div>
            <label htmlFor="modelo" className="label">
              {t('visitaModelo')}
            </label>
            <select
              id="modelo"
              value={modeloId}
              onChange={(event) => setRascunho((atual) => ({ ...atual, modeloId: event.target.value }))}
              className="select"
            >
              <option value="">{t('visitaSemModelo')}</option>
              {modelos.map((modelo) => (
                <option key={modelo.id} value={modelo.id}>
                  {modelo.nome}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs leading-relaxed text-muted">{t('visitaModeloDica')}</p>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="observacoes" className="label">
              {t('visitaObservacoes')}
            </label>
            <textarea
              id="observacoes"
              value={observacoes}
              onChange={(event) => setRascunho((atual) => ({ ...atual, observacoes: event.target.value }))}
              maxLength={2000}
              rows={4}
              className="textarea"
            />
            <p className="mt-2 text-xs text-muted">
              {observacoes.length}/2000 {t('visitaCaracteres')}
            </p>
          </div>
        </div>

        <div className="divider" />

        <div className="space-y-3">
          <label htmlFor="fotos" className="label">
            {t('visitaFotos')}
          </label>
          <div className="rounded-xl border border-dashed border-line bg-surface-2 px-4 py-5">
            <input
              id="fotos"
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={aoSelecionarFotos}
              className="block min-h-11 w-full py-2 text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-2 file:text-sm file:font-semibold file:text-on-brand"
            />
          </div>
          <p className="text-xs leading-relaxed text-muted">{t('visitaFotosDica')}</p>
          {fotos.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {fotos.map((foto, indice) => (
                <li key={`${foto.nome}-${indice}`} className="chip chip-brand max-w-full">
                  <span className="truncate">{foto.nome}</span>
                  <span className="opacity-70">{(foto.blob.size / 1024).toFixed(0)} KB</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="divider" />

        <AssinaturaCanvas
          key={assinaturaChave}
          onAssinatura={(blob) => setRascunho((atual) => ({ ...atual, assinatura: blob }))}
        />

        {erro && (
          <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
            {erro}
          </p>
        )}
        {mensagem && (
          <p role="status" className="rounded-xl bg-success-soft px-4 py-3 text-sm text-success">
            {mensagem}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn btn-primary">
            {t('visitaSalvar')}
          </button>
          {!empresaId && <p className="text-xs text-muted">{t('visitaAguarde')}</p>}
        </div>
      </form>

      <section className="card space-y-4 p-5 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2>{t('autoSync')}</h2>
            <p className="mt-1 text-sm text-muted">
              {pendentes} {t('visitaPendentes')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void sincronizar()}
            disabled={!empresaId}
            className="btn btn-soft"
          >
            {t('visitaSincronizar')}
          </button>
        </div>

        {resultado && (
          <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">
            {t('visitaUltimoEnvio')}: {resultado.enviadas} {t('visitaEnviadas')},{' '}
            {resultado.falhas} {t('visitaFalhas')}, {resultado.errosTamanho}{' '}
            {t('visitaErrosTamanho')}.
          </p>
        )}

        {empresaId && entregas.length > 0 && (
          <div className="space-y-3">
            <div className="divider" />
            <h3>{t('visitaLinks')}</h3>
            <ul className="space-y-2">
              {entregas.map((entrega) => (
                <li
                  key={entrega.clientId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 px-4 py-3 text-sm"
                >
                  <a href={`/o/${entrega.token}`} className="link truncate">
                    /o/{entrega.token}
                  </a>
                  <button type="button" onClick={() => void copiarLink(entrega)} className="btn btn-ghost">
                    {t('visitaCopiar')}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  )
}
