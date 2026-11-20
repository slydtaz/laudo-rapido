import { cookieSessaoExpirado } from '@/lib/auth/cookie'
import { encerrarSessao } from '@/lib/auth/session'

/**
 * Logout idempotente: remove a sessão do banco (se houver) e sempre expira
 * o cookie no navegador. Pode ser chamado sem cookie — a resposta é a mesma,
 * o que evita vazar se havia uma sessão ativa.
 */
export async function POST(req: Request) {
  await encerrarSessao(req)

  const resposta = Response.json({ ok: true })
  resposta.headers.append('Set-Cookie', cookieSessaoExpirado())
  return resposta
}
