import { randomBytes } from 'node:crypto'

import { and, eq } from 'drizzle-orm'

import { db, type Banco } from '../db/client'
import { assinaturas, fotos, visitas } from '../db/schema'
// Import apenas de tipo: `sync.ts` roda no servidor e não deve carregar o Dexie.
import type { VisitaLocal } from '../offline/queue'
import { normalizarAssinatura, salvarAssinatura, salvarFoto } from '../storage/client'

/** Link de entrega devolvido ao aparelho para cada visita sincronizada. */
export type EntregaSync = { clientId: string; visitaId: string; token: string }

export type ResultadoLote = {
  criadas: number
  duplicadas: number
  entregas: EntregaSync[]
}

/**
 * Insere um lote de visitas do aparelho no tenant informado e devolve as
 * contagens e os links de entrega (inclusive para reenvios).
 *
 * `clientId` (UUIDv4 do cliente) + `empresaId` é a única chave de
 * idempotência: `onConflictDoNothing` transforma reenvios em duplicatas sem
 * erro, e `capturadoEm` é propagado como recebido — nunca substituído por now().
 *
 * Cada item roda em uma transação: insert da visita e toda a mídia são
 * atômicos. Se o upload ao R2 ou qualquer insert falhar, a transação faz
 * rollback e a exceção sobe — a rota responde 502 e `sincronizarFila` mantém a
 * pendência. Na nova tentativa a visita não existe, então é criada de novo e a
 * mídia é enviada (RNF-02, sem perda de fotos/assinatura). Duplicatas legítimas
 * não refazem upload e devolvem o token original da visita já existente.
 */
export async function sincronizarLote(
  itens: VisitaLocal[],
  empresaId: string,
): Promise<ResultadoLote> {
  let criadas = 0
  let duplicadas = 0
  const entregas: EntregaSync[] = []

  for (const item of itens) {
    const resultado = await db.transaction(async (tx) => {
      const token = randomBytes(24).toString('base64url')
      const inseridas = await tx
        .insert(visitas)
        .values({
          empresaId,
          clientId: item.clientId,
          modeloId: item.modeloId ?? null,
          status: 'sincronizada',
          dados: item.dados,
          token,
          capturadoEm: item.capturadoEm,
        })
        .onConflictDoNothing({ target: [visitas.empresaId, visitas.clientId] })
        .returning()

      // Duplicata: nada de mídia é reenviado; recupera o link original.
      if (inseridas.length === 0) {
        const [existente] = await tx
          .select({ id: visitas.id, token: visitas.token })
          .from(visitas)
          .where(and(eq(visitas.empresaId, empresaId), eq(visitas.clientId, item.clientId)))
          .limit(1)
        return { criou: false, visitaId: existente?.id ?? null, token: existente?.token ?? null }
      }

      await salvarMidia(tx, inseridas[0].id, item)
      return { criou: true, visitaId: inseridas[0].id, token }
    })

    if (resultado.criou) {
      criadas++
    } else {
      duplicadas++
    }
    if (resultado.visitaId && resultado.token) {
      entregas.push({
        clientId: item.clientId,
        visitaId: resultado.visitaId,
        token: resultado.token,
      })
    }
  }

  return { criadas, duplicadas, entregas }
}

async function salvarMidia(tx: Banco, visitaId: string, item: VisitaLocal): Promise<void> {
  for (const foto of item.fotos) {
    const buffer = Buffer.from(await foto.blob.arrayBuffer())
    const url = await salvarFoto(visitaId, buffer, foto.blob.type)
    await tx.insert(fotos).values({ visitaId, url, capturadoEm: foto.capturadoEm })
  }

  if (item.assinatura) {
    // O caminho offline também passa pela normalização do servidor: o Blob
    // gerado no canvas vira data URL e é achatado/redimensionado uma única vez.
    const mime = item.assinatura.type || 'image/png'
    const bytes = Buffer.from(await item.assinatura.arrayBuffer())
    const dataUrl = `data:${mime};base64,${bytes.toString('base64')}`
    const png = await normalizarAssinatura(dataUrl)
    const url = await salvarAssinatura(visitaId, png)
    await tx.insert(assinaturas).values({ visitaId, url })
  }
}
