import type { CriarVisita } from '../visita/dto'
import { fila, type PendenciaOffline } from './db'

/** Payload de uma visita capturada no aparelho, antes da sincronização. */
export type VisitaLocal = CriarVisita & {
  fotos: { blob: Blob; capturadoEm: Date }[]
  assinatura?: Blob
}

const TAMANHO_LOTE = 20
const ROTA_SINCRONIZACAO = '/api/v1/visitas/sync'

/** Grava a visita no aparelho e a registra como pendente de envio. */
export async function enfileirarVisita(visita: VisitaLocal): Promise<void> {
  await fila.transaction('rw', fila.visitas, fila.pendencias, async () => {
    await fila.visitas.put(visita)
    await fila.pendencias.put({ clientId: visita.clientId, criadoEm: new Date() })
  })
}

/**
 * Envia as pendências em lotes de até 20, na ordem em que foram criadas.
 * Só remove a pendência depois de uma resposta de sucesso: falha de rede ou
 * da rota mantém o item para a próxima tentativa (RNF-02).
 */
export async function sincronizarFila(): Promise<{ enviadas: number; falhas: number }> {
  const pendencias = await fila.pendencias.orderBy('criadoEm').toArray()
  let enviadas = 0
  let falhas = 0

  for (let inicio = 0; inicio < pendencias.length; inicio += TAMANHO_LOTE) {
    const lote = pendencias.slice(inicio, inicio + TAMANHO_LOTE)
    const localizados = await Promise.all(
      lote.map((pendencia) => fila.visitas.get(pendencia.clientId)),
    )

    // Sem o payload local não há o que enviar; mantém a pendência.
    if (localizados.some((item) => item === undefined)) {
      falhas += lote.length
      continue
    }

    try {
      const resposta = await enviarLote(localizados as VisitaLocal[])
      if (!resposta.ok) {
        falhas += lote.length
        continue
      }
    } catch {
      falhas += lote.length
      continue
    }

    await fila.pendencias.bulkDelete(lote.map((pendencia) => pendencia.clientId))
    enviadas += lote.length
  }

  return { enviadas, falhas }
}

/**
 * Lotes sem mídia viajam como JSON; com blobs, os metadados vão no campo
 * `lote` e cada blob é anexado em um campo nomeado, referenciado por `campo`.
 */
async function enviarLote(itens: VisitaLocal[]): Promise<Response> {
  if (itens.every((item) => item.fotos.length === 0 && !item.assinatura)) {
    const lote = itens.map((item) => ({
      clientId: item.clientId,
      modeloId: item.modeloId,
      dados: item.dados,
      capturadoEm: item.capturadoEm.toISOString(),
    }))
    return fetch(ROTA_SINCRONIZACAO, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(lote),
    })
  }

  const form = new FormData()
  const metadados = itens.map((item, indice) => ({
    clientId: item.clientId,
    modeloId: item.modeloId,
    dados: item.dados,
    capturadoEm: item.capturadoEm.toISOString(),
    fotos: item.fotos.map((foto, posicao) => ({
      campo: `foto_${indice}_${posicao}`,
      capturadoEm: foto.capturadoEm.toISOString(),
    })),
    assinaturaCampo: item.assinatura ? `assinatura_${indice}` : undefined,
  }))
  form.set('lote', JSON.stringify(metadados))
  itens.forEach((item, indice) => {
    item.fotos.forEach((foto, posicao) => {
      form.set(`foto_${indice}_${posicao}`, foto.blob)
    })
    if (item.assinatura) {
      form.set(`assinatura_${indice}`, item.assinatura)
    }
  })

  return fetch(ROTA_SINCRONIZACAO, { method: 'POST', body: form })
}
