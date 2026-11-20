import { COOKIE_SESSAO, encerrarSessao } from '@/lib/auth/session'

/**
 * Logout idempotente: remove a sessão do banco (se houver) e sempre expira
 * o cookie no navegador. Pode ser chamado sem cookie — a resposta é a mesma,
 * o que evita vazar se havia uma sessão ativa.
 */
export async function POST(req: Request) {
  await encerrarSessao(req)

  const cookie = [
    `${COOKIE_SESSAO}=`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    'Max-Age=0',
  ]
  if (process.env.NODE_ENV === 'production') {
    cookie.push('Secure')
  }

  const resposta = Response.json({ ok: true })
  resposta.headers.append('Set-Cookie', cookie.join('; '))
  return resposta
}
