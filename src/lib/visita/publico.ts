import { asc, eq } from 'drizzle-orm'

import { db } from '../db/client'
import { assinaturas, empresas, fotos, visitas } from '../db/schema'
import type { Assinatura, Foto, Visita } from '../db/schema'

/** Visita completa, com a mídia e o prestador necessários para o laudo. */
export type VisitaPublica = Visita & {
  fotos: Foto[]
  assinatura: Assinatura | null
  nomePrestador: string | null
}

/**
 * Carrega uma visita pelo token opaco do link de entrega, junto com fotos e
 * assinatura. O token é a própria credencial: nunca listamos visitas aqui.
 * Devolve `null` quando o token não existe (visita inexistente ou sem token).
 */
export async function buscarVisitaPublica(token: string): Promise<VisitaPublica | null> {
  if (!token) {
    return null
  }

  const [visita] = await db
    .select()
    .from(visitas)
    .where(eq(visitas.token, token))
    .limit(1)

  if (!visita) {
    return null
  }

  const [fotosDaVisita, [assinatura], [empresa]] = await Promise.all([
    db
      .select()
      .from(fotos)
      .where(eq(fotos.visitaId, visita.id))
      .orderBy(asc(fotos.capturadoEm)),
    db
      .select()
      .from(assinaturas)
      .where(eq(assinaturas.visitaId, visita.id))
      .limit(1),
    db
      .select({ nome: empresas.nome })
      .from(empresas)
      .where(eq(empresas.id, visita.empresaId))
      .limit(1),
  ])

  return {
    ...visita,
    fotos: fotosDaVisita,
    assinatura: assinatura ?? null,
    nomePrestador: empresa?.nome ?? null,
  }
}
