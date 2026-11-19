import { lerSessao } from '@/lib/auth/session'
import { ERRO_SESSAO } from '@/lib/visita/acesso'

/**
 * Devolve SOMENTE o tenant da sessão atual. O cliente usa este id para
 * particionar o storage local (IndexedDB) em aparelhos compartilhados; nenhum
 * e-mail, id de usuário ou token é exposto. O `empresaId` continua sendo
 * derivado da sessão no servidor — nunca recebido do cliente.
 */
export async function GET(req: Request) {
  const sessao = await lerSessao(req)
  if (!sessao) {
    return Response.json(ERRO_SESSAO, { status: 401 })
  }
  return Response.json({ empresaId: sessao.empresaId })
}
