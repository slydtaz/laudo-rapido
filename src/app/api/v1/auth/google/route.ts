import { definirCookieOAuth, redirecionar } from '@/lib/auth/cookie'
import { configuracaoGoogle, criarFluxoOAuth, modoDemo } from '@/lib/auth/google'

/** Inicia o Authorization Code + PKCE; sem credenciais em dev usa o consentimento demo. */
export async function GET(req: Request) {
  const cfg = configuracaoGoogle()
  if (!cfg && !modoDemo()) {
    return Response.json({ erro: 'Login com Google não configurado.' }, { status: 503 })
  }

  const fluxo = criarFluxoOAuth(cfg)
  return redirecionar(new URL(fluxo.url, req.url), 307, [
    definirCookieOAuth({ state: fluxo.state, verifier: fluxo.verifier }),
  ])
}
