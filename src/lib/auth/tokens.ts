import { createHash, randomBytes } from 'node:crypto'

import { and, desc, eq, gt, isNull } from 'drizzle-orm'

import { db } from '../db/client'
import { tokensAuth } from '../db/schema'

export type TipoToken = 'verificar_email' | 'redefinir_senha'

/** Validade de cada finalidade, em segundos. */
export const VALIDADE_TOKEN_SEGUNDOS: Record<TipoToken, number> = {
  verificar_email: 24 * 60 * 60,
  redefinir_senha: 30 * 60,
}

/** Intervalo mínimo entre duas emissões para o mesmo usuário e finalidade. */
export const COOLDOWN_TOKEN_SEGUNDOS = 60

export function gerarToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Emite um token opaco e persiste apenas seu hash. Devolve o token bruto. */
export async function criarToken(usuarioId: string, tipo: TipoToken): Promise<string> {
  const token = gerarToken()
  await db.insert(tokensAuth).values({
    id: hashToken(token),
    usuarioId,
    tipo,
    expiraEm: new Date(Date.now() + VALIDADE_TOKEN_SEGUNDOS[tipo] * 1000),
  })
  return token
}

/** Consome o token atomicamente; devolve o usuário uma única vez. */
export async function consumirToken(
  token: string,
  tipo: TipoToken,
): Promise<string | null> {
  const [linha] = await db
    .update(tokensAuth)
    .set({ usadoEm: new Date() })
    .where(
      and(
        eq(tokensAuth.id, hashToken(token)),
        eq(tokensAuth.tipo, tipo),
        isNull(tokensAuth.usadoEm),
        gt(tokensAuth.expiraEm, new Date()),
      ),
    )
    .returning({ usuarioId: tokensAuth.usuarioId })

  return linha?.usuarioId ?? null
}

/** Respeita o cooldown para evitar reenvios em sequência. */
export async function podeEmitirToken(
  usuarioId: string,
  tipo: TipoToken,
): Promise<boolean> {
  const [ultimo] = await db
    .select()
    .from(tokensAuth)
    .where(and(eq(tokensAuth.usuarioId, usuarioId), eq(tokensAuth.tipo, tipo)))
    .orderBy(desc(tokensAuth.criadoEm))
    .limit(1)

  if (!ultimo) {
    return true
  }
  return Date.now() - (ultimo.criadoEm?.getTime() ?? 0) >= COOLDOWN_TOKEN_SEGUNDOS * 1000
}
