import type { CriarVisita } from '../visita/dto'
import { fila, type EntregaLocal, type PendenciaOffline } from './db'

/** Payload de uma visita capturada no aparelho, antes da sincronização. */
export type VisitaLocal = CriarVisita & {
  fotos: { blob: Blob; capturadoEm: Date }[]
  assinatura?: Blob
}

export type ResultadoSincronizacao = {
  enviadas: number
  falhas: number
  /** Visita grande demais para a função: pendência mantida, erro explícito. */
  errosTamanho: number
  /** Links `/o/:token` obtidos nesta rodada (também gravados no IndexedDB). */
  entregas: EntregaLocal[]
}

type EntregaRecebida = { clientId: string; visitaId: string; token: string }

const ROTA_SINCRONIZACAO = '/api/v1/visitas/sync'

/** Grava a visita no aparelho e a registra como pendente de envio. */
export async function enfileirarVisita(visita: VisitaLocal): Promise<void> {
  await fila.transaction('rw', fila.visitas, fila.pendencias, async () => {
    await fila.visitas.put(visita)
    await fila.pendencias.put({ clientId: visita.clientId, criadoEm: new Date() })
  })
}

/**
 * Envia as pendências na ordem em que foram criadas, **uma visita por
 * requisição**. Isso mantém cada corpo bem abaixo do limite de 4,5 MB da
 * função: um lote com várias fotos de celular estouraria o limite e nunca
 * passaria, gerando retry infinito.
 *
 * RNF-02: só remove a pendência depois de uma resposta 2xx. Falha de rede ou
 * 5xx mantém o item; 413 mantém o item mas é contado à parte como erro de
 * tamanho para a UI explicar ao técnico (não é retry cego). Duplicata
 * legítima (2xx) limpa a pendência e recupera o link original.
 */
export async function sincronizarFila(): Promise<ResultadoSincronizacao> {
  const pendencias: PendenciaOffline[] = await fila.pendencias.orderBy('criadoEm').toArray()
  const resultado: ResultadoSincronizacao = {
    enviadas: 0,
    falhas: 0,
    errosTamanho: 0,
    entregas: [],
  }

  for (const pendencia of pendencias) {
    const visita: VisitaLocal | undefined = await fila.visitas.get(pendencia.clientId)
    if (!visita) {
      // Sem o payload local não há o que enviar; mantém a pendência.
      resultado.falhas++
      continue
    }

    try {
      const resposta = await enviarVisita(visita)
      if (resposta.status === 413) {
        resultado.errosTamanho++
        continue
      }
      if (!resposta.ok) {
        resultado.falhas++
        continue
      }

      const entregas = entregasDaResposta(await resposta.json()).map((entrega) => ({
        ...entrega,
        criadoEm: new Date(),
      }))
      await fila.transaction('rw', fila.pendencias, fila.entregas, async () => {
        for (const entrega of entregas) {
          await fila.entregas.put(entrega)
        }
        await fila.pendencias.delete(pendencia.clientId)
      })
      resultado.entregas.push(...entregas)
      resultado.enviadas++
    } catch {
      resultado.falhas++
    }
  }

  return resultado
}

/** Quantas visitas ainda aguardam envio no aparelho. */
export async function pendenciasRestantes(): Promise<number> {
  return fila.pendencias.count()
}

/** Links já entregues, do mais recente para o mais antigo. */
export async function entregasSalvas(): Promise<EntregaLocal[]> {
  const entregas = await fila.entregas.orderBy('criadoEm').toArray()
  return entregas.reverse()
}

/**
 * Uma visita sem mídia viaja como JSON; com blobs, os metadados vão no campo
 * `lote` e cada blob é anexado em um campo nomeado, referenciado por `campo`.
 */
async function enviarVisita(item: VisitaLocal): Promise<Response> {
  const metadado = {
    clientId: item.clientId,
    modeloId: item.modeloId,
    dados: item.dados,
    capturadoEm: item.capturadoEm.toISOString(),
  }

  if (item.fotos.length === 0 && !item.assinatura) {
    return fetch(ROTA_SINCRONIZACAO, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify([metadado]),
    })
  }

  const form = new FormData()
  form.set(
    'lote',
    JSON.stringify([
      {
        ...metadado,
        fotos: item.fotos.map((foto, posicao) => ({
          campo: `foto_${posicao}`,
          capturadoEm: foto.capturadoEm.toISOString(),
        })),
        assinaturaCampo: item.assinatura ? 'assinatura' : undefined,
      },
    ]),
  )
  item.fotos.forEach((foto, posicao) => {
    form.set(`foto_${posicao}`, foto.blob)
  })
  if (item.assinatura) {
    form.set('assinatura', item.assinatura)
  }

  return fetch(ROTA_SINCRONIZACAO, { method: 'POST', body: form })
}

/** Extrai apenas entregas bem formadas do corpo da resposta. */
function entregasDaResposta(dados: unknown): EntregaRecebida[] {
  if (!dados || typeof dados !== 'object') {
    return []
  }
  const bruto = (dados as { entregas?: unknown }).entregas
  if (!Array.isArray(bruto)) {
    return []
  }
  return bruto.filter((item): item is EntregaRecebida => {
    if (!item || typeof item !== 'object') {
      return false
    }
    const candidato = item as Partial<EntregaRecebida>
    return (
      typeof candidato.clientId === 'string' &&
      typeof candidato.visitaId === 'string' &&
      typeof candidato.token === 'string'
    )
  })
}
