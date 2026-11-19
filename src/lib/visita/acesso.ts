import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '../db/client'
import { visitas } from '../db/schema'

/** Resposta padrão para requisições sem sessão válida nas rotas autenticadas. */
export const ERRO_SESSAO = { erro: 'Sessão inválida ou expirada.' }

/**
 * RF-08: carrega uma visita somente quando ela pertence ao tenant da sessão.
 * `empresaId` vem sempre da sessão, nunca do corpo da requisição.
 *
 * Ponto único do gate de posse usado pelas rotas de mídia: qualquer ajuste
 * futuro (filtro de status, tipo de id) acontece aqui e vale para as duas.
 */
export async function visitaDoTenant(
  id: string,
  empresaId: string,
): Promise<{ id: string } | null> {
  if (!z.uuid().safeParse(id).success) {
    return null
  }
  const [visita] = await db
    .select({ id: visitas.id })
    .from(visitas)
    .where(and(eq(visitas.id, id), eq(visitas.empresaId, empresaId)))
    .limit(1)
  return visita ?? null
}
