import { eq } from 'drizzle-orm'

import {
  cookieOAuthExpirado,
  definirCookieSessao,
  lerCookieOAuth,
  redirecionar,
} from '@/lib/auth/cookie'
import { vincularOuCriarGoogle, type PerfilGoogle } from '@/lib/auth/conta'
import {
  configuracaoGoogle,
  modoDemo,
  perfilDemo,
  trocarCodigo,
  validarIdToken,
} from '@/lib/auth/google'
import { criarSessao } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { usuarios } from '@/lib/db/schema'

function comCookieLimpo(resposta: Response): Response {
  resposta.headers.append('Set-Cookie', cookieOAuthExpirado())
  return resposta
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const state = url.searchParams.get('state')
  const fluxo = lerCookieOAuth(req)

  if (!state || !fluxo || state !== fluxo.state) {
    return comCookieLimpo(
      Response.json({ erro: 'Fluxo OAuth inválido ou expirado.' }, { status: 400 }),
    )
  }

  const code = url.searchParams.get('code')
  let perfil: PerfilGoogle | null = null
  try {
    if (code === 'demo-code' && modoDemo()) {
      perfil = perfilDemo()
    } else {
      const cfg = configuracaoGoogle()
      if (!code || !cfg) {
        throw new Error('Código ou configuração ausente.')
      }
      const { idToken } = await trocarCodigo(code, fluxo.verifier, cfg)
      perfil = await validarIdToken(idToken, cfg)
    }
  } catch {
    perfil = null
  }

  if (!perfil) {
    return comCookieLimpo(
      Response.json({ erro: 'Não foi possível confirmar a identidade do Google.' }, { status: 400 }),
    )
  }

  const vinculo = await vincularOuCriarGoogle(perfil)
  if (!vinculo.ok) {
    const destino = new URL('/login', url.origin)
    destino.searchParams.set('erro', vinculo.codigo)
    return redirecionar(destino, 303, [cookieOAuthExpirado()])
  }

  const [usuario] = await db
    .select({ empresaId: usuarios.empresaId })
    .from(usuarios)
    .where(eq(usuarios.id, vinculo.usuarioId))
    .limit(1)
  if (!usuario) {
    return comCookieLimpo(Response.json({ erro: 'Conta não encontrada.' }, { status: 400 }))
  }

  const token = await criarSessao(vinculo.usuarioId, usuario.empresaId)
  return redirecionar(new URL('/', url.origin), 303, [
    definirCookieSessao(token),
    cookieOAuthExpirado(),
  ])
}
