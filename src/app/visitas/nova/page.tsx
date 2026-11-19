'use client'

import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react'

import AssinaturaCanvas from '@/components/AssinaturaCanvas'
import { reduzirFoto } from '@/lib/offline/fotos'
import { excedeLimite, TAMANHO_MAXIMO_MIDIA } from '@/lib/offline/imagem'
import {
  enfileirarVisita,
  entregasSalvas,
  pendenciasRestantes,
  sincronizarFila,
} from '@/lib/offline/queue'

type Modelo = { id: string; nome: string }
type FotoSelecionada = { blob: Blob; capturadoEm: Date; nome: string }
type Entrega = Awaited<ReturnType<typeof entregasSalvas>>[number]
type ResultadoSync = Awaited<ReturnType<typeof sincronizarFila>>

const LIMITE_MB = Math.round(TAMANHO_MAXIMO_MIDIA / 1024 / 1024)

export default function NovaVisitaPage() {
  const [clientId, setClientId] = useState('')
  const [cliente, setCliente] = useState('')
  const [tipo, setTipo] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [modeloId, setModeloId] = useState('')
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [fotos, setFotos] = useState<FotoSelecionada[]>([])
  const [assinatura, setAssinatura] = useState<Blob | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [pendentes, setPendentes] = useState(0)
  const [entregas, setEntregas] = useState<Entrega[]>([])
  const [resultado, setResultado] = useState<ResultadoSync | null>(null)

  const atualizarEstado = useCallback(async () => {
    setPendentes(await pendenciasRestantes())
    setEntregas(await entregasSalvas())
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

  const sincronizar = useCallback(async () => {
    setSincronizando(true)
    setErro(null)
    setMensagem(null)
    try {
      const obtido = await sincronizarFila()
      setResultado(obtido)
      await atualizarEstado()
      if (obtido.enviadas > 0) {
        setMensagem(`${obtido.enviadas} visita(s) enviada(s).`)
      }
      const avisos: string[] = []
      if (obtido.errosTamanho > 0) {
        avisos.push(
          `${obtido.errosTamanho} visita(s) não couberam no envio (limite de ${LIMITE_MB} MB). Remova fotos e salve uma nova visita.`,
        )
      }
      if (obtido.falhas > 0) {
        avisos.push(
          `${obtido.falhas} visita(s) ficaram pendentes por falha de conexão e serão reenviadas.`,
        )
      }
      if (avisos.length > 0) {
        setErro(avisos.join(' '))
      }
    } catch {
      setErro('Não foi possível sincronizar. Tente novamente quando houver internet.')
    } finally {
      setSincronizando(false)
    }
  }, [atualizarEstado])

  useEffect(() => {
    // UUIDv4 gerado no navegador: chave de idempotência da visita (RF-08).
    setClientId(crypto.randomUUID())
    void atualizarEstado()
    void carregarModelos()
  }, [atualizarEstado, carregarModelos])

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
          throw new Error(`"${arquivo.name}" não é uma imagem.`)
        }
        const capturadoEm = new Date()
        const blob = await reduzirFoto(arquivo)
        reduzidas.push({ blob, capturadoEm, nome: arquivo.name })
      }
      setFotos((anteriores) => [...anteriores, ...reduzidas])
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível processar as fotos.')
    }
  }

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErro(null)
    setMensagem(null)

    const id = clientId || crypto.randomUUID()
    const tipoFinal = tipo.trim() || modelos.find((modelo) => modelo.id === modeloId)?.nome.trim() || ''
    if (!cliente.trim()) {
      setErro('Informe o nome do cliente.')
      return
    }
    if (!tipoFinal) {
      setErro('Informe o tipo de visita ou selecione um modelo.')
      return
    }
    const tamanhos = [...fotos.map((foto) => foto.blob.size), ...(assinatura ? [assinatura.size] : [])]
    if (excedeLimite(tamanhos)) {
      setErro(
        `Fotos e assinatura passam de ${LIMITE_MB} MB. Remova imagens antes de salvar para não estourar o envio.`,
      )
      return
    }

    setSalvando(true)
    try {
      await enfileirarVisita({
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
      })
      await atualizarEstado()
      setMensagem('Visita salva no aparelho. Envie quando houver internet para receber o link do laudo.')
      setCliente('')
      setTipo('')
      setObservacoes('')
      setModeloId('')
      setFotos([])
      setAssinatura(null)
      setResultado(null)
      setClientId(crypto.randomUUID())
    } catch {
      setErro('Não foi possível salvar a visita no aparelho.')
    } finally {
      setSalvando(false)
    }
  }

  async function copiarLink(entrega: Entrega) {
    const link = `${window.location.origin}/o/${entrega.token}`
    try {
      await navigator.clipboard.writeText(link)
      setMensagem('Link do laudo copiado.')
    } catch {
      setErro('Não foi possível copiar. Selecione o link e copie manualmente.')
    }
  }

  return (
    <main className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Nova visita técnica</h1>
        <p className="text-sm text-slate-600">
          O rascunho fica salvo neste aparelho até você sincronizar. Não é preciso internet para
          preencher ou salvar.
        </p>
        <a href="/" className="text-sm text-teal-700 underline">
          Voltar ao início
        </a>
      </header>

      <form onSubmit={salvar} className="space-y-5">
        <div className="space-y-1">
          <label htmlFor="cliente" className="block font-medium">
            Cliente
          </label>
          <input
            id="cliente"
            value={cliente}
            onChange={(event) => setCliente(event.target.value)}
            required
            className="w-full rounded border border-slate-300 px-3 py-2"
            placeholder="Nome do cliente"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="tipo" className="block font-medium">
              Tipo de visita
            </label>
            <input
              id="tipo"
              value={tipo}
              onChange={(event) => setTipo(event.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2"
              placeholder="Ex.: HVAC"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="modelo" className="block font-medium">
              Modelo (opcional)
            </label>
            <select
              id="modelo"
              value={modeloId}
              onChange={(event) => setModeloId(event.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2"
            >
              <option value="">Sem modelo</option>
              {modelos.map((modelo) => (
                <option key={modelo.id} value={modelo.id}>
                  {modelo.nome}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">
              Se o tipo ficar vazio, usamos o nome do modelo selecionado.
            </p>
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="observacoes" className="block font-medium">
            Observações
          </label>
          <textarea
            id="observacoes"
            value={observacoes}
            onChange={(event) => setObservacoes(event.target.value)}
            maxLength={2000}
            rows={4}
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
          <p className="text-xs text-slate-500">{observacoes.length}/2000 caracteres</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="fotos" className="block font-medium">
            Fotos (antes/depois)
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

        <AssinaturaCanvas onAssinatura={(blob) => setAssinatura(blob)} />

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

        <button
          type="submit"
          disabled={salvando}
          className="rounded bg-teal-700 px-4 py-2 text-white disabled:opacity-50"
        >
          {salvando ? 'Salvando…' : 'Salvar visita no aparelho'}
        </button>
      </form>

      <section className="space-y-3 border-t border-slate-200 pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void sincronizar()}
            disabled={sincronizando}
            className="rounded bg-slate-800 px-4 py-2 text-white disabled:opacity-50"
          >
            {sincronizando ? 'Enviando…' : 'Sincronizar agora'}
          </button>
          <span className="text-sm text-slate-600">{pendentes} visita(s) pendente(s)</span>
        </div>
        {resultado && (
          <p className="text-sm text-slate-600">
            Último envio: {resultado.enviadas} enviada(s), {resultado.falhas} falha(s),{' '}
            {resultado.errosTamanho} erro(s) de tamanho.
          </p>
        )}

        {entregas.length > 0 && (
          <div className="space-y-2">
            <h2 className="font-medium">Links dos laudos entregues</h2>
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
                    Copiar link
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
