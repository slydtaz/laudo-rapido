import { createHash, createPublicKey, randomBytes, verify } from 'node:crypto'

import type { PerfilGoogle } from './conta'

export type ConfigGoogle = {
  clientId: string
  clientSecret: string
  redirectUri: string
}

const CAMINHO_CALLBACK = '/api/v1/auth/google/callback'
const URL_AUTORIZACAO = 'https://accounts.google.com/o/oauth2/v2/auth'
const URL_TOKEN = 'https://oauth2.googleapis.com/token'
const URL_JWKS = 'https://www.googleapis.com/oauth2/v3/certs'
const EMITENTE = 'https://accounts.google.com'

export function configuracaoGoogle(): ConfigGoogle | null {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return null
  }
  return {
    clientId,
    clientSecret,
    redirectUri: process.env.GOOGLE_REDIRECT_URI ?? `http://localhost:3000${CAMINHO_CALLBACK}`,
  }
}

/** O consentimento simulado nunca pode ser servido em produção. */
export function modoDemo(): boolean {
  return process.env.NODE_ENV !== 'production'
}

export function criarFluxoOAuth(cfg: ConfigGoogle | null): {
  state: string
  verifier: string
  url: string
} {
  const state = randomBytes(32).toString('base64url')
  const verifier = randomBytes(32).toString('base64url')

  if (!cfg) {
    return { state, verifier, url: '/api/v1/auth/google/demo' }
  }

  const desafio = createHash('sha256').update(verifier).digest('base64url')
  const parametros = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: desafio,
    code_challenge_method: 'S256',
  })
  return { state, verifier, url: `${URL_AUTORIZACAO}?${parametros.toString()}` }
}

/** Troca o código pelo id_token, enviando o verificador do PKCE. */
export async function trocarCodigo(
  code: string,
  verifier: string,
  cfg: ConfigGoogle,
): Promise<{ idToken: string }> {
  const corpo = new URLSearchParams({
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: cfg.redirectUri,
    grant_type: 'authorization_code',
    code_verifier: verifier,
  })
  const resposta = await fetch(URL_TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: corpo.toString(),
  })
  if (!resposta.ok) {
    throw new Error('Não foi possível trocar o código com o Google.')
  }
  const dados = (await resposta.json()) as { id_token?: unknown }
  if (typeof dados.id_token !== 'string' || !dados.id_token) {
    throw new Error('O Google não devolveu um id_token.')
  }
  return { idToken: dados.id_token }
}

type JwksCache = { chaves: JsonWebKey[]; expiraEm: number }
let cacheJwks: JwksCache | null = null

async function chavesPublicas(): Promise<JsonWebKey[]> {
  if (cacheJwks && cacheJwks.expiraEm > Date.now()) {
    return cacheJwks.chaves
  }
  const resposta = await fetch(URL_JWKS)
  if (!resposta.ok) {
    throw new Error('JWKS indisponível.')
  }
  const dados = (await resposta.json()) as { keys?: unknown }
  if (!Array.isArray(dados.keys)) {
    throw new Error('JWKS inválido.')
  }
  const chaves = dados.keys as JsonWebKey[]
  cacheJwks = { chaves, expiraEm: Date.now() + 5 * 60 * 1000 }
  return chaves
}

function partesToken(token: string): {
  cabecalho: Record<string, unknown>
  payload: Record<string, unknown>
  assinado: Buffer
  assinatura: Buffer
} | null {
  const partes = token.split('.')
  if (partes.length !== 3) {
    return null
  }
  try {
    const cabecalho: unknown = JSON.parse(Buffer.from(partes[0], 'base64url').toString('utf8'))
    const payload: unknown = JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8'))
    if (typeof cabecalho !== 'object' || cabecalho === null || typeof payload !== 'object' || payload === null) {
      return null
    }
    return {
      cabecalho: cabecalho as Record<string, unknown>,
      payload: payload as Record<string, unknown>,
      assinado: Buffer.from(`${partes[0]}.${partes[1]}`),
      assinatura: Buffer.from(partes[2], 'base64url'),
    }
  } catch {
    return null
  }
}

/** Valida assinatura RS256 e claims. Qualquer falha devolve null, nunca lança. */
export async function validarIdToken(
  idToken: string,
  cfg: ConfigGoogle,
): Promise<PerfilGoogle | null> {
  try {
    const partes = partesToken(idToken)
    if (!partes || partes.cabecalho.alg !== 'RS256' || typeof partes.cabecalho.kid !== 'string') {
      return null
    }

    const jwk = (await chavesPublicas()).find((chave) => chave.kid === partes.cabecalho.kid)
    if (!jwk) {
      return null
    }
    const chave = createPublicKey({ key: jwk, format: 'jwk' })
    if (!verify('RSA-SHA256', partes.assinado, chave, partes.assinatura)) {
      return null
    }

    const p = partes.payload
    if (
      p.iss !== EMITENTE ||
      p.aud !== cfg.clientId ||
      typeof p.exp !== 'number' ||
      p.exp <= Math.floor(Date.now() / 1000) ||
      p.email_verified !== true ||
      typeof p.sub !== 'string' ||
      typeof p.email !== 'string'
    ) {
      return null
    }
    return {
      sub: p.sub,
      email: p.email,
      emailVerificado: true,
      nome: typeof p.name === 'string' ? p.name : '',
    }
  } catch {
    return null
  }
}

/** Identidade fixa do consentimento simulado, fora de produção. */
export function perfilDemo(): PerfilGoogle {
  return {
    sub: 'google-demo-sub',
    email: 'demo.google@exemplo.local',
    emailVerificado: true,
    nome: 'Técnico Demo',
  }
}
