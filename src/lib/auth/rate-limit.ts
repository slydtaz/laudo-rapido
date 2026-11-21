import { sql } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import { tentativasLogin } from '@/lib/db/schema'

/** 10 tentativas em 15 minutos: a tentativa que atinge o limite já é bloqueada. */
export const JANELA_TENTATIVAS_MINUTOS = 15
export const LIMITE_TENTATIVAS = 10
export const MENSAGEM_BLOQUEIO = 'Muitas tentativas. Tente novamente em instantes.'

/** Primeiro valor de x-forwarded-for é o cliente original; o resto é proxy. */
export function ipDaRequisicao(req: Request): string | null {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
}

/**
 * Chave opaca por IP + e-mail. O e-mail segue a mesma normalização da
 * allowlist (trim + minúsculas) e a ausência de IP vira `desconhecido`.
 * A chave nunca é registrada em log.
 */
export function chaveTentativa(ip: string | null, email: string): string {
  const origem = ip?.trim() || 'desconhecido'
  return `${origem}:${email.trim().toLowerCase()}`
}

/**
 * Conta uma tentativa de forma atômica e devolve `bloqueado` quando o limite
 * da janela foi atingido. A janela recomeça na primeira tentativa seguinte ao
 * vencimento dos 15 minutos; o contador de uma chave não afeta outro.
 */
export async function registrarTentativa(
  chave: string,
): Promise<{ bloqueado: boolean }> {
  const expirada = sql`${tentativasLogin.criadoEm} < now() - (${JANELA_TENTATIVAS_MINUTOS} * interval '1 minute')`

  const [linha] = await db
    .insert(tentativasLogin)
    .values({ chave, tentativas: 1 })
    .onConflictDoUpdate({
      target: tentativasLogin.chave,
      set: {
        tentativas: sql`CASE WHEN ${expirada} THEN 1 ELSE ${tentativasLogin.tentativas} + 1 END`,
        criadoEm: sql`CASE WHEN ${expirada} THEN now() ELSE ${tentativasLogin.criadoEm} END`,
      },
    })
    .returning({ tentativas: tentativasLogin.tentativas })

  // Falha fechada: se o banco não devolver a contagem, trata como bloqueado.
  return { bloqueado: (linha?.tentativas ?? LIMITE_TENTATIVAS) >= LIMITE_TENTATIVAS }
}
