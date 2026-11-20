import { COOKIE_SESSAO, DURACAO_SESSAO_SEGUNDOS } from './session'

/** Cookie de curta duração usado apenas durante o fluxo OAuth. */
export const COOKIE_OAUTH = 'oauth'
export const DURACAO_COOKIE_OAUTH_SEGUNDOS = 600

type FluxoOAuth = { state: string; verifier: string }

function atributos(maxAge: number): string[] {
  const partes = ['HttpOnly', 'SameSite=Lax', 'Path=/', `Max-Age=${maxAge}`]
  if (process.env.NODE_ENV === 'production') {
    partes.push('Secure')
  }
  return partes
}

export function definirCookieSessao(token: string): string {
  return [`${COOKIE_SESSAO}=${token}`, ...atributos(DURACAO_SESSAO_SEGUNDOS)].join('; ')
}

export function cookieSessaoExpirado(): string {
  return [`${COOKIE_SESSAO}=`, ...atributos(0)].join('; ')
}

export function definirCookieOAuth(valor: FluxoOAuth): string {
  const codificado = Buffer.from(JSON.stringify(valor), 'utf8').toString('base64url')
  return [`${COOKIE_OAUTH}=${codificado}`, ...atributos(DURACAO_COOKIE_OAUTH_SEGUNDOS)].join(
    '; ',
  )
}

export function cookieOAuthExpirado(): string {
  return [`${COOKIE_OAUTH}=`, ...atributos(0)].join('; ')
}

function lerCookie(req: Request, nome: string): string | null {
  const cabecalho = req.headers.get('cookie')
  if (!cabecalho) {
    return null
  }
  for (const parte of cabecalho.split(';')) {
    const separador = parte.indexOf('=')
    if (separador === -1) {
      continue
    }
    if (parte.slice(0, separador).trim() === nome) {
      return parte.slice(separador + 1).trim()
    }
  }
  return null
}

/** Lê state e verifier do cookie, devolvendo null se ausente ou corrompido. */
export function lerCookieOAuth(req: Request): FluxoOAuth | null {
  const bruto = lerCookie(req, COOKIE_OAUTH)
  if (!bruto) {
    return null
  }
  try {
    const dados: unknown = JSON.parse(Buffer.from(bruto, 'base64url').toString('utf8'))
    if (
      typeof dados === 'object' &&
      dados !== null &&
      typeof (dados as FluxoOAuth).state === 'string' &&
      typeof (dados as FluxoOAuth).verifier === 'string'
    ) {
      return dados as FluxoOAuth
    }
  } catch {
    // Cookie corrompido conta como ausente.
  }
  return null
}
