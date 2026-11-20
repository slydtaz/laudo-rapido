import { randomBytes } from 'node:crypto'

import { and, eq, gt } from 'drizzle-orm'

import { db } from '../db/client'
import { sessoes } from '../db/schema'

/** Nome do cookie de sessão. O middleware repete o literal: ele roda no Edge. */
export const COOKIE_SESSAO = 'sessao'

/** Validade da sessão: 7 dias. */
export const DURACAO_SESSAO_SEGUNDOS = 60 * 60 * 24 * 7

/** Identidade autenticada e o tenant (empresa) a que ela pertence. */
export type Sessao = { usuarioId: string; empresaId: string }

function extrairCookie(cabecalho: string | null, nome: string): string | null {
  if (!cabecalho) {
    return null
  }
  for (const parte of cabecalho.split(';')) {
    const separador = parte.indexOf('=')
    if (separador === -1) {
      continue
    }
    if (parte.slice(0, separador).trim() === nome) {
      return decodeURIComponent(parte.slice(separador + 1).trim())
    }
  }
  return null
}

/**
 * Cria uma sessão com token opaco de 32 bytes (base64url) e devolve o token,
 * que o chamador entrega no cookie `sessao`.
 */
export async function criarSessao(usuarioId: string, empresaId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  const expiraEm = new Date(Date.now() + DURACAO_SESSAO_SEGUNDOS * 1000)

  await db.insert(sessoes).values({ id: token, usuarioId, empresaId, expiraEm })

  return token
}

/** Token opaco do cookie `sessao`, ou `null` quando ausente. */
export function extrairTokenCookie(req: Request): string | null {
  return extrairCookie(req.headers.get('cookie'), COOKIE_SESSAO)
}

/**
 * Lê o cookie `sessao` e devolve a identidade da sessão ainda válida, ou
 * `null` quando o cookie está ausente, é desconhecido ou já expirou.
 */
export async function lerSessao(req: Request): Promise<Sessao | null> {
  const token = extrairTokenCookie(req)
  if (!token) {
    return null
  }

  const [sessao] = await db
    .select({ usuarioId: sessoes.usuarioId, empresaId: sessoes.empresaId })
    .from(sessoes)
    .where(and(eq(sessoes.id, token), gt(sessoes.expiraEm, new Date())))
    .limit(1)

  return sessao ?? null
}

/**
 * Encerra a sessão ao remover o token do banco. Idempotente: não há erro
 * quando o cookie está ausente ou o token já é desconhecido/expirado.
 * A expiração do cookie em si é feita pela rota de logout.
 */
export async function encerrarSessao(req: Request): Promise<void> {
  const token = extrairTokenCookie(req)
  if (!token) {
    return
  }
  await db.delete(sessoes).where(eq(sessoes.id, token))
}
