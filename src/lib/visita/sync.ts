import { randomBytes } from 'node:crypto'

import { db, type Banco } from '../db/client'
import { assinaturas, fotos, visitas } from '../db/schema'
// Import apenas de tipo: `sync.ts` roda no servidor e não deve carregar o Dexie.
import type { VisitaLocal } from '../offline/queue'
import { salvarAssinatura, salvarFoto } from '../storage/client'

/**
 * Insere um lote de visitas do aparelho no tenant informado e devolve a
 * contagem de criadas e duplicadas.
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
 * não refazem upload.
 */
export async function sincronizarLote(
  itens: VisitaLocal[],
  empresaId: string,
): Promise<{ criadas: number; duplicadas: number }> {
  let criadas = 0
  let duplicadas = 0

  for (const item of itens) {
    const criouVisita = await db.transaction(async (tx) => {
      const inseridas = await tx
        .insert(visitas)
        .values({
          empresaId,
          clientId: item.clientId,
          modeloId: item.modeloId ?? null,
          status: 'sincronizada',
          dados: item.dados,
          token: randomBytes(24).toString('base64url'),
          capturadoEm: item.capturadoEm,
        })
        .onConflictDoNothing({ target: [visitas.empresaId, visitas.clientId] })
        .returning()

      // Duplicata: nada de mídia é reenviado e nada é persistido.
      if (inseridas.length === 0) {
        return false
      }

      await salvarMidia(tx, inseridas[0].id, item)
      return true
    })

    if (criouVisita) {
      criadas++
    } else {
      duplicadas++
    }
  }

  return { criadas, duplicadas }
}

async function salvarMidia(tx: Banco, visitaId: string, item: VisitaLocal): Promise<void> {
  for (const foto of item.fotos) {
    const buffer = Buffer.from(await foto.blob.arrayBuffer())
    const url = await salvarFoto(visitaId, buffer, foto.blob.type)
    await tx.insert(fotos).values({ visitaId, url, capturadoEm: foto.capturadoEm })
  }

  if (item.assinatura) {
    const png = Buffer.from(await item.assinatura.arrayBuffer())
    const url = await salvarAssinatura(visitaId, png)
    await tx.insert(assinaturas).values({ visitaId, url })
  }
}
