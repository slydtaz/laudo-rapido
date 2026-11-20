'use client'

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
          avisos.push(
            t('visitaAvisoTamanho', { n: obtido.errosTamanho, limite: LIMITE_MB }),
          )
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
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{t('visitaTitulo')}</h1>
        <p className="text-sm text-slate-600">{t('visitaSubtitulo')}</p>
        <a href="/" className="text-sm text-teal-700 underline">
          {t('voltarInicio')}
        </a>
      </header>

      <form onSubmit={salvar} className="space-y-5">
        <div className="space-y-1">
          <label htmlFor="cliente" className="block font-medium">
            {t('visitaCliente')}
          </label>
          <input
            id="cliente"
            value={cliente}
            onChange={(event) => setRascunho((atual) => ({ ...atual, cliente: event.target.value }))}
            required
            className="w-full rounded border border-slate-300 px-3 py-2"
            placeholder={t('visitaClientePlaceholder')}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="tipo" className="block font-medium">
              {t('visitaTipo')}
            </label>
            <input
              id="tipo"
              value={tipo}
              onChange={(event) => setRascunho((atual) => ({ ...atual, tipo: event.target.value }))}
              className="w-full rounded border border-slate-300 px-3 py-2"
              placeholder={t('visitaTipoPlaceholder')}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="modelo" className="block font-medium">
              {t('visitaModelo')}
            </label>
            <select
              id="modelo"
              value={modeloId}
              onChange={(event) => setRascunho((atual) => ({ ...atual, modeloId: event.target.value }))}
              className="w-full rounded border border-slate-300 px-3 py-2"
            >
              <option value="">{t('visitaSemModelo')}</option>
              {modelos.map((modelo) => (
                <option key={modelo.id} value={modelo.id}>
                  {modelo.nome}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">{t('visitaModeloDica')}</p>
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="observacoes" className="block font-medium">
            {t('visitaObservacoes')}
          </label>
          <textarea
            id="observacoes"
            value={observacoes}
            onChange={(event) => setRascunho((atual) => ({ ...atual, observacoes: event.target.value }))}
            maxLength={2000}
            rows={4}
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
          <p className="text-xs text-slate-500">
            {observacoes.length}/2000 {t('visitaCaracteres')}
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="fotos" className="block font-medium">
            {t('visitaFotos')}
          </label>
          <input
            id="fotos"
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={aoSelecionarFotos}
            className="block w-full text-sm"
          />
          <p className="text-xs text-slate-500">{t('visitaFotosDica')}</p>
          {fotos.length > 0 && (
            <ul className="text-sm text-slate-600">
              {fotos.map((foto, indice) => (
                <li key={`${foto.nome}-${indice}`}>
                  {foto.nome} — {(foto.blob.size / 1024).toFixed(0)} KB
                </li>
              ))}
            </ul>
          )}
        </div>

        <AssinaturaCanvas
          key={assinaturaChave}
          onAssinatura={(blob) => setRascunho((atual) => ({ ...atual, assinatura: blob }))}
        />

        {erro && (
          <p role="alert" className="rounded bg-red-50 p-3 text-red-700">
            {erro}
          </p>
        )}
        {mensagem && (
          <p role="status" className="rounded bg-teal-50 p-3 text-teal-800">
            {mensagem}
          </p>
        )}

        <button type="submit" className="rounded bg-teal-700 px-4 py-2 text-white">
          {t('visitaSalvar')}
        </button>
        {!empresaId && <p className="text-xs text-slate-500">{t('visitaAguarde')}</p>}
      </form>

      <section className="space-y-3 border-t border-slate-200 pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void sincronizar()}
            disabled={!empresaId}
            className="rounded bg-slate-800 px-4 py-2 text-white disabled:opacity-50"
          >
            {t('visitaSincronizar')}
          </button>
          <span className="text-sm text-slate-600">
            {pendentes} {t('visitaPendentes')}
          </span>
        </div>
        {resultado && (
          <p className="text-sm text-slate-600">
            {t('visitaUltimoEnvio')}: {resultado.enviadas} {t('visitaEnviadas')},{' '}
            {resultado.falhas} {t('visitaFalhas')}, {resultado.errosTamanho}{' '}
            {t('visitaErrosTamanho')}.
          </p>
        )}

        {empresaId && entregas.length > 0 && (
          <div className="space-y-2">
            <h2 className="font-medium">{t('visitaLinks')}</h2>
            <ul className="space-y-2">
              {entregas.map((entrega) => (
                <li key={entrega.clientId} className="flex flex-wrap items-center gap-2 text-sm">
                  <a href={`/o/${entrega.token}`} className="text-teal-700 underline">
                    /o/{entrega.token}
                  </a>
                  <button
                    type="button"
                    onClick={() => void copiarLink(entrega)}
                    className="rounded border border-slate-300 px-2 py-1"
                  >
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
