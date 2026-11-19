import { randomBytes } from 'node:crypto'

import { db } from '../db/client'
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
 * Mídia é enviada ao R2 e persistida aqui, antes que `sincronizarFila` remova
 * a pendência local: se qualquer upload/insert falhar, a exceção sobe e a
 * pendência é mantida para nova tentativa (RNF-02). Duplicatas não refazem
 * upload.
 */
export async function sincronizarLote(
  itens: VisitaLocal[],
  empresaId: string,
): Promise<{ criadas: number; duplicadas: number }> {
  let criadas = 0
  let duplicadas = 0

  for (const item of itens) {
    const inseridas = await db
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

    if (inseridas.length === 0) {
      duplicadas++
      continue
    }

    await salvarMidia(inseridas[0].id, item)
    criadas++
  }

  return { criadas, duplicadas }
}

async function salvarMidia(visitaId: string, item: VisitaLocal): Promise<void> {
  for (const foto of item.fotos) {
    const buffer = Buffer.from(await foto.blob.arrayBuffer())
    const url = await salvarFoto(visitaId, buffer, foto.blob.type)
    await db.insert(fotos).values({ visitaId, url, capturadoEm: foto.capturadoEm })
  }

  if (item.assinatura) {
    const png = Buffer.from(await item.assinatura.arrayBuffer())
    const url = await salvarAssinatura(visitaId, png)
    await db.insert(assinaturas).values({ visitaId, url })
  }
}
