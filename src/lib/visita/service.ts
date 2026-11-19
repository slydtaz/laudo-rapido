import { randomBytes } from 'node:crypto'

import { eq } from 'drizzle-orm'

import { db } from '../db/client'
import { visitas, type Visita } from '../db/schema'
import type { CriarVisita } from './dto'

export { criarVisitaSchema } from './dto'
export type { CriarVisita }

/**
 * Grava uma visita no tenant informado. O token opaco de 24 bytes (base64url)
 * é a credencial do link público de compartilhamento (`/o/:token`).
 */
export async function criarVisita(input: CriarVisita, empresaId: string): Promise<Visita> {
  const [visita] = await db
    .insert(visitas)
    .values({
      empresaId,
      clientId: input.clientId,
      modeloId: input.modeloId ?? null,
      status: 'sincronizada',
      dados: input.dados,
      token: randomBytes(24).toString('base64url'),
      capturadoEm: input.capturadoEm,
    })
    .returning()

  return visita
}

/** Lista somente as visitas do tenant da sessão (RF-08). */
export async function listarVisitas(empresaId: string): Promise<Visita[]> {
  return db.select().from(visitas).where(eq(visitas.empresaId, empresaId))
}
