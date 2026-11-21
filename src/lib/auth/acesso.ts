import { sql } from 'drizzle-orm'

import { db } from '../db/client'
import { usuarios } from '../db/schema'
import { ERRO_SESSAO } from '../visita/acesso'
import { emailPermitido } from './allowlist'
import { lerSessao, type Sessao } from './session'

export { emailPermitido }

/** Identidade autorizada: sessão válida cujo e-mail está na allowlist. */
export type Acesso = { usuarioId: string; empresaId: string; email: string }

/** Resposta padrão para sessão válida com e-mail fora da allowlist. */
export const ERRO_ACESSO = { erro: 'Aplicativo em desenvolvimento.' }

async function acessoDaSessao(sessao: Sessao): Promise<Acesso | null> {
  // A sessão guarda `usuarioId` como texto; `usuarios.id` é uuid.
  const [usuario] = await db
    .select({ email: usuarios.email })
    .from(usuarios)
    .where(sql`${usuarios.id}::text = ${sessao.usuarioId}`)
    .limit(1)

  const email = usuario?.email
  if (!email || !emailPermitido(email)) {
    return null
  }

  return { usuarioId: sessao.usuarioId, empresaId: sessao.empresaId, email }
}

/** Gate server-side único: sessão válida + e-mail permitido. */
export async function exigirAcesso(req: Request): Promise<Acesso | null> {
  const sessao = await lerSessao(req)
  if (!sessao) {
    return null
  }
  return acessoDaSessao(sessao)
}

/**
 * Variante para rotas: 401 para sessão inválida e 403 para e-mail não
 * permitido (inclusive quando `EMAIL_PERMITIDO` não está configurado).
 * Consumidores usam `'resposta' in resultado` como discriminante.
 */
export async function acessoOuErro(
  req: Request,
): Promise<{ acesso: Acesso } | { resposta: Response }> {
  const sessao = await lerSessao(req)
  if (!sessao) {
    return { resposta: Response.json(ERRO_SESSAO, { status: 401 }) }
  }

  const acesso = await acessoDaSessao(sessao)
  if (!acesso) {
    return { resposta: Response.json(ERRO_ACESSO, { status: 403 }) }
  }

  return { acesso }
}
